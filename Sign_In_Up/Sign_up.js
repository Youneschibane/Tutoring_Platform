const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const Device  = require('../models/deviceModel');
const { notifyAdmin } = require('../controllers/notificationService');

const cloudinary = require('../Config/cloudinaryConfig.js');
const getNextId  = require('../generateID/nextID');

const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const geoip    = require('geoip-lite');

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// Rollback tous les fichiers uploadés sur Cloudinary en cas d'erreur
const rollbackCloudinaryFiles = async (ids = []) => {
  await Promise.allSettled(
    ids.map(id => cloudinary.uploader.destroy(id))
  );
};

// Parser JSON sécurisé pour les champs multipart
const safeJSON = (value, errorMsg) => {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      throw new Error(errorMsg);
    }
  }
  return value;
};

// Créer et enregistrer le device + JWT après inscription
const createDevice = async (user, req) => {
  const ip = req.ip || '';
  const ua = req.get('User-Agent') || '';

  const parser     = new UAParser(ua);
  const deviceName = `${parser.getBrowser().name || 'Unknown'} on ${parser.getOS().name || 'Unknown'}`;
  const geo        = geoip.lookup(ip);

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '90d' }
  );

  const device = await Device.create({
    userId:      user._id,
    deviceToken: uuidv4(),
    jwtToken:    token,
    userAgent:   ua,
    ipAddress:   ip,
    deviceName,
    location:    geo?.country || 'Unknown',
    isActive:    true,
    lastUsed:    new Date()
  });

  return { device, token };
};

