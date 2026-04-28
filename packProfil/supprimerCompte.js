const User   = require('../models/userModel');
const Device = require('../models/deviceModel');
const AccountDeletion = require('../models/accountDeletionModel');
const ArchiveAction = require('../models/archiveActionModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const Seance = require('../models/sessionModel');
const Service = require('../models/serviceModel');

exports.deleteAccount = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    if (!user.isActive && user.isDeleted) {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: "Ce compte a déjà été supprimé définitivement." });
    }

    if (!user.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: "Ce compte est déjà désactivé et en attente de suppression." });
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + 30);

    // ─────────────────────────────────────────────────
    // SOFT DELETE: Marquer le compte comme inactif
    // ─────────────────────────────────────────────────
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      deletionScheduledAt: deletionDate
    }, { session });

    // ─────────────────────────────────────────────────
    // ENREGISTRER LA DEMANDE DE SUPPRESSION
    // ─────────────────────────────────────────────────
    await AccountDeletion.findOneAndUpdate(
      { userId: userId },
      {
        userId: userId,
        email: user.email,
        phone: user.numberphone,
        requestedAt: new Date(),
        deletionScheduledFor: deletionDate,
        status: 'pending'
      },
      { upsert: true, returnDocument: "after", session }
    );

    // ─────────────────────────────────────────────────
    // CRÉER UN ENREGISTREMENT D'AUDIT DANS ARCHIVEACTION
    // ─────────────────────────────────────────────────
    const roleData = await getRoleData(user.role, user.idmembre, session);
    
    await ArchiveAction.create([{
      userId: userId,
      idmembre: user.idmembre,
      firstname: user.firstname,
      familyname: user.familyname,
      email: user.email,
      numberphone: user.numberphone,
      role: user.role,
      actionType: 'soft_delete',
      deletionReason: 'user_request',
      deletionScheduledAt: deletionDate,
      permanentlyDeletedAt: null,
      dataSnapshot: {
        user: user.toObject(),
        roleData: roleData
      },
      deletedBy: 'self',
      cascadedDeletions: {
        parentDeletionIds: [],
        studentDeletionIds: [],
        teacherDeletionIds: [],
        removedSessionIds: [],
        removedServiceIds: []
      }
    }], { session });

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Compte désactivé. Suppression automatique dans 30 jours.",
      deletionDate: deletionDate.toISOString(),
      info: "Vous avez 30 jours pour récupérer votre compte. Après cette période, il sera supprimé définitivement."
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Delete account error:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

