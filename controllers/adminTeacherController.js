// controllers/adminTeacherController.js
// Gestion complète du workflow de validation des enseignants par l'admin

const Teacher = require('../models/teacherModel');
const User = require('../models/userModel');
const Document = require('../models/documentModel');
const sendEmail = require('../utils/sendEmail');

/**
 * getPendingTeachers
 * Récupère tous les enseignants en attente d'approbation
 * - Filtre: acceptanceStatus = 'pending'
 * - Tri: par createdAt ascendant (queue FIFO)
 * - Retour: total count + tableau de données
 */exports.getPendingTeachers = async (req, res) => {
  try {

    const page = req.query.page * 1 || 1;
    const limit = req.query.limit * 1 || 10;
    const skip = (page - 1) * limit;

    const result = await Teacher.aggregate([
      // ─────────────────────────────
      // 1. Filter pending teachers
      // ─────────────────────────────
      {
        $match: {
          acceptanceStatus: 'pending'
          
        }
      },

      // ─────────────────────────────
      // 2. Join with User collection
      // ─────────────────────────────
      {
        $lookup: {
          from: 'users', // ⚠️ must match Mongo collection name
          localField: 'id_enseignant',
          foreignField: 'idmembre',
          as: 'user'
        }
      },

      // ─────────────────────────────
      // 3. Unwrap user array
      // ─────────────────────────────
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },

      // ─────────────────────────────
      // 4. Shape final output
      // ─────────────────────────────
      {
        $project: {
          _id: 1,
          id_enseignant: 1,
          acceptanceStatus: 1,
          nature: 1,
          subjects: 1,
          rating: 1,
          createdAt: 1,

          // USER DATA
          firstname: '$user.firstname',
          familyname: '$user.familyname',
          email: '$user.email',
          numberphone: '$user.numberphone',
          photo_profil: '$user.photo_profil'
        }
      },

      // ─────────────────────────────
      // 5. Sort
      // ─────────────────────────────
      {
        $sort: {
          createdAt: -1
        }
      },

      // ─────────────────────────────
      // 6. Pagination
      // ─────────────────────────────
      { $skip: skip },
      { $limit: limit }
    ]);

    // ─────────────────────────────
    // COUNT (separate fast query)
    // ─────────────────────────────
    const total = await Teacher.countDocuments({
      acceptanceStatus: 'pending'
    });

    return res.status(200).json({
      status: 'success',
      total,
      page,
      pages: Math.ceil(total / limit),
      data: result
    });

  } catch (error) {
    console.error('getPendingTeachers error:', error);

    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};
/**
 * getTeacherFullProfile
 * Récupère le profil complet d'un enseignant + ses documents
 * Param: id_enseignant (Number, via URL)
 */
