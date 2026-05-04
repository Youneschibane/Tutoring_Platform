const Otp    = require('../models/otpModel');
const User   = require('../models/userModel');
const Device = require('../models/deviceModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { sendEmail } = require('../utils/sendEmail');
const sendSms      = require('../utils/sendSMS');

// ═══════════════════════════════════════════════════════════════
// HELPER — Envoyer le code OTP (email prioritaire, SMS fallback)
// ═══════════════════════════════════════════════════════════════
const sendOtpNotification = async (user, otp, subject, message) => {
  if (user.email) {
    await sendEmail({ email: user.email, subject, message });
  } else if (user.numberphone) {
    await sendSms({ phone: user.numberphone, message: `${message} Code : ${otp}` });
  }
  //what i should do if there is no contact info? In this case, the OTP request should have been blocked at step 1, so this function shouldn't be called without a valid contact. We can log an error just in case:
  //i throw an error instead of logging. This way, we can throw an error here to catch any unexpected cases where this function is called without a valid contact info. This would indicate a logic error in the flow, since we should have already validated the presence of either email or phone before attempting to send an OTP.
  else {
    console.error('No contact info available for OTP notification.');
    throw new Error('No contact info available for OTP notification.');
  }
};

// ═══════════════════════════════════════════════════════════════
// STEP 1 — Demander l'OTP pour changer le mot de passe
// POST /api/pack-profil/password/request-otp
// Body: { currentPassword }
// ═══════════════════════════════════════════════════════════════
exports.requestPasswordChangeOtp = async (req, res) => {
  try {
    const { currentPassword } = req.body;

    // 1. Validation
    if (!currentPassword) {
      return res.status(400).json({
        status:  'fail',
        message: "Veuillez fournir votre mot de passe actuel."
      });
    }

    // 2. Récupérer l'utilisateur
    const user = await User.findById(req.user.id)
      .select('+password email numberphone');

    if (!user) {
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    // 3. Vérifier le mot de passe actuel
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'fail', message: "Mot de passe actuel incorrect." });
    }

    // 4. Vérifier qu'un contact existe
    const contact = user.email || user.numberphone;
    if (!contact) {
      return res.status(400).json({
        status:  'fail',
        message: "Aucun email ou numéro de téléphone associé à ce compte."
      });
    }

    // 5. Générer et stocker l'OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    await Otp.findOneAndUpdate(
      { identifier: contact, purpose: 'password_change' },
      { otp, createdAt: new Date() },
      { upsert: true }
    );

    // 6. Envoyer l'OTP
    try {
      await sendOtpNotification(
        user,
        otp,
        "Vérification de votre changement de mot de passe",
        `Votre code de vérification : ${otp}\n\nValide pendant 10 minutes.`
      );
    } catch (notifyError) {
      console.error('OTP send error:', notifyError.message);
      return res.status(500).json({
        status:  'error',
        message: "Impossible d'envoyer le code de vérification.",
        details: notifyError.message
      });
    }

    return res.status(200).json({
      status:  'success',
      message: "Code de vérification envoyé.",
      contact: contact.replace(/(.{3}).*/, '$1***')
    });

  } catch (error) {
    console.error('requestPasswordChangeOtp error:', error.message);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// STEP 2 — Confirmer le changement avec l'OTP
// POST /api/pack-profil/password/confirm
// Body: { otp, newPassword }
// ═══════════════════════════════════════════════════════════════
exports.confirmPasswordChange = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { otp, newPassword } = req.body;

    // 1. Validation
    if (!otp || !newPassword) {
      return res.status(400).json({
        status:  'fail',
        message: "Code de vérification et nouveau mot de passe sont obligatoires."
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        status:  'fail',
        message: "Le nouveau mot de passe doit contenir au moins 8 caractères."
      });
    }

    // 2. Récupérer l'utilisateur
    const user = await User.findById(req.user.id)
      .select('+password email numberphone')
      .session(session);

    if (!user) throw new Error("Utilisateur introuvable.");

    const contact = user.email || user.numberphone;

    // 3. Vérifier l'OTP
    const otpRecord = await Otp.findOne({
      identifier: contact,
      purpose:    'password_change'
    }).session(session);

    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(401).json({
        status:  'fail',
        message: "Code de vérification invalide ou expiré."
      });
    }

    // 4. Mettre à jour le mot de passe
    // passwordChangedAt invalide tous les autres tokens JWT (voir protect middleware)
    user.passwordChangedAt = new Date(Date.now() - 1000);
    user.password          = newPassword;
    await user.save({ session });

    // 5. Supprimer l'OTP utilisé
    await Otp.deleteOne({ _id: otpRecord._id }).session(session);

    // 6. Déconnecter tous les autres devices — jwtToken: null invalide leurs sessions
    await Device.updateMany(
      { userId: user._id },
      { jwtToken: null, isActive: false, lastUsed: new Date() },
      { session }
    );

    // 7. Commit
    await session.commitTransaction();

    // 8. Notification post-commit — fire and forget
    (async () => {
      try {
        const alertMessage =
          "🔐 Alerte de sécurité : Votre mot de passe a été modifié. " +
          "Tous les appareils ont été déconnectés. " +
          "Si ce n'était pas vous, contactez le support immédiatement.";

        await sendOtpNotification(
          user,
          null,
          "Modification de votre mot de passe",
          alertMessage
        );
      } catch (e) {
        console.error('Post-change notification error:', e.message);
      }
    })();

    return res.status(200).json({
      status:  'success',
      message: "Mot de passe modifié avec succès. Veuillez vous reconnecter."
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('confirmPasswordChange error:', error.message);

    const statusCode = error.message.includes('introuvable') ? 404 : 500;
    return res.status(statusCode).json({ status: 'error', message: error.message });

  } finally {
    session.endSession();
  }
};