const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const Device  = require('../models/deviceModel');
const Otp     = require('../models/otpModel');

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { sendEmail } = require('../utils/sendEmail');

const handleDeviceDetection = require('../utils/deviceDetection');

// Dummy hash — timing attack protection
const DUMMY_HASH = '$2b$12$LF2pOHq3PBnONQBFJMVnC.BbSNDTMRipqBR8eFoynF/BQDHpZIaWi';

// ═══════════════════════════════════════════════════════════════
// HELPER — Sauvegarder le JWT sur le device
// ═══════════════════════════════════════════════════════════════
const saveTokenOnDevice = async ({ userId, device, token }) => {
  const deviceToken = device?.deviceToken || `fallback-${Date.now()}`;

  await Device.findOneAndUpdate(
    { userId, deviceToken },
    {
      jwtToken:   token,
      lastUsed:   new Date(),
      isActive:   true,
      deviceName: device?.deviceName || 'Appareil inconnu',
      location:   device?.location   || 'Position inconnue'
    },
    { upsert: true, returnDocument: 'after' }
  );

  return deviceToken;
};

// ═══════════════════════════════════════════════════════════════
// HELPER — Fetch role data
// ═══════════════════════════════════════════════════════════════
const getRoleData = async (user) => {
  switch (user.role) {
    case 'teacher':
      return await Teacher.findOne({ id_enseignant: user.idmembre });
    case 'student':
      return await Student.findOne({ id_eleve: user.idmembre });
    case 'parent': {
      const parent = await Parent.findOne({ id_parent: user.idmembre }).populate('enfants');
      const child  = await Student.findOne({ id_parent: user.idmembre });
      return { parent, child };
    }
    case 'admin':
      return await Admin.findOne({ id_admin: user.idmembre });
    default:
      return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// SIGN IN — Utilisateurs (student, parent, teacher)
// POST /api/auth/signin
// ═══════════════════════════════════════════════════════════════
const signIn = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // 1. Validation
    if ((!email && !phone) || !password) {
      return res.status(400).json({
        status:  'fail',
        message: "Email/téléphone et mot de passe sont obligatoires."
      });
    }

    // 2. Build query
    const query = {};
    if (email) query.email       = email.trim().toLowerCase();
    if (phone) query.numberphone = phone.trim();

    // 3. Find user — exclude admin from this endpoint
    const user = await User.findOne({ ...query, role: { $ne: 'admin' } })
      .select('+password');

    // 4. Safe password comparison (timing attack protection)
    const hashToCompare  = user ? user.password : DUMMY_HASH;
    const passwordMatch  = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status:  'fail',
        message: "Email/téléphone ou mot de passe incorrect."
      });
    }

   

    // 6. Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    // 7. Device detection + save token
    let device = null;
    let isNewDevice = false;

    try {
      const deviceResult = await handleDeviceDetection({ user, req });
      device      = deviceResult?.device;
      isNewDevice = deviceResult?.isNewDevice;
    } catch (e) {
      console.error("Device detection error:", e.message);
    }

    const deviceToken = await saveTokenOnDevice({ userId: user._id, device, token });

    // 8. Role data
    const roleData = await getRoleData(user);

    // 9. Mask password
    user.password = undefined;

    return res.status(200).json({
      status:  'success',
      message: "Connexion réussie.",
      token,
      data: {
        user,
        details: roleData,
        device: {
          deviceToken,
          isNewDevice,
          lastUsed:   device?.lastUsed   || new Date(),
          deviceName: device?.deviceName || 'Appareil inconnu',
          location:   device?.location   || 'Position inconnue'
        }
      }
    });

  } catch (error) {
    console.error("signIn error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};

// ═══════════════════════════════════════════════════════════════
// SIGN IN ADMIN — Étape 1 : Email + Password → envoie OTP
// POST /api/auth/admin/signin
// Body: { email, password }
// ═══════════════════════════════════════════════════════════════
const signInAdminStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({
        status:  'fail',
        message: "Email et mot de passe sont obligatoires."
      });
    }

    // 2. Find admin uniquement
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role:  'admin'
    }).select('+password');

    // 3. Safe password comparison
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    // 4. Message générique — ne pas révéler si l'admin existe
    if (!user || !passwordMatch) {
      return res.status(401).json({
        status:  'fail',
        message: "Identifiants incorrects."
      });
    }

    // 5. Block deactivated admin
    if (!user.isActive) {
      return res.status(403).json({
        status:  'fail',
        message: "Compte désactivé."
      });
    }

    // 6. Générer OTP 6 chiffres
    const otp     = crypto.randomInt(100000, 999999).toString();
    const contact = user.email;

    // 7. Stocker l'OTP (5 minutes)
    await Otp.findOneAndUpdate(
      { identifier: contact, purpose: 'admin_signin' },
      { otp, createdAt: new Date() },
      { upsert: true }
    );

    // 8. Envoyer l'OTP par email
    try {
      await sendEmail({
        email:   contact,
        subject: " Code de vérification administrateur",
        message: `Votre code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.\n\nSi vous n'avez pas demandé cette connexion, ignorez ce message.`
      });
    } catch (emailError) {
      console.error("Admin OTP email error:", emailError.message);
      return res.status(500).json({
        status:  'error',
        message: "Impossible d'envoyer le code de vérification."
      });
    }

    return res.status(200).json({
      status:  'success',
      message: "Code de vérification envoyé sur votre email.",
      email:   contact.replace(/(.{3}).*@/, '$1***@') // masquer partiellement
    });

  } catch (error) {
    console.error("signInAdminStep1 error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};

// ═══════════════════════════════════════════════════════════════
// SIGN IN ADMIN — Étape 2 : Vérifier OTP → retourne JWT
// POST /api/auth/admin/verify-otp
// Body: { email, otp }
// ═══════════════════════════════════════════════════════════════
const signInAdminStep2 = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // 1. Validation
    if (!email || !otp) {
      return res.status(400).json({
        status:  'fail',
        message: "Email et code OTP sont obligatoires."
      });
    }

    // 2. Trouver l'admin
    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      role:  'admin'
    });

    if (!user) {
      return res.status(401).json({ status: 'fail', message: "Identifiants incorrects." });
    }

    // 3. Vérifier l'OTP
    const otpRecord = await Otp.findOne({
      identifier: user.email,
      purpose:    'admin_signin'
    });

    if (!otpRecord) {
      return res.status(401).json({
        status:  'fail',
        message: "Code expiré ou inexistant. Recommencez la connexion."
      });
    }

    // Vérifier expiration (5 minutes)
    const elapsed = Date.now() - new Date(otpRecord.createdAt).getTime();
    if (elapsed > 5 * 60 * 1000) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({
        status:  'fail',
        message: "Code expiré. Recommencez la connexion."
      });
    }

    if (otpRecord.otp !== otp.toString().trim()) {
      return res.status(401).json({
        status:  'fail',
        message: "Code incorrect."
      });
    }

    // 4. Supprimer l'OTP — usage unique
    await Otp.deleteOne({ _id: otpRecord._id });

    // 5. Générer JWT admin (durée courte — 8h)
    const token = jwt.sign(
      { id: user._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 6. Device detection + save token
    let device = null;
    let isNewDevice = false;

    try {
      const deviceResult = await handleDeviceDetection({ user, req });
      device      = deviceResult?.device;
      isNewDevice = deviceResult?.isNewDevice;
    } catch (e) {
      console.error("Device detection error:", e.message);
    }

    const deviceToken = await saveTokenOnDevice({ userId: user._id, device, token });

    // 7. Role data admin
    const adminData = await Admin.findOne({ id_admin: user.idmembre });

    // 8. Mask password
    user.password = undefined;

    // 9. Notification de connexion — fire and forget
    (async () => {
      try {
        await sendEmail({
          email:   user.email,
          subject: "✅ Nouvelle connexion administrateur",
          message: `Une connexion administrateur a été effectuée.\n\nAppareil : ${device?.deviceName || 'Inconnu'}\nLocalisation : ${device?.location || 'Inconnue'}\nDate : ${new Date().toLocaleString()}\n\nSi ce n'était pas vous, changez immédiatement votre mot de passe.`
        });
      } catch (e) {
        console.error("Admin login notification error:", e.message);
      }
    })();

    return res.status(200).json({
      status:  'success',
      message: "Connexion administrateur réussie.",
      token,
      data: {
        user,
        details: adminData,
        device: {
          deviceToken,
          isNewDevice,
          lastUsed:   device?.lastUsed   || new Date(),
          deviceName: device?.deviceName || 'Appareil inconnu',
          location:   device?.location   || 'Position inconnue'
        }
      }
    });

  } catch (error) {
    console.error("signInAdminStep2 error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};




// ═══════════════════════════════════════════════════════════════
// RESEND ADMIN OTP — Renvoie un nouveau code si l'ancien a expiré
// POST /api/auth/admin/resend-otp
// Body: { email }
// ═══════════════════════════════════════════════════════════════
const resendAdminOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: "L'adresse email est obligatoire."
      });
    }

    // 1. Vérifier que l'utilisateur est bien un admin et actif
    const user = await User.findOne({ 
      email: email.trim().toLowerCase(), 
      role: 'admin',
      isActive: true 
    });

    if (!user) {
      // Message générique pour la sécurité
      return res.status(200).json({
        status: 'success',
        message: "Si ce compte existe, un nouveau code a été envoyé."
      });
    }

    // 2. Générer un nouvel OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 3. Mettre à jour l'OTP en base (écrase le précédent)
    await Otp.findOneAndUpdate(
      { identifier: user.email, purpose: 'admin_signin' },
      { otp, createdAt: new Date() },
      { upsert: true }
    );

    // 4. Envoyer l'email
    try {
      await sendEmail({
        email: user.email,
        subject: "Nouveau code de vérification administrateur",
        message: `Votre nouveau code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.`
      });
    } catch (emailError) {
      return res.status(500).json({
        status: 'error',
        message: "Erreur lors de l'envoi de l'email."
      });
    }

    return res.status(200).json({
      status: 'success',
      message: "Un nouveau code a été envoyé sur votre email."
    });

  } catch (error) {
    console.error("resendAdminOtp error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};





module.exports = { 
  signIn, 
  signInAdminStep1, 
  signInAdminStep2, 
  resendAdminOtp 
};