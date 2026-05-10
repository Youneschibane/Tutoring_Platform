const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const Device  = require('../models/deviceModel');
const { notifyAdmin } = require('../controllers/NotificationAdmin');

const cloudinary = require('../Config/cloudinaryConfig.js');
const getNextId  = require('../generateID/nextID');

const mongoose = require('mongoose');
const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser = require('ua-parser-js');
const geoip    = require('geoip-lite');
const { cityToCoordinates, validateCoordinates } = require('../utils/geocoding');

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

// Rollback tous les fichiers uploadés sur Cloudinary en cas d'erreur
const rollbackCloudinaryFiles = (ids = []) => {
  // ✅ fire-and-forget — on ne bloque pas le handler sur le cleanup
  Promise.allSettled(
    ids.map(id => cloudinary.uploader.destroy(id))
  ).catch(() => {});
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
    // ─────────────────────────────────────────
    const contact = {};
    if (decoded.email) contact.email       = decoded.email;
    if (decoded.phone) contact.numberphone = decoded.phone;

    if (Object.keys(contact).length === 0) {
      throw new Error("Token invalide — aucun contact trouvé.");
    }

    // ─────────────────────────────────────────
    // 5. VÉRIFIER QUE LE USER N'EXISTE PAS DÉJÀ
    // ✅ OPTIMISATION : .lean() — on ne fait que lire, pas besoin d'un doc Mongoose
    // ─────────────────────────────────────────
    const orConditions = [
      ...(decoded.email ? [{ email:       decoded.email }] : []),
      ...(decoded.phone ? [{ numberphone: decoded.phone }] : [])
    ];

    const exists = await User.findOne({ $or: orConditions })
      .select('_id').lean().session(session);

    if (exists) throw new Error("User already exists.");

    // ─────────────────────────────────────────
    // 6. EXTRACTION DES FICHIERS CLOUDINARY
    // ─────────────────────────────────────────
    const photoFile      = req.files?.photo_profil?.[0] || null;
    const photoProfilUrl = photoFile?.path || null;
    if (photoFile?.filename) uploaded.push(photoFile.filename);

    const cvFile = req.files?.cv?.[0] || null;
    if (cvFile?.filename) uploaded.push(cvFile.filename);

    const cv = cvFile ? {
      url:        cvFile.path,
      publicId:   cvFile.filename,
      uploadedAt: new Date()
    } : null;

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
    // 7. GÉNÉRER L'ID + CRÉER LE USER
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
      ...contact,
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

      if (!cv)            throw new Error("Le CV est obligatoire pour les enseignants.");
      if (!diplomes.length) throw new Error("Au moins un diplôme est obligatoire pour les enseignants.");

      let latitude = 0;
      let longitude = 0;
      let city = profileData.city ? profileData.city.trim() : null;

      // ─────────────────────────────────────────
      // GEOCODING: Convert city to coordinates
      // ─────────────────────────────────────────
      if (city) {
        try {
          const geoData = await cityToCoordinates(city);
          latitude = geoData.latitude;
          longitude = geoData.longitude;
          city = geoData.city; // Normalized city name

          console.log(`✓ Geocoding: "${geoData.city}" → [${latitude}, ${longitude}]`);
        } catch (geoError) {
          // Log warning but don't block signup — coordinates default to 0, 0
          console.warn(`⚠ Geocoding failed for city "${city}": ${geoError.message}`);
        }
      }

      const teacher = await Teacher.create([{
        ...baseData,
        id_enseignant:    idmembre,
        accepted:         false,
        acceptanceStatus: 'pending',
        photo_profil:     photoProfilUrl,
        city,
        latitude,
        longitude,
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

      // Validation préalable — fail fast avant toute opération DB
      for (const child of children) {
        if (!child.firstname || !child.familyname) {
          throw new Error("Chaque enfant doit avoir un prénom et un nom de famille.");
        }
      }

      // ✅ OPTIMISATION MAJEURE : création des enfants en parallèle
      // getNextId est atomique ($inc) → safe à paralléliser
      const childDocs = await Promise.all(
        children.map(async (child) => {
          const childId = await getNextId('student');
          const [newChild] = await Student.create([{
            id_eleve:   childId,
            id_parent:  idmembre,
            firstname:  child.firstname,
            familyname: child.familyname
          }], { session });
          return newChild;
        })
      );

      const parent = await Parent.create([{
        id_parent:    idmembre,
        enfants:      childDocs.map(c => c._id),
        photo_profil: photoProfilUrl
      }], { session });

      details = parent[0];
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

    // ✅ OPTIMISATION : fire-and-forget — on ne bloque pas la réponse
    if (role === 'teacher') {
      notifyAdmin(
        "Nouveau profil à valider",
        `Le professeur ${firstname} ${familyname} vient de s'inscrire. Son CV et ses diplômes sont en attente de vérification.`,
        "NEW_TEACHER",
        user._id
      ).catch(e => console.error("Erreur notification Admin (Inscription):", e.message));
    }

    // ─────────────────────────────────────────
    // 10. CRÉER LE DEVICE + JWT (hors transaction)
    // ✅ OPTIMISATION : générer le token en parallèle du Device.create
    // via le fallback — device failure ne bloque pas
    // ─────────────────────────────────────────
    let deviceData = null;
    let token;

    try {
      ({ device: deviceData, token } = await createDevice(user, req));
    } catch (e) {
      console.error("Device registration failed:", e.message);
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
        device: deviceData
      }
    });

  } catch (err) {
    if (session?.inTransaction()) await session.abortTransaction();

    // ✅ fire-and-forget — rollback Cloudinary non bloquant
    rollbackCloudinaryFiles(uploaded);

    console.error("completeProfile error:", err.message);

    return res.status(400).json({
      status:  'fail',
      message: err.message
    });

  } finally {
    if (session) session.endSession();
  }
};