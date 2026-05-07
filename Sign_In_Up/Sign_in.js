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
// HELPER — Sauvegarder le JWT sur le device (fire-and-forget)
// ═══════════════════════════════════════════════════════════════
const saveTokenOnDevice = ({ userId, device, token }) => {
  const deviceToken = device?.deviceToken || `fallback-${Date.now()}`;

  // ✅ OPTIMISATION : on ne bloque plus la réponse sur cette écriture DB
  Device.findOneAndUpdate(
    { userId, deviceToken },
    {
      jwtToken:   token,
      lastUsed:   new Date(),
      isActive:   true,
      deviceName: device?.deviceName || 'Appareil inconnu',
      location:   device?.location   || 'Position inconnue'
    },
    { upsert: true }
  ).catch(e => console.error("saveTokenOnDevice error:", e.message));

  return deviceToken; // retour synchrone — plus de await
};

// ═══════════════════════════════════════════════════════════════
// HELPER — Récupérer les données selon le rôle
// ✅ OPTIMISATION : .lean() sur toutes les queries + Promise.all pour parent
// ═══════════════════════════════════════════════════════════════
const getRoleData = (user) => {
  switch (user.role) {
    case 'teacher':
      return Teacher.findOne({ id_enseignant: user.idmembre }).lean();
    case 'student':
      return Student.findOne({ id_eleve: user.idmembre }).lean();
    case 'parent':
      // ✅ OPTIMISATION : 2 queries séquentielles → parallèles
      return Promise.all([
        Parent.findOne({ id_parent: user.idmembre }).populate('enfants').lean(),
        Student.findOne({ id_parent: user.idmembre }).lean()
      ]).then(([parent, child]) => ({ parent, child }));
    case 'admin':
      return Admin.findOne({ id_admin: user.idmembre }).lean();
    default:
      return Promise.resolve(null);
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
    // ✅ OPTIMISATION : select() minimal pour réduire les données transférées
    const user = await User.findOne({ ...query, role: { $ne: 'admin' } })
      .select('+password role idmembre isActive email numberphone');

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

    // ✅ OPTIMISATION MAJEURE : getRoleData + handleDeviceDetection en parallèle
    const [roleData, deviceResult] = await Promise.all([
      getRoleData(user),
      handleDeviceDetection({ user, req }).catch(e => {
        console.error("Device detection error:", e.message);
        return null;
      })
    ]);

    const device      = deviceResult?.device      ?? null;
    const isNewDevice = deviceResult?.isNewDevice ?? false;

    // ✅ OPTIMISATION : saveTokenOnDevice est fire-and-forget (non bloquant)
    const deviceToken = saveTokenOnDevice({ userId: user._id, device, token });

    // 7. Masquer le mot de passe
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
          lastUsed:   device?.lastUsed   ?? new Date(),
          deviceName: device?.deviceName ?? 'Appareil inconnu',
          location:   device?.location   ?? 'Position inconnue'
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

    // ✅ OPTIMISATION : user + existingOtp en parallèle
    const [user, existingOtp] = await Promise.all([
      User.findOne({ email: normalizedEmail, role: 'admin' })
        .select('+password isActive email'),
      Otp.findOne({ identifier: normalizedEmail, purpose: 'admin_signin' })
        .select('createdAt').lean()
    ]);

    // 2. Comparaison sécurisée (anti-timing attack)
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const passwordMatch = await bcrypt.compare(password, hashToCompare);

    if (!user || !passwordMatch) {
      return res.status(401).json({
        status:  'fail',
        message: "Identifiants incorrects."
      });
    }

    // 3. Vérifier que le compte est actif
    if (!user.isActive) {
      return res.status(403).json({
        status:  'fail',
        message: "Compte désactivé. Contactez le super-administrateur."
      });
    }

    // 4. Anti-spam : 1 minute entre chaque demande d'OTP
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60_000) {
        const remaining = Math.ceil((60_000 - elapsed) / 1000);
        return res.status(429).json({
          status:  'fail',
          message: `Veuillez attendre ${remaining} secondes avant de demander un nouveau code.`
        });
      }
    }

    // 5. Générer + stocker l'OTP en une seule opération
    const otp = crypto.randomInt(100000, 999999).toString();

    // ✅ OPTIMISATION : upsert + envoi email en parallèle
    await Promise.all([
      Otp.findOneAndUpdate(
        { identifier: user.email, purpose: 'admin_signin' },
        { otp, createdAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      sendEmail({
        email:   user.email,
        subject: "Code de vérification administrateur",
        message: `Votre code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.\n\nSi vous n'avez pas demandé cette connexion, ignorez ce message.`
      })
    ]).catch(err => {
      console.error("Admin OTP save/email error:", err.message);
      throw err; // rethrow pour le catch global
    });

    return res.status(200).json({
      status:  'success',
      message: "Code de vérification envoyé sur votre email.",
      email:   user.email.replace(/(.{3}).*@/, '$1***@')
    });

  } catch (error) {
    console.error("signInAdminStep1 error:", error.message);
    // Distinguer erreur d'envoi email vs erreur serveur générique
    const message = error.message?.includes('email')
      ? "Impossible d'envoyer le code de vérification. Réessayez."
      : "Erreur serveur.";
    return res.status(500).json({ status: 'error', message });
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

    // ✅ OPTIMISATION : user + otpRecord en parallèle
    const [user, otpRecord] = await Promise.all([
      User.findOne({ email: normalizedEmail, role: 'admin' })
        .select('isActive idmembre email'),
      Otp.findOne({ identifier: normalizedEmail, purpose: 'admin_signin' })
        .select('otp createdAt').lean()
    ]);

    if (!user) {
      return res.status(401).json({ status: 'fail', message: "Identifiants incorrects." });
    }
    if (!user.isActive) {
      return res.status(403).json({ status: 'fail', message: "Compte désactivé." });
    }
    if (!otpRecord) {
      return res.status(401).json({
        status:  'fail',
        message: "Code expiré ou inexistant. Recommencez la connexion."
      });
    }

    // 2. Vérifier l'expiration (5 minutes)
    const elapsed = Date.now() - new Date(otpRecord.createdAt).getTime();
    if (elapsed > 5 * 60_000) {
      // ✅ fire-and-forget : pas besoin d'attendre la suppression
      Otp.deleteOne({ _id: otpRecord._id }).catch(() => {});
      return res.status(401).json({
        status:  'fail',
        message: "Code expiré. Recommencez la connexion."
      });
    }

    // 3. Vérifier le code
    if (otpRecord.otp !== otp.toString().trim()) {
      return res.status(401).json({ status: 'fail', message: "Code incorrect." });
    }

    // 4. Générer JWT admin (8h)
    const token = jwt.sign(
      { id: user._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    // ✅ OPTIMISATION MAJEURE : suppression OTP + adminData + deviceDetection en parallèle
    const [, adminData, deviceResult] = await Promise.all([
      Otp.deleteOne({ _id: otpRecord._id }),
      Admin.findOne({ id_admin: user.idmembre }).lean(),
      handleDeviceDetection({ user, req }).catch(e => {
        console.error("Device detection error:", e.message);
        return null;
      })
    ]);

    const device      = deviceResult?.device      ?? null;
    const isNewDevice = deviceResult?.isNewDevice ?? false;

    // ✅ fire-and-forget : sauvegarde device non bloquante
    const deviceToken = saveTokenOnDevice({ userId: user._id, device, token });

    // ✅ Notification de connexion — fire-and-forget (inchangé, déjà correct)
    sendEmail({
      email:   user.email,
      subject: "Nouvelle connexion administrateur",
      message: `Une connexion administrateur a été effectuée.\n\nAppareil : ${device?.deviceName || 'Inconnu'}\nLocalisation : ${device?.location || 'Inconnue'}\nDate : ${new Date().toLocaleString()}\n\nSi ce n'était pas vous, changez immédiatement votre mot de passe.`
    }).catch(e => console.error("Admin login notification error:", e.message));

    user.password = undefined;

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
          lastUsed:   device?.lastUsed   ?? new Date(),
          deviceName: device?.deviceName ?? 'Appareil inconnu',
          location:   device?.location   ?? 'Position inconnue'
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

    // ✅ OPTIMISATION : user + existingOtp en parallèle
    const [user, existingOtp] = await Promise.all([
      User.findOne({ email: normalizedEmail, role: 'admin', isActive: true })
        .select('email').lean(),
      Otp.findOne({ identifier: normalizedEmail, purpose: 'admin_signin' })
        .select('createdAt').lean()
    ]);

    // Message générique si l'admin n'existe pas (sécurité)
    if (!user) {
      return res.status(200).json({
        status:  'success',
        message: "Si ce compte existe, un nouveau code a été envoyé."
      });
    }

    // Anti-spam : 1 minute entre chaque renvoi
    if (existingOtp) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < 60_000) {
        const remaining = Math.ceil((60_000 - elapsed) / 1000);
        return res.status(429).json({
          status:  'fail',
          message: `Veuillez attendre ${remaining} secondes avant de renvoyer un code.`
        });
      }
    }

    // Générer un nouvel OTP
    const otp = crypto.randomInt(100000, 999999).toString();

    // ✅ OPTIMISATION : upsert + envoi email en parallèle
    await Promise.all([
      Otp.findOneAndUpdate(
        { identifier: user.email, purpose: 'admin_signin' },
        { otp, createdAt: new Date() },
        { upsert: true, setDefaultsOnInsert: true }
      ),
      sendEmail({
        email:   user.email,
        subject: "Nouveau code de vérification administrateur",
        message: `Votre nouveau code de connexion administrateur : ${otp}\n\nValide pendant 5 minutes.\n\nSi vous n'avez pas demandé ce code, ignorez ce message.`
      })
    ]).catch(err => {
      console.error("resendAdminOtp save/email error:", err.message);
      throw err;
    });

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