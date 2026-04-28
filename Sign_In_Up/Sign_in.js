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

// Dummy hash — protection contre les timing attacks
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
// HELPER — Récupérer les données selon le rôle
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
// Body: { email | phone, password }
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

    // 2. Construire la query
    const query = {};
    if (email) query.email       = email.trim().toLowerCase();
    if (phone) query.numberphone = phone.trim();

    // 3. Trouver l'utilisateur — exclure les admins
    const user = await User.findOne({ ...query, role: { $ne: 'admin' } })
      .select('+password');

    // 4. Comparaison sécurisée (anti-timing attack)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status:  'fail',
        message: "Email/téléphone ou mot de passe incorrect."
      });
    }

    // 5. Vérifier que le compte est actif
    if (!user.isActive) {
      return res.status(403).json({
        status:  'fail',
        message: "Votre compte est désactivé. Contactez l'administrateur."
      });
    }

    // 6. Générer le JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    // 7. Détection device + sauvegarde token
    let device      = null;
    let isNewDevice = false;

    try {
      const deviceResult = await handleDeviceDetection({ user, req });
      device      = deviceResult?.device;
      isNewDevice = deviceResult?.isNewDevice;
    } catch (e) {
      console.error("Device detection error:", e.message);
    }

    const deviceToken = await saveTokenOnDevice({ userId: user._id, device, token });

    // 8. Données du rôle
    const roleData = await getRoleData(user);

    // 9. Masquer le mot de passe
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

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Trouver l'admin uniquement
    const user = await User.findOne({
      email: normalizedEmail,
      role:  'admin'
    }).select('+password');

    // 3. Comparaison sécurisée (anti-timing attack)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    // 4. Message générique — ne pas révéler si le compte existe
    if (!user || !passwordMatch) {
      return res.status(401).json({
        status:  'fail',
        message: "Identifiants incorrects."
      });
    }

    // 5. Vérifier que le compte est actif
    if (!user.isActive) {
      return res.status(403).json({
        status:  'fail',
        message: "Compte désactivé. Contactez le super-administrateur."
      });
    }

    // 6. Anti-spam : 1 minute entre chaque demande d'OTP
    const existingOtp = await Otp.findOne({
      identifier: user.email,
      purpose:    'admin_signin'
    });

    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - elapsed) / 1000);
        return res.status(429).json({
          status:  'fail',
          message: `Veuillez attendre ${remaining} secondes avant de demander un nouveau code.`
        });
      }
    }

    // 7. Générer OTP 6 chiffres
    const otp = crypto.randomInt(100000, 999999).toString();

    // 8. Stocker l'OTP (écrase l'ancien)
    await Otp.findOneAndUpdate(
      { identifier: user.email, purpose: 'admin_signin' },
      { otp, createdAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // 9. Envoyer l'OTP par email
    try {
      await sendEmail({
        email:   user.email,
        subject: "Code de vérification administrateur",
        message: `Votre code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.\n\nSi vous n'avez pas demandé cette connexion, ignorez ce message.`
      });
    } catch (emailError) {
      console.error("Admin OTP email error:", emailError.message);
      return res.status(500).json({
        status:  'error',
        message: "Impossible d'envoyer le code de vérification. Réessayez."
      });
    }

    return res.status(200).json({
      status:  'success',
      message: "Code de vérification envoyé sur votre email.",
      email:   user.email.replace(/(.{3}).*@/, '$1***@') // masquage partiel
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

    const normalizedEmail = email.trim().toLowerCase();

    // 2. Trouver l'admin
    const user = await User.findOne({
      email: normalizedEmail,
      role:  'admin'
    });

    if (!user) {
      return res.status(401).json({
        status:  'fail',
        message: "Identifiants incorrects."
      });
    }

    // 3. Vérifier que le compte est toujours actif
    if (!user.isActive) {
      return res.status(403).json({
        status:  'fail',
        message: "Compte désactivé."
      });
    }

    // 4. Récupérer l'OTP en base
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

    // 5. Vérifier l'expiration (5 minutes)
    const elapsed = Date.now() - new Date(otpRecord.createdAt).getTime();
    if (elapsed > 5 * 60 * 1000) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({
        status:  'fail',
        message: "Code expiré. Recommencez la connexion."
      });
    }

    // 6. Vérifier le code
    if (otpRecord.otp !== otp.toString().trim()) {
      return res.status(401).json({
        status:  'fail',
        message: "Code incorrect."
      });
    }

    // 7. Supprimer l'OTP — usage unique
    await Otp.deleteOne({ _id: otpRecord._id });

    // 8. Générer JWT admin (8h)
    const token = jwt.sign(
      { id: user._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 9. Détection device + sauvegarde token
    let device      = null;
    let isNewDevice = false;

    try {
      const deviceResult = await handleDeviceDetection({ user, req });
      device      = deviceResult?.device;
      isNewDevice = deviceResult?.isNewDevice;
    } catch (e) {
      console.error("Device detection error:", e.message);
    }

    const deviceToken = await saveTokenOnDevice({ userId: user._id, device, token });

    // 10. Données admin
    const adminData = await Admin.findOne({ id_admin: user.idmembre });

    // 11. Masquer le mot de passe
    user.password = undefined;

    // 12. Notification de connexion — fire and forget
    (async () => {
      try {
        await sendEmail({
          email:   user.email,
          subject: "Nouvelle connexion administrateur",
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
// RESEND ADMIN OTP — Renvoie un nouveau code
// POST /api/auth/admin/resend-otp
// Body: { email }
// ═══════════════════════════════════════════════════════════════
const resendAdminOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status:  'fail',
        message: "L'adresse email est obligatoire."
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 1. Vérifier que l'admin existe et est actif
    const user = await User.findOne({
      email:    normalizedEmail,
      role:     'admin',
      isActive: true
    });

    // Message générique si l'admin n'existe pas (sécurité)
    if (!user) {
      return res.status(200).json({
        status:  'success',
        message: "Si ce compte existe, un nouveau code a été envoyé."
      });
    }

    // 2. Anti-spam : 1 minute entre chaque renvoi
    const existingOtp = await Otp.findOne({
      identifier: user.email,
      purpose:    'admin_signin'
    });

    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60 * 1000) {
        const remaining = Math.ceil((60 * 1000 - elapsed) / 1000);
        return res.status(429).json({
          status:  'fail',
          message: `Veuillez attendre ${remaining} secondes avant de renvoyer un code.`
        });
      }
    }

    // 3. Générer un nouvel OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // 4. Mettre à jour l'OTP en base (écrase le précédent)
    await Otp.findOneAndUpdate(
      { identifier: user.email, purpose: 'admin_signin' },
      { otp, createdAt: new Date() },
      { upsert: true, setDefaultsOnInsert: true }
    );

    // 5. Envoyer l'email
    try {
      await sendEmail({
        email:   user.email,
        subject: "Nouveau code de vérification administrateur",
        message: `Votre nouveau code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`
      });
    } catch (emailError) {
      console.error("resendAdminOtp email error:", emailError.message);
      return res.status(500).json({
        status:  'error',
        message: "Erreur lors de l'envoi de l'email. Réessayez."
      });
    }

    return res.status(200).json({
      status:  'success',
      message: "Un nouveau code a été envoyé sur votre email.",
      email:   user.email.replace(/(.{3}).*@/, '$1***@')
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