const mongoose = require('mongoose');
const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const Admin   = require('../models/adminModel');
const cloudinary = require('cloudinary').v2;

// ═══════════════════════════════════════════════════════════════
// HELPER — Extraire le publicId Cloudinary depuis une URL
// ═══════════════════════════════════════════════════════════════
const getCloudinaryPublicId = (photoUrl) => {
  if (!photoUrl) return null;
  if (!photoUrl.startsWith('http')) return photoUrl;

  try {
    const afterUpload = photoUrl.split('/upload/')[1];
    if (!afterUpload) return photoUrl;

    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId       = withoutVersion.substring(0, withoutVersion.lastIndexOf('.'));

    return publicId || photoUrl;
  } catch {
    return photoUrl;
  }
};

// ═══════════════════════════════════════════════════════════════
// ROLE CONFIGS
// ═══════════════════════════════════════════════════════════════
const ROLE_CONFIGS = {
  teacher: {
    model:         Teacher,
    idField:       'id_enseignant',
    roleName:      'enseignant',
    allowedFields: [
      'nature', 'latitude', 'longitude', 'deplacement',
      'rayon_deplacement', 'description_pedagogique',
      'actif', 'subjects', 'modalite', 'online'
    ]
  },
  student: {
    model:         Student,
    idField:       'id_eleve',
    roleName:      'étudiant',
    allowedFields: [
      'yearOfStudy', 'niveau_scolaire',
      'objectifs_pedagogiques', 'id_parent'
    ]
  },
  parent: {
    model:         Parent,
    idField:       'id_parent',
    roleName:      'parent',
    allowedFields: ['enfants']
  },
  admin: {
    model:         Admin,
    idField:       'id_admin',
    roleName:      'admin',
    allowedFields: []
  }
};

// ═══════════════════════════════════════════════════════════════
// GENERIC UPDATE CONTROLLER
// ═══════════════════════════════════════════════════════════════
const performUpdate = async (req, res, roleConfig) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  let oldPhotoPublicId = null;
  let newFilePublicId  = null;

  try {
    const userId = req.user.id;

    const {
      firstname, familyname, postaladr,
      email, numberphone,
      ...extraFields
    } = req.body || {};

    // ─────────────────────────────────────────
    // 1. FETCH USER
    // ─────────────────────────────────────────
    const user = await User.findById(userId).session(session);
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    // ─────────────────────────────────────────
    // 2. BUILD USER UPDATES
    // ─────────────────────────────────────────
    const userUpdates = {};

    if (firstname   !== undefined && firstname   !== '') userUpdates.firstname   = firstname;
    if (familyname  !== undefined && familyname  !== '') userUpdates.familyname  = familyname;
    if (postaladr   !== undefined && postaladr   !== '') userUpdates.postaladr   = postaladr;
    if (email       !== undefined && email       !== '') userUpdates.email       = email;
    if (numberphone !== undefined && numberphone !== '') userUpdates.numberphone = numberphone;

    // ─────────────────────────────────────────
    // 3. HANDLE PHOTO UPLOAD
    // ─────────────────────────────────────────
    if (req.file) {
      const photoUrl  = req.file.path || req.file.secure_url;
      newFilePublicId = req.file.filename || req.file.public_id;

      if (photoUrl) {
        userUpdates.photo_profil = photoUrl;

        if (user.photo_profil) {
          oldPhotoPublicId = getCloudinaryPublicId(user.photo_profil);
        }
      }
    }

    // ─────────────────────────────────────────
    // 4. UPDATE USER
    // ─────────────────────────────────────────
    let updatedUser = user;

    if (Object.keys(userUpdates).length > 0) {
      updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: userUpdates },
        { returnDocument: 'after', runValidators: true, session }
      ).select('-password');
    }

    // ─────────────────────────────────────────
    // 5. BUILD ROLE-SPECIFIC UPDATES
    // ─────────────────────────────────────────
    const { model, idField, allowedFields, roleName } = roleConfig;
    const roleUpdates = {};

    for (const field of allowedFields) {
      if (extraFields[field] === undefined) continue;

      if (field === 'subjects' && typeof extraFields[field] === 'string') {
        try {
          roleUpdates[field] = JSON.parse(extraFields[field]);
        } catch (e) {
          await session.abortTransaction();
          return res.status(400).json({
            status:  'fail',
            message: "Format du champ 'subjects' invalide. Doit être un tableau JSON."
          });
        }
      } else if (field === 'latitude' || field === 'longitude') {
        roleUpdates[field] = parseFloat(extraFields[field]);
      } else {
        roleUpdates[field] = extraFields[field];
      }
    }

    // ─────────────────────────────────────────
    // 6. UPDATE ROLE MODEL
    // ─────────────────────────────────────────
    const memberId = updatedUser.idmembre;
    let updatedSpecific = null;

    if (Object.keys(roleUpdates).length > 0) {
      updatedSpecific = await model.findOneAndUpdate(
        { [idField]: memberId },
        { $set: roleUpdates },
        { returnDocument: 'after', runValidators: true, session }
      );
    } else {
      updatedSpecific = await model.findOne(
        { [idField]: memberId }
      ).session(session);
    }

    // ─────────────────────────────────────────
    // 7. COMMIT TRANSACTION
    // ─────────────────────────────────────────
    await session.commitTransaction();

    // ─────────────────────────────────────────
    // 8. DELETE OLD CLOUDINARY PHOTO
    // After commit — fire and forget
    // ─────────────────────────────────────────
    if (oldPhotoPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPhotoPublicId);
      } catch (e) {
        console.error("Ancienne photo non supprimée (orphelin Cloudinary):", e.message);
      }
    }

    // ─────────────────────────────────────────
    // 9. RESPONSE
    // ─────────────────────────────────────────
    return res.status(200).json({
      status:  'success',
      message: `Profil ${roleName} mis à jour avec succès.`,
      data: {
        user:    updatedUser,
        details: updatedSpecific
      }
    });

  } catch (error) {
    await session.abortTransaction();

    if (newFilePublicId) {
      try {
        await cloudinary.uploader.destroy(newFilePublicId);
      } catch (e) {
        console.error("Rollback nouvelle photo échoué:", e.message);
      }
    }

    console.error("UPDATE ERROR:", error.message);
    return res.status(500).json({
      status:  'error',
      message: error?.message || "Erreur serveur."
    });

  } finally {
    session.endSession();
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTED CONTROLLERS
// ═══════════════════════════════════════════════════════════════
exports.updateProfileTeacher = (req, res) =>
  performUpdate(req, res, ROLE_CONFIGS.teacher);

exports.updateProfileStudent = (req, res) =>
  performUpdate(req, res, ROLE_CONFIGS.student);

exports.updateProfileParent = (req, res) =>
  performUpdate(req, res, ROLE_CONFIGS.parent);

exports.updateProfileAdmin = (req, res) =>
  performUpdate(req, res, ROLE_CONFIGS.admin);

/* backward compatibility */
exports.updateProfile = exports.updateProfileTeacher;