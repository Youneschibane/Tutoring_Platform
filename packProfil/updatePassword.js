const Otp = require('../models/otpModel');
const User = require('../models/userModel');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail } = require('../utils/sendEmail');
const sendSms = require('../utils/sendSMS');

// Step 1: Request OTP for password change
exports.requestPasswordChangeOtp = async (req, res) => {
  try {
    const { currentPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ status: 'fail', message: "Veuillez fournir votre mot de passe actuel." });
    }

    // CORRECTION : On sélectionne 'numberphone' au lieu de 'phone'
    const user = await User.findById(req.user.id).select('+password email numberphone');
    if (!user) {
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ status: 'fail', message: "Mot de passe actuel incorrect." });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    // CORRECTION : On utilise numberphone
    const contact = user.email || user.numberphone;

    if (!contact) {
        return res.status(400).json({ status: 'fail', message: "Aucun email ou numéro de téléphone associé à ce compte." });
    }

    await Otp.findOneAndUpdate(
      { identifier: contact, purpose: 'password_change' },
      { otp, createdAt: new Date() },
      { upsert: true }
    );

    try {
      if (user.email) {
        await sendEmail({
          email: user.email,
          subject: "Verification de votre changement de mot de passe",
          message: `Votre code de vérification : ${otp}\n\nValide pendant 10 minutes.`
        });
      } else if (user.numberphone) { // CORRECTION : numberphone
        await sendSms({
          phone: user.numberphone, 
          message: `Votre code de vérification : ${otp}. Valide pendant 10 minutes.`
        });
      }
    } catch (notifyError) {
      console.error('--- ERREUR D ENVOI EMAIL/SMS ---', notifyError);
      // On renvoie l'erreur spécifique de Nodemailer pour t'aider à débugger
      return res.status(500).json({ 
          status: 'error', 
          message: "Impossible d'envoyer le code.",
          details: notifyError.message 
      });
    }

    return res.status(200).json({
      status: 'success',
      message: "Code de vérification envoyé.",
      contact: contact.replace(/(.{3}).*/, '$1***')
    });

  } catch (error) {
    console.error('OTP request error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Step 2: Confirm password change with OTP
exports.confirmPasswordChange = async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { otp, newPassword } = req.body;

    if (!otp || !newPassword) {
      return res.status(400).json({ status: 'fail', message: "Code de vérification et nouveau mot de passe sont obligatoires." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ status: 'fail', message: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
    }

    // CORRECTION : numberphone
    const user = await User.findById(req.user.id).select('+password email numberphone').session(session);
    if (!user) {
      throw new Error("Utilisateur introuvable.");
    }

    const contact = user.email || user.numberphone; // CORRECTION : numberphone
    const otpRecord = await Otp.findOne({
      identifier: contact,
      purpose: 'password_change'
    }).session(session);

    if (!otpRecord || otpRecord.otp !== otp) {
      return res.status(401).json({ status: 'fail', message: "Code de vérification invalide ou expiré." });
    }

    // Set passwordChangedAt before password update
    user.passwordChangedAt = new Date(Date.now() - 1000);
    user.password = newPassword;
    await user.save({ session });

    await Otp.deleteOne({ _id: otpRecord._id }).session(session);

    const Device = require('../models/deviceModel');
    await Device.updateMany(
      { userId: user._id },
      { isActive: false },
      { session }
    );

    await session.commitTransaction();

    (async () => {
      try {
        const message = "🔐 Alerte de sécurité : Votre mot de passe a été changé. Tous les appareils ont été déconnectés. Si ce n'était pas vous, changez votre mot de passe immédiatement.";
        if (user.email) {
          await sendEmail({
            email: user.email,
            subject: "Modification de votre mot de passe",
            message
          });
        } else if (user.numberphone) { // CORRECTION : numberphone
          await sendSms({ phone: user.numberphone, message });
        }
      } catch (e) {
        console.error('Notification error:', e);
      }
    })();

    return res.status(200).json({
      status: 'success',
      message: "Mot de passe modifié avec succès. Veuillez vous reconnecter."
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Password change error:', error);
    const statusCode = error.message.includes('introuvable') ? 404 : 500;
    return res.status(statusCode).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};