exports.reactivateAccount = async (req, res) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    const userId = req.user.id;
    const user = await User.findById(userId).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    // ─────────────────────────────────────────────────
    // Impossible de réactiver si suppression définitive
    // ─────────────────────────────────────────────────
    if (user.isDeleted) {
      await session.abortTransaction();
      return res.status(403).json({ 
        status: 'fail', 
        message: "Ce compte a été supprimé définitivement et ne peut pas être récupéré." 
      });
    }

    if (user.isActive) {
      await session.abortTransaction();
      return res.status(400).json({ status: 'fail', message: "Ce compte est déjà actif." });
    }

    // ─────────────────────────────────────────────────
    // RÉACTIVER LE COMPTE
    // ─────────────────────────────────────────────────
    await User.findByIdAndUpdate(userId, {
      isActive: true,
      deletionScheduledAt: null
    }, { session });

    // ─────────────────────────────────────────────────
    // METTRE À JOUR LE STATUT DE SUPPRESSION
    // ─────────────────────────────────────────────────
    await AccountDeletion.findOneAndUpdate(
      { userId: userId },
      {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { session }
    );

    // ─────────────────────────────────────────────────
    // METTRE À JOUR L'ARCHIVE ACTION
    // ─────────────────────────────────────────────────
    await ArchiveAction.findOneAndUpdate(
      { userId: userId, actionType: 'soft_delete', permanentlyDeletedAt: null },
      {
        status: 'cancelled',
        cancelledAt: new Date()
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Compte réactivé avec succès.",
      info: "Votre compte est maintenant actif et accessible."
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Reactivate account error:", error);
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

// ═══════════════════════════════════════════════════════════════
// HELPER — Récupérer les données d'une entité par rôle
// ═══════════════════════════════════════════════════════════════
const getRoleData = async (role, idmembre, session) => {
  try {
    if (role === 'teacher') {
      return await Teacher.findOne({ id_enseignant: idmembre }).session(session);
    } else if (role === 'student') {
      return await Student.findOne({ id_eleve: idmembre }).session(session);
    } else if (role === 'parent') {
      return await Parent.findOne({ id_parent: idmembre }).session(session);
    }
  } catch (e) {
    console.warn(`Could not fetch ${role} data:`, e.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════
// PERMANENT DELETION — Appelée par un cron job après 30 jours
// ═══════════════════════════════════════════════════════════════
exports.permanentlyDeleteAccount = async (userId) => {
  const session = await require('mongoose').startSession();
  session.startTransaction();

  try {
    const user = await User.findById(userId).session(session);
    
    if (!user || user.isDeleted) {
      await session.abortTransaction();
      return { success: false, message: "Utilisateur non trouvé ou déjà supprimé." };
    }

    if (!user.deletionScheduledAt || new Date() < user.deletionScheduledAt) {
      await session.abortTransaction();
      return { success: false, message: "Période de grâce non expirée." };
    }

    const cascadedDeletions = {
      parentDeletionIds: [],
      studentDeletionIds: [],
      teacherDeletionIds: [],
      removedSessionIds: [],
      removedServiceIds: []
    };

    // ─────────────────────────────────────────────────
    // SUPPRESSION DÉPENDANTE PAR RÔLE
    // ─────────────────────────────────────────────────
    if (user.role === 'student') {
      // Supprimer l'élève et le retirer des séances
      const student = await Student.findOne({ id_eleve: user.idmembre }).session(session);
      if (student) {
        await Seance.updateMany(
          { etudiants: student._id },
          { $pull: { etudiants: student._id } },
          { session }
        );
        await Student.deleteOne({ _id: student._id }, { session });
      }
    } else if (user.role === 'parent') {
      // Supprimer le parent et tous ses enfants + leurs références dans les séances
      const parent = await Parent.findOne({ id_parent: user.idmembre }).session(session);
      if (parent && parent.enfants) {
        for (const enfantRef of parent.enfants) {
          const childId = enfantRef.student;
          if (childId) {
            cascadedDeletions.studentDeletionIds.push(childId);
            await Seance.updateMany(
              { etudiants: childId },
              { $pull: { etudiants: childId } },
              { session }
            );
          }
        }
        await Student.deleteMany({ _id: { $in: cascadedDeletions.studentDeletionIds } }, { session });
        await Parent.deleteOne({ _id: parent._id }, { session });
      }
    } else if (user.role === 'teacher') {
      // Supprimer le prof et transférer ses séances et services
      const teacher = await Teacher.findOne({ id_enseignant: user.idmembre }).session(session);
      if (teacher) {
        // Récupérer les services et séances du prof
        const services = await Service.find({ id_enseignant: user.idmembre }).session(session);
        for (const service of services) {
          cascadedDeletions.removedServiceIds.push(service.id_service);
        }
        
        const sessions = await Seance.find({ enseignant: teacher._id }).session(session);
        for (const seance of sessions) {
          cascadedDeletions.removedSessionIds.push(seance.id_seance);
        }

        // Supprimer les services et séances du prof
        await Service.deleteMany({ id_enseignant: user.idmembre }, { session });
        await Seance.deleteMany({ enseignant: teacher._id }, { session });
        
        // Supprimer le profil prof
        await Teacher.deleteOne({ _id: teacher._id }, { session });
      }
    }

    // ─────────────────────────────────────────────────
    // MARQUER COMME SUPPRIMÉ DÉFINITIVEMENT
    // ─────────────────────────────────────────────────
    const permanentlyDeletedAt = new Date();
    
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      isDeleted: true,
      deletedAt: permanentlyDeletedAt,
      deletionReason: 'expired_grace_period'
    }, { session });

    // ─────────────────────────────────────────────────
    // SUPPRIMER LES APPAREILS ASSOCIÉS
    // ─────────────────────────────────────────────────
    await Device.deleteMany({ userId: userId }, { session });

    // ─────────────────────────────────────────────────
    // METTRE À JOUR ARCHIVEACTION
    // ─────────────────────────────────────────────────
    await ArchiveAction.findOneAndUpdate(
      { userId: userId, actionType: 'soft_delete' },
      {
        actionType: 'hard_delete',
        permanentlyDeletedAt,
        cascadedDeletions
      },
      { session }
    );

    // ─────────────────────────────────────────────────
    // METTRE À JOUR ACCOUNTDELETION
    // ─────────────────────────────────────────────────
    await AccountDeletion.findOneAndUpdate(
      { userId: userId },
      {
        status: 'completed',
        completedAt: permanentlyDeletedAt
      },
      { session }
    );

    await session.commitTransaction();

    return { success: true, message: "Compte supprimé définitivement." };

  } catch (error) {
    await session.abortTransaction();
    console.error("Permanent deletion error:", error);
    return { success: false, message: error.message };
  } finally {
    session.endSession();
  }
};