const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const Device  = require('../models/deviceModel');

const cloudinary  = require('../Config/Cloudinaryconfig · JS');
const getNextId   = require('../generateID/nextID');
const mongoose    = require('mongoose');
const jwt         = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser    = require('ua-parser-js');
const geoip       = require('geoip-lite');

// ─────────────────────────────────────────────────────────────
// Helper — supprimer les fichiers Cloudinary uploadés en cas d'erreur
// ─────────────────────────────────────────────────────────────
const rollbackCloudinaryFiles = async (publicIds = []) => {
  await Promise.allSettled(
    publicIds.map(id => cloudinary.uploader.destroy(id))
  );
};

// ─────────────────────────────────────────────────────────────
// Middleware: check teacher acceptance
// ─────────────────────────────────────────────────────────────
exports.isTeacherAccepted = async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') return next();

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });

    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: "Teacher profile not found." });
    }

    if (!teacher.accepted) {
      return res.status(403).json({ status: 'fail', message: "Your account is waiting for admin validation." });
    }

    next();
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// Complete Profile
// ─────────────────────────────────────────────────────────────
exports.completeProfile = async (req, res) => {
  let session;

  // Collecter tous les publicIds Cloudinary pour rollback en cas d'erreur
  const uploadedPublicIds = [];

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

    // ── Validation ─────────────────────────────
    if (!signupToken) throw new Error("Missing signup token.");
    if (!firstname || !familyname || !postaladr || !password || !role) throw new Error("Missing required fields.");

    const roles = ['parent', 'student', 'teacher', 'admin'];
    if (!roles.includes(role)) throw new Error("Invalid role.");

    // ── Validate teacher documents at signup ───
    if (role === 'teacher') {
      if (!req.files?.cv?.[0]) {
        throw new Error("Le CV est obligatoire pour les enseignants.");
      }
      if (!req.files?.diplomes?.length) {
        throw new Error("Au moins un diplôme est obligatoire pour les enseignants.");
      }
    }

    // ── Verify signup JWT ──────────────────────
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("Invalid or expired token.");
    }

    const contactField = decoded.field === 'phone' ? 'numberphone' : decoded.field;
    const contact = { [contactField]: decoded.value };

    // ── Check existing user ────────────────────
    const exists = await User.findOne(contact).session(session);
    if (exists) throw new Error("User already exists.");

    // ── Extract uploaded files ─────────────────
    // Photo profil — disponible pour tous les rôles
    const photoFile = req.files?.photo_profil?.[0] || req.file || null;
    if (photoFile?.filename) uploadedPublicIds.push(photoFile.filename);

    let photoProfilUrl = photoFile?.path || null;

    // CV — teacher uniquement
    let cvData = null;
    if (req.files?.cv?.[0]) {
      const cvFile = req.files.cv[0];
      uploadedPublicIds.push(cvFile.filename);
      cvData = {
        url:        cvFile.path,
        publicId:   cvFile.filename,
        uploadedAt: new Date()
      };
    }

    // Diplômes — teacher uniquement (tableau)
    let diplomesData = [];
    if (req.files?.diplomes?.length) {
      diplomesData = req.files.diplomes.map((file, index) => {
        uploadedPublicIds.push(file.filename);
        return {
          url:        file.path,
          publicId:   file.filename,
          nom:        profileData[`diplome_nom_${index}`] || null, // nom optionnel ex: "Licence Maths"
          uploadedAt: new Date()
        };
      });
    }

    // ── Create user ────────────────────────────
    const idmembre = await getNextId('user');

    const newUser = new User({
      firstname,
      familyname,
      postaladr,
      password,
      role,
      idmembre,
      isVerified: true,
      isActive:   true,
      ...contact,
      ...profileData
    });

    await newUser.save({ session });

    // ── Role-specific profile ──────────────────
    let specificData;
    const baseData = { firstname, familyname, postaladr, ...contact, ...profileData };

    if (role === 'teacher') {
      const teacher = new Teacher({
        ...baseData,
        id_enseignant:    idmembre,
        accepted:         false,
        acceptanceStatus: 'pending',
        photo_profil:     photoProfilUrl,
        documents: {
          cv:       cvData,
          diplomes: diplomesData
        }
      });
      await teacher.save({ session });
      specificData = teacher;
    }

    else if (role === 'student') {
      const student = new Student({
        ...baseData,
        id_eleve:     idmembre,
        photo_profil: photoProfilUrl
      });
      await student.save({ session });
      specificData = student;
    }

  else if (role === 'parent') {
  const parent = new Parent({
    id_parent:    idmembre,
    enfants:      [],
    photo_profil: photoProfilUrl
  });

  // ── Children array from req.body ───────────────────────────
  // Expected format: children = [{ firstname, familyname }, ...]
  let children = [];

  try {
    children = typeof profileData.children === 'string'
      ? JSON.parse(profileData.children)   // form-data envoie du JSON stringifié
      : profileData.children || [];
  } catch {
    throw new Error("Format du tableau d'enfants invalide.");
  }

  if (!Array.isArray(children) || children.length === 0) {
    throw new Error("Au moins un enfant est requis pour un compte parent.");
  }

  // ── Create each child ──────────────────────────────────────
  for (const child of children) {
    if (!child.firstname || !child.familyname) {
      throw new Error("Chaque enfant doit avoir un prénom et un nom de famille.");
    }

    const childId = await getNextId('student');

    const newChild = new Student({
      id_eleve:   childId,
      id_parent:  idmembre,
      firstname:  child.firstname,
      familyname: child.familyname
    });

    await newChild.save({ session });
    parent.enfants.push(newChild._id);
  }

  await parent.save({ session });
  specificData = { parent, enfants: parent.enfants };
}

    else if (role === 'admin') {
      const admin = new Admin({
        ...baseData,
        id_admin:     idmembre,
        photo_profil: photoProfilUrl
      });
      await admin.save({ session });
      specificData = admin;
    }

    await session.commitTransaction();

    // ── Device registration + JWT ──────────────
    try {
      const ip = req.ip || '';
      const ua = req.get('User-Agent') || '';

      const parser     = new UAParser(ua);
      const deviceName = `${parser.getBrowser().name || 'Unknown'} on ${parser.getOS().name || 'Unknown'}`;

      const geo      = geoip.lookup(ip);
      const location = geo?.country || 'Unknown';

      const token = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      const deviceToken = uuidv4();

      const device = new Device({
        userId:     newUser._id,
        deviceToken,
        jwtToken:   token,
        userAgent:  ua,
        ipAddress:  ip,
        deviceName,
        location,
        isActive:   true,
        lastUsed:   new Date()
      });

      await device.save();

      return res.status(201).json({
        status: 'success',
        token,
        data: {
          user:    newUser,
          details: specificData,
          device: {
            deviceToken: device.deviceToken,
            deviceName:  device.deviceName,
            location:    device.location,
            lastUsed:    device.lastUsed
          }
        }
      });

    } catch (deviceError) {
      const token = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      console.error("Device registration failed:", deviceError.message);

      return res.status(201).json({
        status:  'partial-success',
        message: "Compte créé mais l'enregistrement de l'appareil a échoué. Veuillez vous reconnecter.",
        token,
        data: { user: newUser, details: specificData }
      });
    }

  } catch (err) {
    if (session?.inTransaction()) await session.abortTransaction();

    // Rollback tous les fichiers uploadés sur Cloudinary
    if (uploadedPublicIds.length) {
      await rollbackCloudinaryFiles(uploadedPublicIds);
    }

    return res.status(400).json({ status: 'fail', message: err.message });

  } finally {
    if (session) session.endSession();
  }
};