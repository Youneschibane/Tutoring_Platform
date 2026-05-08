const Otp          = require('../models/otpModel');
const User         = require('../models/userModel');
const ResetToken   = require('../models/resetTokenModel');

const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('../utils/sendEmail');
const sendSms  = require('../utils/sendSMS');

// ─────────────────────────────────────────────────────────────────────────────
// 1. SIGNUP FLOW
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

    // ── Normalisation + validation format ──
    if (email) {
      email = email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: "Adresse email invalide." });
      }
    }

    if (phone) {
      phone = phone.trim();
      if (!/^\+?[0-9]{6,15}$/.test(phone)) {
        return res.status(400).json({ message: "Numéro de téléphone invalide." });
      }
    }

    const otpTarget = email || phone;
    const purpose   = 'signup';

    // ✅ OPTIMISATION : existence check + anti-spam OTP en parallèle
    // Les deux sont des lectures indépendantes
    const checks = [];
    if (email) checks.push(User.findOne({ email }).select('_id').lean());
    if (phone) checks.push(User.findOne({ numberphone: phone }).select('_id').lean());
    checks.push(Otp.findOne({ identifier: otpTarget, purpose }).select('createdAt').lean());

    const results     = await Promise.all(checks);
    const existingOtp = results[results.length - 1]; // toujours le dernier

    if (email && results[0]) {
      return res.status(400).json({ message: "Cet email est déjà utilisé." });
    }
    if (phone && results[email ? 1 : 0]) {
      return res.status(400).json({ message: "Ce numéro de téléphone est déjà utilisé." });
    }

    // Anti-spam
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60_000) {
        return res.status(429).json({ message: "Veuillez attendre 1 minute avant de demander un nouveau code." });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ OPTIMISATION : upsert + envoi en parallèle
    await Promise.all([
      Otp.findOneAndUpdate(
        { identifier: otpTarget, purpose },
        { identifier: otpTarget, purpose, otp: newOtpCode, createdAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      email
        ? sendEmail({
            email,
            subject: 'Votre code de vérification',
            message: `Votre code de vérification est : ${newOtpCode}.\n Il est valide 10 minutes.`
          })
        : sendSms({
            phone,
            message: `Votre code de vérification PRJP10 est : ${newOtpCode}.`
          })
    ]);

    return res.status(200).json({
      status:  'success',
      message: `Code envoyé avec succès sur votre ${email ? 'email' : 'téléphone'} !`,
      // code: newOtpCode  ← retirer en production
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

    const record = await Otp.findOne({ identifier: otpTarget, purpose: 'signup' })
      .select('otp').lean();

    if (!record)             return res.status(400).json({ message: "Code expiré ou inexistant." });
    if (record.otp !== cleanCode) return res.status(400).json({ message: "Code incorrect." });

    // Générer le signup token
    const signupToken = jwt.sign(
      {
        email: email ? email.toLowerCase().trim() : null,
        phone: phone ? phone.trim() : null
      },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    // ✅ OPTIMISATION : suppression OTP fire-and-forget — le token est déjà émis
    Otp.deleteOne({ identifier: otpTarget, purpose: 'signup' })
      .catch(e => console.error("OTP cleanup error:", e.message));

    return res.status(200).json({
      status:  'success',
      message: "Vérification réussie !",
      signupToken
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PASSWORD RESET FLOW
// ─────────────────────────────────────────────────────────────────────────────

exports.sendResetOtp = async (req, res) => {
  try {
    let { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Veuillez fournir un email.' });

    email = email.toLowerCase().trim();

    // ✅ OPTIMISATION : user + existingOtp en parallèle
    const [user, existingOtp] = await Promise.all([
      User.findOne({ email }).select('_id').lean(),
      Otp.findOne({ identifier: email, purpose: 'reset' }).select('createdAt').lean()
    ]);

    if (!user) {
      return res.status(404).json({ status: 'fail', message: 'Utilisateur introuvable.' });
    }

    // Anti-spam
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60_000) {
        return res.status(429).json({ message: 'Veuillez attendre 1 minute avant un nouvel envoi.' });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // ✅ OPTIMISATION : upsert + envoi email en parallèle
    await Promise.all([
      Otp.findOneAndUpdate(
        { identifier: email, purpose: 'reset' },
        { identifier: email, purpose: 'reset', otp: newOtpCode, createdAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      sendEmail({
        email,
        subject: 'Code de réinitialisation de mot de passe',
        message: `Votre code de réinitialisation est : ${newOtpCode}`
      })
    ]);

    return res.status(200).json({
      status:  'success',
      message: 'Code envoyé par email.',
      // code: newOtpCode  ← retirer en production
    });

  } catch (err) {
    console.error("sendResetOtp Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

exports.verifyResetOtp = async (req, res) => {
  try {
    let { email, code } = req.body;

    if (!email || !code) return res.status(400).json({ message: 'Email et code requis.' });

    email = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    const record = await Otp.findOne({ identifier: email, purpose: 'reset' })
      .select('otp').lean();

    if (!record)                  return res.status(400).json({ message: 'Code expiré ou demande inexistante.' });
    if (record.otp !== cleanCode) return res.status(400).json({ message: 'Code incorrect.' });

    const jti = uuidv4();
    const resetToken = jwt.sign(
      { email, purpose: 'reset', jti },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // ✅ OPTIMISATION : création ResetToken + suppression OTP en parallèle
    await Promise.all([
      ResetToken.create({ jti, email, createdAt: new Date() }),
      Otp.deleteOne({ identifier: email, purpose: 'reset' })
    ]);

    return res.status(200).json({ status: 'success', resetToken });

  } catch (err) {
    return res.status(500).json({ error: err.message });
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
    } catch {
      return res.status(400).json({ message: 'Le token est invalide ou a expiré.' });
    }

    if (payload.purpose !== 'reset' || !payload.email || !payload.jti) {
      return res.status(400).json({ message: 'Token de réinitialisation non conforme.' });
    }

    // ✅ OPTIMISATION : vérification JTI + récupération user en parallèle
    const [storedToken, user] = await Promise.all([
      ResetToken.findOne({ jti: payload.jti, email: payload.email }).select('_id').lean(),
      User.findOne({ email: payload.email }).select('password')
    ]);

    if (!storedToken) {
      return res.status(400).json({ message: 'Ce lien a déjà été utilisé ou est invalide.' });
    }
    if (!user) {
      return res.status(404).json({ message: 'Utilisateur introuvable.' });
    }

    // Mise à jour du mot de passe (hashage via middleware pre-save)
    user.password = newPassword;
    await user.save();

    // ✅ OPTIMISATION : suppression ResetToken fire-and-forget
    ResetToken.deleteOne({ jti: payload.jti })
      .catch(e => console.error("ResetToken cleanup error:", e.message));

    return res.status(200).json({
      status:  'success',
      message: 'Votre mot de passe a été réinitialisé.'
    });

  } catch (err) {
    console.error("resetPassword Error:", err);
    return res.status(500).json({ error: err.message });
  }
};