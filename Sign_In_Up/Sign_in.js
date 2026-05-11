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

const DUMMY_HASH = '$2b$12$LF2pOHq3PBnONQBFJMVnC.BbSNDTMRipqBR8eFoynF/BQDHpZIaWi';


// =====================
// HELPERS
// =====================

const normalizeEmail = (email) => email?.trim().toLowerCase();

const buildDumbCompare = async (user, password) => {
  const hash = user ? user.password : DUMMY_HASH;
  return bcrypt.compare(password, hash);
};

const generateOtp = () => crypto.randomInt(100000, 999999).toString();

const checkOtpCooldown = (otpRecord, seconds = 60) => {
  if (!otpRecord) return null;
  const elapsed = Date.now() - new Date(otpRecord.createdAt).getTime();
  if (elapsed < seconds * 1000) {
    return Math.ceil((seconds * 1000 - elapsed) / 1000);
  }
  return null;
};

const upsertOtp = async (identifier, purpose, otp) => {
  await Otp.findOneAndUpdate(
    { identifier, purpose },
    { otp, createdAt: new Date() },
    { upsert: true }
  );
};

const saveTokenOnDevice = async ({ userId, device, token }) => {
  const deviceToken = device?.deviceToken || `fallback-${Date.now()}`;

  await Device.findOneAndUpdate(
    { userId, deviceToken },
    {
      jwtToken: token,
      lastUsed: new Date(),
      isActive: true,
      deviceName: device?.deviceName || 'Appareil inconnu',
      location: device?.location || 'Position inconnue'
    },
    { upsert: true }
  );

  return deviceToken;
};

const safeDeviceSave = async (user, req, token) => {
  let device = null;
  let isNewDevice = false;

  try {
    const result = await handleDeviceDetection({ user, req });
    device = result?.device;
    isNewDevice = result?.isNewDevice;
  } catch (e) {
    console.error("Device detection error:", e.message);
  }

  const deviceToken = await saveTokenOnDevice({
    userId: user._id,
    device,
    token
  });

  return { device, isNewDevice, deviceToken };
};

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


// =====================
// USER SIGN IN
// =====================

const signIn = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    if ((!email && !phone) || !password) {
      return res.status(400).json({
        status: 'fail',
        message: "Email/téléphone et mot de passe sont obligatoires."
      });
    }

    const query = {};
    if (email) query.email = normalizeEmail(email);
    if (phone) query.numberphone = phone.trim();

    const user = await User.findOne({
      ...query,
      role: { $ne: 'admin' }
    }).select('+password');

    const passwordMatch = await buildDumbCompare(user, password);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status: 'fail',
        message: "Email/téléphone ou mot de passe incorrect."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: 'fail',
        message: "Votre compte est désactivé. Contactez l'administrateur."
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '90d' }
    );

    const { device, isNewDevice, deviceToken } =
      await safeDeviceSave(user, req, token);

    const roleData = await getRoleData(user);
    user.password = undefined;

    // Add city to roleData if available
    if (roleData) {
      if (roleData?.city) {
        // For teacher or other roles that have city directly
        roleData.city = roleData.city;
      } else if (roleData?.parent?.city) {
        // For parent role, include city from parent
        roleData.city = roleData.parent.city;
      }
    }
    // Add wilaya to roleData if available
    if (roleData) {
      if (roleData?.wilaya) {
        // For teacher or other roles that have wilaya directly
        roleData.wilaya = roleData.wilaya;
      } else if (roleData?.parent?.wilaya) {
        // For parent role, include wilaya from parent
        roleData.wilaya = roleData.parent.wilaya;
      }
    }

    return res.status(200).json({
      status: 'success',
      message: "Connexion réussie.",
      token,
      data: {
        user,
        details: roleData,
        device: {
          deviceToken,
          isNewDevice,
          lastUsed: device?.lastUsed || new Date(),
          deviceName: device?.deviceName || 'Appareil inconnu',
          location: device?.location || 'Position inconnue'
        }
      }
    });

  } catch (error) {
    console.error("signIn error:", error.message);
    return res.status(500).json({
      status: 'error',
      message: "Erreur serveur."
    });
  }
};


// =====================
// ADMIN STEP 1
// =====================

