
const Otp = require('../models/otpModel');
const User = require('../models/userModel');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../utils/sendEmail');
const ResetToken = require('../models/resetTokenModel');
const { v4: uuidv4 } = require('uuid');
const sendSms = require('../utils/sendSMS'); 

// --- Signup OTP (used during signup email verification) ---

const mongoose = require('mongoose');




exports.sendSignupOtp = async (req, res) => {
  try {
    // defensive: ensure JSON body was parsed
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('sendSignupOtp: empty request body or invalid JSON. content-type=', req.headers['content-type']);
      return res.status(400).json({ message: 'Body empty or invalid. Ensure Content-Type: application/json and a JSON body is sent.' });
    }

    const { email, phone } = req.body;

    if (!email && !phone) {
      return res.status(400).json({ message: "Veuillez fournir un email ou un numéro de téléphone." });
    }

    // basic format validation
    if (email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        console.error('sendSignupOtp: invalid email format', email);
        return res.status(400).json({ message: "Adresse email invalide." });
      }
    }
    if (phone) {
      const phoneRe = /^\+?[0-9]{6,15}$/;
      if (!phoneRe.test(phone)) {
        console.error('sendSignupOtp: invalid phone format', phone);
        return res.status(400).json({ message: "Numéro de téléphone invalide." });
      }
    }

    const identifier = email || phone;
    const purpose = 'signup';

    const existingUser = await User.findOne(email ? { email } : { phone });
    if (existingUser) {
      return res.status(400).json({ message: "Ce contact est déjà utilisé pour un compte existant." });
    }

    const existingOtp = await Otp.findOne({ identifier, purpose });

    if (existingOtp) {
      const lastCreated = new Date(existingOtp.createdAt).getTime();
      const now = Date.now();

      if (now - lastCreated < 60 * 1000) {
        return res.status(429).json({ message: "Veuillez attendre 1 minute avant de demander un nouveau code." });
      }
    }

    const newOtpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.findOneAndUpdate(
      { identifier, purpose },
      { identifier, purpose, otp: newOtpCode, createdAt: new Date() },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
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
      //add the optcode 
      status: 'success',
      message: `Code envoyé avec succès sur votre ${email ? 'email' : 'téléphone'} !
      Code : ${newOtpCode} `
  
      
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};exports.verifySignupOtp = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error('verifySignupOtp: empty body');
      return res.status(400).json({ message: 'Body empty or invalid.' });
    }

    let { email, phone, code } = req.body;

    email = email?.trim();
    phone = phone?.trim();
    code = code?.toString().trim();

    if (!email && !phone) {
      return res.status(400).json({ message: "Veuillez fournir l'email ou le téléphone." });
    }

    if (!code) {
      return res.status(400).json({ message: "Le code OTP est requis." });
    }

    // Email format validation
    if (email) {
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(email)) {
        return res.status(400).json({ message: "Adresse email invalide." });
      }
    }

    // Phone format validation
    if (phone) {
      const phoneRe = /^\+?[0-9]{6,15}$/;
      if (!phoneRe.test(phone)) {
        return res.status(400).json({ message: "Numéro de téléphone invalide." });
      }
    }

    const identifier = email || phone;
    const purpose = 'signup';

    const record = await Otp.findOne({ identifier, purpose });

    if (!record) {
      return res.status(400).json({ message: "Code expiré ou inexistant." });
    }

    if (record.otp !== code) {
      return res.status(400).json({ message: "Code incorrect." });
    }

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    const signupToken = jwt.sign(
      { field: email ? 'email' : 'phone', value: identifier },
      process.env.JWT_SECRET,
      { expiresIn: '20m' }
    );

    await Otp.deleteOne({ identifier, purpose });

    res.status(200).json({
      status: 'success',
      message: `${email ? 'Email' : 'Téléphone'} vérifié avec succès !`,
      signupToken
    });

  } catch (err) {
    console.error('verifySignupOtp error:', err);
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
    res.status(200).json({ status: 'success', message: 'Code de réinitialisation envoyé.' ,code:newOtpCode});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


exports.verifyResetOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    //check if email is entered
    if (!email) return res.status(400).json({ message: 'Veuillez fournir un email.' });
    //check if email is valid
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return res.status(400).json({ message: 'Adresse email invalide.' });
    //check if code is entered
    if (!code) return res.status(400).json({ message: 'Veuillez fournir un code.' });
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