exports.getTeacherFullProfile = async (req, res) => {
  try {
    const { id } = req.params; // id_enseignant

    // 1. Fetch teacher profile
    const teacher = await Teacher.findOne({ id_enseignant: parseInt(id) })
      .populate('reviewedBy', 'firstname familyname email')
      .lean();

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: 'Enseignant introuvable'
      });
    }

    // 2. Fetch corresponding User document for additional info
    const user = await User.findOne({ idmembre: parseInt(id) })
      .select('firstname familyname email numberphone createdAt')
      .lean();

    // 3. Fetch all documents linked to this teacher
    // Match via enseignant field (Teacher ObjectId) or by id_enseignant (fallback)
    const documents = await Document.find({ 
      enseignant: teacher._id 
    })
      .select('nom_fichier type_document access_type createdAt description')
      .lean();

    return res.status(200).json({
      status: 'success',
      message: 'Profil enseignant et documents récupérés',
      data: {
        teacher,
        user,
        documents,
        documentCount: documents.length
      }
    });
  } catch (error) {
    console.error('getTeacherFullProfile error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * acceptTeacher
 * Accepte un enseignant en attente
 * - Mise à jour: accepted: true, acceptanceStatus: 'accepted', reviewedAt, reviewedBy
 * - Notifie l'enseignant par email (fire-and-forget)
 * Param: id_enseignant (Number, via URL)
 */
exports.acceptTeacher = async (req, res) => {
  try {
    const { id } = req.params; // id_enseignant
    const adminId = req.user._id; // Admin qui fait l'action

    // 1. Find and update teacher
    const teacher = await Teacher.findOneAndUpdate(
      { id_enseignant: parseInt(id) },
      {
        accepted: true,
        acceptanceStatus: 'accepted',
        rejectionReason: null,
        reviewedAt: new Date(),
        reviewedBy: adminId
      },
      { returnDocument: "after", runValidators: false }
    );

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: 'Enseignant introuvable'
      });
    }

    // 2. Get corresponding User to send email (fire-and-forget)
    const user = await User.findOne({ idmembre: parseInt(id) });
    if (user && user.email) {
      (async () => {
        try {
          await sendEmail({
            email: user.email,
            subject: '✅ Votre compte a été approuvé',
            message: `Bonjour ${user.firstname},\n\nFélicitations ! Votre compte de professionnel a été approuvé par notre équipe administrative.\n\nVous pouvez maintenant accéder à toutes les fonctionnalités de la plateforme :\n- Créer et gérer vos services\n- Ajouter des séances de cours\n- Partager des documents avec vos élèves\n- Consulter les demandes de devis\n\nBienvenue sur notre plateforme !\n\nCordialement,\nL'équipe d'administration`
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError.message);
          // Non-blocking — l'opération principal est déjà complétée
        }
      })();
    }

    return res.status(200).json({
      status: 'success',
      message: 'Enseignant approuvé avec succès',
      data: teacher
    });
  } catch (error) {
    console.error('acceptTeacher error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

/**
 * rejectTeacher
 * Rejette un enseignant en attente
 * - Body: { reason: string } — obligatoire
 * - Mise à jour: accepted: false, acceptanceStatus: 'rejected', rejectionReason, reviewedAt, reviewedBy
 * - Notifie l'enseignant par email avec raison du rejet (fire-and-forget)
 * Param: id_enseignant (Number, via URL)
 */
exports.rejectTeacher = async (req, res) => {
  try {
    const { id } = req.params; // id_enseignant
    const { reason } = req.body;
    const adminId = req.user._id; // Admin qui fait l'action

    // 1. Validate reason is provided
    if (!reason || reason.trim() === '') {
      return res.status(400).json({
        status: 'fail',
        message: 'Raison de rejet obligatoire'
      });
    }

    // 2. Find and update teacher
    const teacher = await Teacher.findOneAndUpdate(
      { id_enseignant: parseInt(id) },
      {
        accepted: false,
        acceptanceStatus: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date(),
        reviewedBy: adminId
      },
      { returnDocument: "after", runValidators: false }
    );

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: 'Enseignant introuvable'
      });
    }

    // 3. Get corresponding User to send email (fire-and-forget)
    const user = await User.findOne({ idmembre: parseInt(id) });
    if (user && user.email) {
      (async () => {
        try {
          await sendEmail({
            email: user.email,
            subject: '❌ Votre compte n\'a pas été approuvé',
            message: `Bonjour ${user.firstname},\n\nNous regrettons d'vous informer que votre demande d'inscription en tant qu'enseignant n'a pas été approuvée à ce stade.\n\nRaison du rejet :\n${reason}\n\nNous vous encourageons à corriger votre profil et réessayer. Si vous avez des questions, n'hésitez pas à nous contacter.\n\nCordialement,\nL'équipe d'administration`
          });
        } catch (emailError) {
          console.error('Email notification failed:', emailError.message);
          // Non-blocking — l'opération principal est déjà complétée
        }
      })();
    }

    return res.status(200).json({
      status: 'success',
      message: 'Enseignant rejeté avec succès',
      data: teacher
    });
  } catch (error) {
    console.error('rejectTeacher error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