// ═══════════════════════════════════════════════════════════════
// COMPLETE PROFILE
// ═══════════════════════════════════════════════════════════════
exports.completeProfile = async (req, res) => {
  let session;
  const uploaded = []; // Tracker pour rollback Cloudinary

  try {
    session = await mongoose.startSession();
    session.startTransaction();

    const {
      signupToken,
      password,
      role,
      firstname,
      familyname,
      postaladr,
      ...profileData
    } = req.body;

    // ─────────────────────────────────────────
    // 1. VALIDATION CHAMPS OBLIGATOIRES
    // ─────────────────────────────────────────
    if (!signupToken || !password || !role || !firstname || !familyname || !postaladr) {
      throw new Error("Missing required fields.");
    }

    const validRoles = ['parent', 'student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) throw new Error("Invalid role.");

    // ─────────────────────────────────────────
    // 2. PARSE CHAMPS JSON (multipart/form-data)
    // subjects et children arrivent en String JSON
    // ─────────────────────────────────────────
    profileData.subjects = safeJSON(profileData.subjects, "Invalid subjects format.");
    profileData.children = safeJSON(profileData.children, "Invalid children format.");

    // ─────────────────────────────────────────
    // 3. VÉRIFIER ET DÉCODER LE SIGNUP TOKEN
    // ─────────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired token.");
    }

    // ─────────────────────────────────────────
    // 4. CONSTRUIRE LE CONTACT — email + phone
    // Les deux peuvent être présents simultanément
    // ─────────────────────────────────────────
    const contact = {};
    if (decoded.email) contact.email       = decoded.email;
    if (decoded.phone) contact.numberphone = decoded.phone;

    if (Object.keys(contact).length === 0) {
      throw new Error("Token invalide — aucun contact trouvé.");
    }

    // ─────────────────────────────────────────
    // 5. VÉRIFIER QUE LE USER N'EXISTE PAS DÉJÀ
    // ─────────────────────────────────────────
    const orConditions = [
      ...(decoded.email ? [{ email:       decoded.email }] : []),
      ...(decoded.phone ? [{ numberphone: decoded.phone }] : [])
    ];

    const exists = await User.findOne({ $or: orConditions }).session(session);
    if (exists) throw new Error("User already exists.");

    // ─────────────────────────────────────────
    // 6. EXTRACTION DES FICHIERS CLOUDINARY
    // ─────────────────────────────────────────

    // Photo de profil — tous les rôles (optionnel)
    const photoFile      = req.files?.photo_profil?.[0] || null;
    const photoProfilUrl = photoFile?.path || null;
    if (photoFile?.filename) uploaded.push(photoFile.filename);

    // CV — teacher uniquement (obligatoire)
    const cvFile = req.files?.cv?.[0] || null;
    if (cvFile?.filename) uploaded.push(cvFile.filename);

    const cv = cvFile ? {
      url:        cvFile.path,
      publicId:   cvFile.filename,
      uploadedAt: new Date()
    } : null;

    // Diplômes — teacher uniquement (min 1 obligatoire)
    const diplomes = (req.files?.diplomes || []).map((f, i) => {
      uploaded.push(f.filename);
      return {
        url:        f.path,
        publicId:   f.filename,
        nom:        profileData[`diplome_nom_${i}`] || null,
        uploadedAt: new Date()
      };
    });

    // ─────────────────────────────────────────
    // 7. CRÉER LE USER
    // ─────────────────────────────────────────
    const idmembre = await getNextId('user');

    const newUser = await User.create([{
      firstname,
      familyname,
      postaladr,
      password,
      role,
      idmembre,
      isVerified:   true,
      isActive:     true,
      photo_profil: photoProfilUrl,
      ...contact,     // email + numberphone
      ...profileData
    }], { session });

    const user = newUser[0];

    const baseData = {
      firstname,
      familyname,
      postaladr,
      ...contact,
      ...profileData
    };

    let details;

    // ─────────────────────────────────────────
    // 8. CRÉER LE PROFIL SELON LE RÔLE
    // ─────────────────────────────────────────

    // ── TEACHER ──────────────────────────────
    if (role === 'teacher') {

      // Validation documents obligatoires
      if (!cv) {
        throw new Error("Le CV est obligatoire pour les enseignants.");
      }
      if (!diplomes.length) {
        throw new Error("Au moins un diplôme est obligatoire pour les enseignants.");
      }

      const teacher = await Teacher.create([{
        ...baseData,
        id_enseignant:    idmembre,
        accepted:         false,
        acceptanceStatus: 'pending',
        photo_profil:     photoProfilUrl,
        documents: { cv, diplomes }
      }], { session });

      details = teacher[0];
    }

    // ── STUDENT ───────────────────────────────
    else if (role === 'student') {

      const student = await Student.create([{
        ...baseData,
        id_eleve:     idmembre,
        photo_profil: photoProfilUrl
      }], { session });

      details = student[0];
    }

    // ── PARENT ────────────────────────────────
    else if (role === 'parent') {

      const children = profileData.children || [];

      if (!Array.isArray(children) || children.length === 0) {
        throw new Error("Au moins un enfant est requis pour un compte parent.");
      }

      const parent = new Parent({
        id_parent:    idmembre,
        enfants:      [],
        photo_profil: photoProfilUrl
      });

      for (const child of children) {
        if (!child.firstname || !child.familyname) {
          throw new Error("Chaque enfant doit avoir un prénom et un nom de famille.");
        }

        const childId = await getNextId('student');

        const newChild = await Student.create([{
          id_eleve:   childId,
          id_parent:  idmembre,
          firstname:  child.firstname,
          familyname: child.familyname
        }], { session });

        // Stocker directement l'ObjectId — compatible avec bookSession isChild check
        parent.enfants.push(newChild[0]._id);
      }

      await parent.save({ session });
      details = parent;
    }

    // ── ADMIN ─────────────────────────────────
    else if (role === 'admin') {

      const admin = await Admin.create([{
        ...baseData,
        id_admin:     idmembre,
        photo_profil: photoProfilUrl
      }], { session });

      details = admin[0];
    }

    // ─────────────────────────────────────────
    // 9. COMMIT TRANSACTION
    // ─────────────────────────────────────────
    await session.commitTransaction();
    if (role === 'teacher') {
        try {
            const { notifyAdmin } = require('../services/notificationService');
            await notifyAdmin(
                "Nouveau profil à valider",
                `Le professeur ${firstname} ${familyname} vient de s'inscrire. Son CV et ses diplômes sont en attente de vérification.`,
                "NEW_TEACHER",
                user._id
            );
        } catch (notifErr) {
            console.error("Erreur notification Admin (Inscription):", notifErr.message);
            // On ne bloque pas l'inscription si la notification échoue
        }
    }

    // ─────────────────────────────────────────
    // 10. CRÉER LE DEVICE + JWT
    // Hors transaction — failure non bloquante
    // ─────────────────────────────────────────
    let deviceData;
    let token;

    try {
      ({ device: deviceData, token } = await createDevice(user, req));
    } catch (e) {
      console.error("Device registration failed:", e.message);
      // Générer le token quand même pour ne pas bloquer l'inscription
      token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );
    }

    // ─────────────────────────────────────────
    // 11. RÉPONSE
    // ─────────────────────────────────────────
    return res.status(201).json({
      status: 'success',
      token,
      data: {
        user,
        details,
        device: deviceData || null
      }
    });

  } catch (err) {
    if (session?.inTransaction()) await session.abortTransaction();

    // Rollback tous les fichiers Cloudinary uploadés
    await rollbackCloudinaryFiles(uploaded);

    console.error("completeProfile error:", err.message);

    return res.status(400).json({
      status:  'fail',
      message: err.message
    });

  } finally {
    if (session) session.endSession();
  }
};
