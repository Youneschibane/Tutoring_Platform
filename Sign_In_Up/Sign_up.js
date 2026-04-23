<<<<<<< HEAD
const User      = require('../models/userModel');
const Teacher   = require('../models/teacherModel');
const Student   = require('../models/studentModel');
const Parent    = require('../models/parentModel');
const Admin     = require('../models/adminModel');
const Device    = require('../models/deviceModel');
const cloudinary = require('../Config/Cloudinaryconfig · JS');
=======
const User = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const Admin = require('../models/adminModel');
const Device = require('../models/deviceModel');
>>>>>>> c439ccc2586b789754767422ea54d3b36718b342
const getNextId = require('../generateID/nextID');
const mongoose  = require('mongoose');
const jwt       = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const UAParser  = require('ua-parser-js');
const geoip     = require('geoip-lite');

// ── Middleware : bloquer un enseignant non accepté par l'admin ───────────────
exports.isTeacherAccepted = async (req, res, next) => {
  try {
    if (req.user?.role !== 'teacher') return next();

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });

    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable" });
    }

    if (!teacher.accepted) {
      return res.status(403).json({
        status: 'fail',
        message: "Votre compte est en attente de validation par l'administrateur."
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ── completeProfile ──────────────────────────────────────────────────────────

// Après upload, multer-storage-cloudinary remplit req.file avec :
//   req.file.path     → URL publique Cloudinary  (ex: https://res.cloudinary.com/...)
//   req.file.filename → public_id Cloudinary     (ex: profile_photos/profile_1713520000000)
exports.completeProfile = async (req, res) => {
  let session;

  // On garde la référence Cloudinary pour pouvoir supprimer la photo en cas d'erreur
  let cloudinaryPublicId = null;

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

    // ── 1. Validation des champs obligatoires ────────────────────────────────
    if (!signupToken) {
      throw new Error("Missing signup token. Please verify your email or phone first.");
    }

    if (!firstname || !familyname || !postaladr || !password || !role) {
      throw new Error("Missing required profile fields: firstname, familyname, postaladr, password, or role.");
    }

    const validRoles = ['parent', 'student', 'teacher', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error(`Invalid role. Allowed: ${validRoles.join(', ')}`);
    }

    // ── 2. Vérifier le token de signup ───────────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(signupToken, process.env.JWT_SECRET);
    } catch {
      throw new Error("Session expired or invalid token. Please verify email/phone again.");
    }

    if (!decoded.field || !decoded.value) {
      throw new Error("Invalid token structure.");
    }

<<<<<<< HEAD
    const contact = { [decoded.field]: decoded.value };
=======
    // Determine contact field (email or numberphone)
    const contactField = decoded.field === 'phone' ? 'numberphone' : decoded.field;
    const contact = { [contactField]: decoded.value };
>>>>>>> c439ccc2586b789754767422ea54d3b36718b342

    // ── 3. Vérifier que l'utilisateur n'existe pas déjà ─────────────────────
    const existingUser = await User.findOne(contact).session(session);
    if (existingUser) {
      throw new Error("User already exists with this email or phone number.");
    }

    // ── 4. Récupérer l'URL Cloudinary de la photo de profil ─────────────────
    // multer-storage-cloudinary stocke l'URL publique dans req.file.path
    // et le public_id dans req.file.filename (utile pour supprimer plus tard)
    let photoProfilUrl = null;
    if (req.file) {
      photoProfilUrl     = req.file.path;      // URL publique → stockée en BDD
      cloudinaryPublicId = req.file.filename;  // public_id  → pour suppression si erreur
    }

    // ── 5. Créer le User principal ───────────────────────────────────────────
    const idmembre = await getNextId('user');

    const newUser = new User({
      firstname,
      familyname,
      postaladr,
      password,
      role,
      idmembre,
      isVerified: true,
      accepted: false,
      ...contact,
      ...profileData
    });

    await newUser.save({ session });

    // ── 6. Créer le profil spécifique au rôle ────────────────────────────────
    let specificData = null;
    const specificProfileData = { firstname, familyname, postaladr, ...contact, ...profileData };

    switch (role) {

      case 'teacher': {
        const teacher = new Teacher({
          ...specificProfileData,
          id_enseignant: idmembre,
          accepted:      false,         // bloqué jusqu'à validation admin
          photo_profil:  photoProfilUrl // URL Cloudinary ou null
        });
        await teacher.save({ session });
        specificData = teacher;
        break;
      }

      case 'student': {
        const student = new Student({
          ...specificProfileData,
          id_eleve:     idmembre,
          photo_profil: photoProfilUrl
        });
        await student.save({ session });
        specificData = student;
        break;
      }

      case 'parent': {
        const parent = new Parent({
          id_parent:    idmembre,
          enfants:      [],
          photo_profil: photoProfilUrl
        });

        const childId = await getNextId('student');
        const childStudent = new Student({
          id_eleve:                childId,
          id_parent:               idmembre,
          yearOfStudy:             profileData.yearOfStudy,
          niveau_scolaire:         profileData.niveau_scolaire,
          objectifs_pedagogiques:  profileData.objectifs_pedagogiques
        });

        await childStudent.save({ session });
        parent.enfants.push(childStudent._id);
        await parent.save({ session });

        specificData = { parent, child: childStudent };
        break;
      }

      case 'admin': {
        const admin = new Admin({
          ...specificProfileData,
          id_admin:     idmembre,
          photo_profil: photoProfilUrl
        });
        await admin.save({ session });
        specificData = admin;
        break;
      }

      default:
        throw new Error("Invalid role specified.");
    }

    await session.commitTransaction();

    // ── 7. Enregistrement de l'appareil (hors transaction) ───────────────────
    try {
      const currentIP        = req.ip || req.connection?.remoteAddress || '';
      const currentUserAgent = req.get('User-Agent') || '';
      const parser           = new UAParser(currentUserAgent);
      const deviceName       = `${parser.getBrowser().name || 'Unknown'} on ${parser.getOS().name || 'Unknown'}`;
      const geo              = geoip.lookup(currentIP);
      const location         = geo?.country || 'Unknown location';
      const deviceToken      = uuidv4();

      const newDevice = new Device({
        userId: newUser._id,
        deviceToken,
        userAgent: currentUserAgent,
        ipAddress: currentIP,
        deviceName,
        location,
        lastUsed: new Date()
      });

      await newDevice.save();

      const loginToken = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      return res.status(201).json({
        status: 'success',
        message: role === 'teacher'
          ? "Compte créé. En attente de validation par l'administrateur."
          : "Account created successfully!",
        token: loginToken,
        data: {
          user: {
            id:          newUser._id,
            idmembre:    newUser.idmembre,
            firstname:   newUser.firstname,
            familyname:  newUser.familyname,
            role:        newUser.role,
            isVerified:  newUser.isVerified,
            photo_profil: photoProfilUrl,
            ...(role === 'teacher' && { accepted: false })
          },
          details: specificData,
          device: {
            deviceToken,
            isNewDevice: true,
            lastUsed:    newDevice.lastUsed,
            deviceName:  newDevice.deviceName,
            location:    newDevice.location
          }
        }
      });

    } catch (deviceError) {
      console.error("Device registration error:", deviceError.message);

      const loginToken = jwt.sign(
        { id: newUser._id, role: newUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '90d' }
      );

      return res.status(201).json({
        status: 'success-partial',
        message: "Account created but device registration failed. Please log in.",
        token: loginToken,
        data: {
          user: {
            id:          newUser._id,
            idmembre:    newUser.idmembre,
            firstname:   newUser.firstname,
            familyname:  newUser.familyname,
            role:        newUser.role,
            isVerified:  newUser.isVerified,
            photo_profil: photoProfilUrl,
            ...(role === 'teacher' && { accepted: false })
          },
          details: specificData
        }
      });
    }

  } catch (error) {
    // ── Rollback transaction ─────────────────────────────────────────────────
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }

    // ── Supprimer la photo Cloudinary si elle a été uploadée mais que la BDD a échoué
    if (cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(cloudinaryPublicId);
        console.log("Photo Cloudinary supprimée après échec:", cloudinaryPublicId);
      } catch (cleanupError) {
        console.error("Impossible de supprimer la photo Cloudinary:", cleanupError.message);
      }
    }

    console.error("Profile completion error:", error.message);

    let statusCode = 400;
    let message    = error.message || 'Failed to complete profile';

    if (error.message.includes('duplicate key')) {
      statusCode = 409;
<<<<<<< HEAD
      message    = 'Email or phone number already registered';
=======
      const fieldMatch = error.message.match(/index: (.*?)_1/);
      const duplicateField = fieldMatch ? fieldMatch[1] : 'unknown';
      console.error(`Duplicate key error on field: ${duplicateField}`);
      message = 'Email or phone number already registered';
>>>>>>> c439ccc2586b789754767422ea54d3b36718b342
    } else if (error.message.includes('validation')) {
      statusCode = 422;
    }

    return res.status(statusCode).json({ status: 'fail', message });

  } finally {
    if (session) session.endSession();
  }
};