const signInAdminStep1 = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: "Email et mot de passe sont obligatoires."
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'admin'
    }).select('+password');

    const passwordMatch = await buildDumbCompare(user, password);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status: 'fail',
        message: "Identifiants incorrects."
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: 'fail',
        message: "Compte désactivé. Contactez le super-administrateur."
      });
    }

    const existingOtp = await Otp.findOne({
      identifier: user.email,
      purpose: 'admin_signin'
    });

    const cooldown = checkOtpCooldown(existingOtp);
    if (cooldown) {
      return res.status(429).json({
        status: 'fail',
        message: `Veuillez attendre ${cooldown} secondes avant de demander un nouveau code.`
      });
    }

    const otp = generateOtp();

    await upsertOtp(user.email, 'admin_signin', otp);

    try {
      await sendEmail({
        email: user.email,
        subject: "Code de vérification administrateur",
        message: `Votre code : ${otp}`
      });
    } catch (e) {
      return res.status(500).json({
        status: 'error',
        message: "Impossible d'envoyer le code de vérification. Réessayez."
      });
    }

    return res.status(200).json({
      status: 'success',
      message: "Code de vérification envoyé sur votre email.",
      email: user.email.replace(/(.{3}).*@/, "$1***@")
    });

  } catch (error) {
    console.error("signInAdminStep1 error:", error.message);
    return res.status(500).json({
      status: 'error',
      message: "Erreur serveur."
    });
  }
};


// =====================
// ADMIN STEP 2
// =====================

const signInAdminStep2 = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        status: 'fail',
        message: "Email et code OTP sont obligatoires."
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'admin'
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        status: 'fail',
        message: "Identifiants incorrects."
      });
    }

    const otpRecord = await Otp.findOne({
      identifier: user.email,
      purpose: 'admin_signin'
    });

    if (!otpRecord) {
      return res.status(401).json({
        status: 'fail',
        message: "Code expiré ou inexistant. Recommencez la connexion."
      });
    }

    const elapsed = Date.now() - new Date(otpRecord.createdAt).getTime();

    if (elapsed > 5 * 60 * 1000) {
      await Otp.deleteOne({ _id: otpRecord._id });
      return res.status(401).json({
        status: 'fail',
        message: "Code expiré. Recommencez la connexion."
      });
    }

    if (otpRecord.otp !== otp.toString().trim()) {
      return res.status(401).json({
        status: 'fail',
        message: "Code incorrect."
      });
    }

    await Otp.deleteOne({ _id: otpRecord._id });

    const token = jwt.sign(
      { id: user._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    const { device, isNewDevice, deviceToken } =
      await safeDeviceSave(user, req, token);

    const adminData = await Admin.findOne({ id_admin: user.idmembre });

    user.password = undefined;

    (async () => {
      try {
        await sendEmail({
          email: user.email,
          subject: "Nouvelle connexion administrateur",
          message: `Connexion détectée. Appareil: ${device?.deviceName || 'Inconnu'}`
        });
      } catch (e) {}
    })();

    return res.status(200).json({
      status: 'success',
      message: "Connexion administrateur réussie.",
      token,
      data: {
        user,
        details: adminData,
        device: {
          deviceToken,
          isNewDevice,
          lastUsed: device?.lastUsed || new Date(),
          deviceName: device?.deviceName || 'Appareil inconnu',
          location: device?.location || 'Position inconnue'
        }
      }
    });

  } catch (error) {
    console.error("signInAdminStep2 error:", error.message);
    return res.status(500).json({
      status: 'error',
      message: "Erreur serveur."
    });
  }
};


// =====================
// RESEND OTP
// =====================

const resendAdminOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: 'fail',
        message: "L'adresse email est obligatoire."
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'admin',
      isActive: true
    });

    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: "Si ce compte existe, un nouveau code a été envoyé."
      });
    }

    const existingOtp = await Otp.findOne({
      identifier: user.email,
      purpose: 'admin_signin'
    });

    const cooldown = checkOtpCooldown(existingOtp);
    if (cooldown) {
      return res.status(429).json({
        status: 'fail',
        message: `Veuillez attendre ${cooldown} secondes avant de renvoyer un code.`
      });
    }

    const otp = generateOtp();
    await upsertOtp(user.email, 'admin_signin', otp);

    await sendEmail({
      email: user.email,
      subject: "Nouveau code de vérification administrateur",
      message: `Code : ${otp}`
    });

    return res.status(200).json({
      status: 'success',
      message: "Un nouveau code a été envoyé sur votre email.",
      email: user.email.replace(/(.{3}).*@/, "$1***@")
    });

  } catch (error) {
    console.error("resendAdminOtp error:", error.message);
    return res.status(500).json({
      status: 'error',
      message: "Erreur serveur."
    });
  }
};


module.exports = {
  signIn,
  signInAdminStep1,
  signInAdminStep2,
  resendAdminOtp
};