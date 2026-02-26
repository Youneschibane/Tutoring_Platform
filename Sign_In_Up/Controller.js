
const Otp = require('../models/otpModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');
const ResetToken = require('../models/resetTokenModel');
const { v4: uuidv4 } = require('uuid');
const {sendSms} = require('../utils/sendSMS'); 


// --- Signup OTP (used during signup email verification) ---

const mongoose = require('mongoose');




exports.sendSignupOtp = async (req, res) => {
  try {
    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Veuillez fournir un email ou un numéro de téléphone." });
    }

    const contactField = email ? { email } : { phone };

    const existingUser = await User.findOne(contactField);
    if (existingUser) {
      return res.status(400).json({ message: "Ce contact est déjà utilisé pour un compte existant." });
    }

    const existingOtp = await Otp.findOne(contactField);

    if (existingOtp) {
      const lastCreated = new Date(existingOtp.createdAt).getTime();
      const now = Date.now();

      if (now - lastCreated < 60 * 1000) {
        return res.status(429).json({ message: "Veuillez attendre 1 minute avant de demander un nouveau code." });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      contactField,
      { ...contactField, otp: newOtpCode, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (email) {
      await sendEmail({
        email,
        subject: 'Votre code de vérification',
        message: `Votre code est : ${newOtpCode}. Valide pour 10 minutes.`
      });
    } else if (phone) {
      await sendSms({
        phone,
        message: `Votre code de vérification PRJP10 est : ${newOtpCode}.`
      });
    }

    res.status(200).json({
      status: 'success',
      message: `Code envoyé avec succès sur votre ${email ? 'email' : 'téléphone'} !`
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
exports.verifySignupOtp = async (req, res) => {
  try {
    const { email, phone, code } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Veuillez fournir l'email ou le téléphone à vérifier." });
    }

    const contactField = email ? { email } : { phone };

    const record = await Otp.findOne(contactField);
    if (!record) {
      return res.status(400).json({ message: "Code expiré ou inexistant. Renvoyez le code." });
    }

    if (record.otp !== code) {
      return res.status(400).json({ message: "Code incorrect." });
    }

  
    const signupToken = jwt.sign(
      { field: email ? 'email' : 'phone', value: email || phone },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    await Otp.deleteOne(contactField);

    res.status(200).json({
      status: 'success',
      message: `${email ? 'Email' : 'Téléphone'} vérifié avec succès !`,
      signupToken
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// --- Password reset flow ---
exports.sendResetOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    const existingOtp = await Otp.findOne({ identifier: email, purpose: 'reset' });
    if (existingOtp) {
      const lastCreated = new Date(existingOtp.createdAt).getTime();
      const now = Date.now();
      if (now - lastCreated < 60 * 1000) return res.status(429).json({ message: 'Veuillez attendre 1 minute avant de demander un nouveau code.' });
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.findOneAndUpdate(
      { identifier: email, purpose: 'reset' },
      { identifier: email, purpose: 'reset', otp: newOtpCode, createdAt: new Date() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await sendEmail({ email, subject: 'Code de réinitialisation', message: `Votre code de réinitialisation : ${newOtpCode}` });
    res.status(200).json({ status: 'success', message: 'Code de réinitialisation envoyé.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = await Otp.findOne({ identifier: email, purpose: 'reset' });
    if (!record) return res.status(400).json({ message: 'Code expiré ou invalide.' });
    if (record.otp !== code) return res.status(400).json({ message: 'Code incorrect.' });

    // Create a short-lived reset token with a unique jti and persist it for single-use
    const jti = uuidv4();
    const resetToken = jwt.sign({ email, purpose: 'reset', jti }, process.env.JWT_SECRET, { expiresIn: '15m' });
    // Persist jti so the token can be validated and consumed exactly once
    await ResetToken.create({ jti, email, createdAt: new Date() });
    await Otp.deleteOne({ identifier: email, purpose: 'reset' });
    res.status(200).json({ status: 'success', resetToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) return res.status(400).json({ message: 'resetToken and newPassword are required.' });

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Token invalide ou expiré.' });
    }

    if (payload.purpose !== 'reset' || !payload.email) return res.status(400).json({ message: 'Token invalide.' });

    // Require jti for single-use tokens and verify it exists in DB
    if (!payload.jti) return res.status(400).json({ message: 'Token invalide.' });
    const stored = await ResetToken.findOne({ jti: payload.jti, email: payload.email });
    if (!stored) return res.status(400).json({ message: 'Token invalide ou déjà utilisé.' });

    const user = await User.findOne({ email: payload.email });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    user.password = newPassword;
    await user.save();

    // Consume the reset token so it cannot be reused
    await ResetToken.deleteOne({ jti: payload.jti });

    res.status(200).json({ status: 'success', message: 'Mot de passe réinitialisé avec succès.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

