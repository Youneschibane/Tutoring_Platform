// controllers/teacherStatusController.js
// Consultation du statut de validation par l'enseignant lui-même

const Teacher = require('../models/teacherModel');

/**
 * getMyStatus
 * Route protégée : enseignant uniquement
 * L'enseignant peut consulter son statut de validation même s'il n'est pas encore accepté
 * Retour: acceptanceStatus, rejectionReason, reviewedAt uniquement
 *
 * NOTE: Cette route utilise skipAcceptedCheck pour bypasser la vérification d'acceptation
 * Cela permet aux enseignants en attente ou rejetés de vérifier leur statut
 */
exports.getMyStatus = async (req, res) => {
  try {
    const idEnseignant = req.user.idmembre; // ID de l'enseignant depuis le token

    // Chercher l'enseignant par id_enseignant
    const teacher = await Teacher.findOne({ id_enseignant: idEnseignant })
      .select('acceptanceStatus rejectionReason reviewedAt')
      .lean();

    if (!teacher) {
      return res.status(404).json({
        status: 'fail',
        message: 'Profil enseignant introuvable'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Statut de validation récupéré',
      data: {
        acceptanceStatus: teacher.acceptanceStatus,
        rejectionReason: teacher.rejectionReason,
        reviewedAt: teacher.reviewedAt
      }
    });
  } catch (error) {
    console.error('getMyStatus error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
