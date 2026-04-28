const Otp = require('../models/otpModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');
const ResetToken = require('../models/resetTokenModel');
const { v4: uuidv4 } = require('uuid');
const sendSms = require('../utils/sendSMS'); 
const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// 1. SIGNUP FLOW (Inscription)
// ─────────────────────────────────────────────────────────────────────────────

exports.sendSignupOtp = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ message: 'Le corps de la requête est vide.' });
    }

    let { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Veuillez fournir un email ou un numéro de téléphone." });
    }

    // Normalisation et Validation Email
    if (email) {
      email = email.toLowerCase().trim();
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) return res.status(400).json({ message: "Adresse email invalide." });
      
      const existingEmail = await User.findOne({ email });
      if (existingEmail) return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }

    // Validation Téléphone
    if (phone) {
      phone = phone.trim();
      const phoneRe = /^\+?[0-9]{6,15}$/;
      if (!phoneRe.test(phone)) return res.status(400).json({ message: "Numéro de téléphone invalide." });

      const existingPhone = await User.findOne({ numberphone: phone });
      if (existingPhone) return res.status(400).json({ message: "Ce numéro de téléphone est déjà utilisé." });
    }

    const otpTarget = email || phone;
    const purpose = 'signup';

    // Anti-spam : 1 minute entre chaque code
    const existingOtp = await Otp.findOne({ identifier: otpTarget, purpose });
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60 * 1000) {
        return res.status(429).json({ message: "Veuillez attendre 1 minute avant de demander un nouveau code." });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { identifier: otpTarget, purpose },
      { identifier: otpTarget, purpose, otp: newOtpCode, createdAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    if (email) {
      await sendEmail({
        email,
        subject: 'Votre code de vérification',
        message: `Votre code de vérification est : ${newOtpCode}. Il est valide 10 minutes.`
      });
    } else {
      await sendSms({
        phone,
        message: `Votre code de vérification PRJP10 est : ${newOtpCode}.`
      });
    }

    return res.status(200).json({
      status: 'success',
      message: `Code envoyé avec succès sur votre ${email ? 'email' : 'téléphone'} !`,
      code: newOtpCode // À retirer en production
    });

  } catch (err) {
    console.error("sendSignupOtp Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.verifySignupOtp = async (req, res) => {
  try {
    let { email, phone, code } = req.body;
    
    const otpTarget = email ? email.toLowerCase().trim() : phone?.trim();
    const cleanCode = code?.toString().trim();

    if (!otpTarget) return res.status(400).json({ message: "Email ou téléphone manquant." });
    if (!cleanCode) return res.status(400).json({ message: "Le code OTP est requis." });

    const record = await Otp.findOne({ identifier: otpTarget, purpose: 'signup' });
    
    if (!record) return res.status(400).json({ message: "Code expiré ou inexistant." });
    if (record.otp !== cleanCode) return res.status(400).json({ message: "Code incorrect." });

    // Création du token temporaire pour finaliser l'inscription
    const signupToken = jwt.sign(
      { email: email ? email.toLowerCase().trim() : null, phone: phone ? phone.trim() : null },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    await Otp.deleteOne({ identifier: otpTarget, purpose: 'signup' });

    return res.status(200).json({
      status: 'success',
      message: "Vérification réussie !",
      signupToken
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PASSWORD RESET FLOW (Réinitialisation Mot de Passe)
// ─────────────────────────────────────────────────────────────────────────────

exports.sendResetOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Veuillez fournir un email.' });

    // NORMALISATION : Crucial pour éviter le "Utilisateur introuvable"
    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
    }

    // Vérification de la limite de temps (1 min)
    const existingOtp = await Otp.findOne({ identifier: email, purpose: 'reset' });
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60 * 1000) {
        return res.status(429).json({ message: 'Veuillez attendre 1 minute avant un nouvel envoi.' });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    await Otp.findOneAndUpdate(
      { identifier: email, purpose: 'reset' },
      { identifier: email, purpose: 'reset', otp: newOtpCode, createdAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    await sendEmail({ 
      email, 
      subject: 'Code de réinitialisation de mot de passe', 
      message: `Votre code de réinitialisation est : ${newOtpCode}` 
    });

    res.status(200).json({ 
      status: 'success', 
      message: 'Code envoyé par email.', 
      code: newOtpCode // À retirer en production
    });
  } catch (err) {
    console.error("sendResetOtp Error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    let { email, code } = req.body;
    
    if (!email || !code) return res.status(400).json({ message: 'Email et code requis.' });

    email = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = await Otp.findOne({ identifier: email, purpose: 'reset' });
    if (!record) return res.status(400).json({ message: 'Code expiré ou demande inexistante.' });
    if (record.otp !== cleanCode) return res.status(400).json({ message: 'Code incorrect.' });

    // Génération d'un JTI (ID unique) pour rendre le token à usage unique
    const jti = uuidv4();
    const resetToken = jwt.sign(
      { email, purpose: 'reset', jti }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    // On enregistre ce JTI en base pour le valider lors du reset final
    await ResetToken.create({ jti, email, createdAt: new Date() });
    
    // On supprime l'OTP car il a servi
    await Otp.deleteOne({ identifier: email, purpose: 'reset' });

    res.status(200).json({ status: 'success', resetToken });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Token et nouveau mot de passe requis.' });
    }

    let payload;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ message: 'Le token est invalide ou a expiré.' });
    }

    // Vérification de l'intégrité du token
    if (payload.purpose !== 'reset' || !payload.email || !payload.jti) {
      return res.status(400).json({ message: 'Token de réinitialisation non conforme.' });
    }

    // Vérification de l'usage unique (JTI en base de données)
    const storedToken = await ResetToken.findOne({ jti: payload.jti, email: payload.email });
    if (!storedToken) {
      return res.status(400).json({ message: 'Ce lien a déjà été utilisé ou est invalide.' });
    }

    const user = await User.findOne({ email: payload.email });
    if (!user) return res.status(404).json({ message: 'Utilisateur introuvable.' });

    // Mise à jour du mot de passe (le middleware 'pre save' s'occupera du hashage)
    user.password = newPassword;
    await user.save();

    // Suppression du JTI pour empêcher toute réutilisation
    await ResetToken.deleteOne({ jti: payload.jti });

    res.status(200).json({ status: 'success', message: 'Votre mot de passe a été réinitialisé.' });
  } catch (err) {
    console.error("resetPassword Error:", err);
    res.status(500).json({ error: err.message });
  }
};