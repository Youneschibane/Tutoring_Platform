const mongoose = require('mongoose');

/**
 * @model ArchiveAction
 * @description Collection pour tracer les suppressions définitives de comptes
 * Cette collection enregistre les actions de suppression avec audit complet
 */
const archiveActionSchema = new mongoose.Schema({
  
  // ─────────────────────────────────────────────────
  // RÉFÉRENCES À L'UTILISATEUR SUPPRIMÉ
  // ─────────────────────────────────────────────────
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'User'
  },

  idmembre: {
    type: Number,
    required: true,
    index: true
  },

  firstname: String,
  familyname: String,
  email: {
    type: String,
    sparse: true
  },
  numberphone: {
    type: String,
    sparse: true
  },

  role: {
    type: String,
    enum: ['parent', 'student', 'teacher', 'admin'],
    required: true,
    index: true
  },

  // ─────────────────────────────────────────────────
  // INFORMATIONS DE SUPPRESSION
  // ─────────────────────────────────────────────────
  actionType: {
    type: String,
    enum: ['soft_delete', 'hard_delete', 'cascade_delete'],
    default: 'soft_delete',
    required: true
  },

  deletionReason: {
    type: String,
    enum: [
      'user_request',
      'admin_deletion',
      'account_inactivity',
      'violation',
      'expired_grace_period',
      'cascade_parent_deletion',
      'cascade_teacher_deletion'
    ],
    default: 'user_request'
  },

  deletionScheduledAt: {
    type: Date,
    required: true
  },

  permanentlyDeletedAt: {
    type: Date,
    default: null
  },

  // ─────────────────────────────────────────────────
  // SNAPSHOT DES DONNÉES (pour conformité)
  // ─────────────────────────────────────────────────
  userSnapshot: mongoose.Schema.Types.Mixed,
  roleDataSnapshot: mongoose.Schema.Types.Mixed,

  // ─────────────────────────────────────────────────
  // INFORMATIONS SUPPLÉMENTAIRES
  // ─────────────────────────────────────────────────
  deletedBy: {
    type: String,
    enum: ['self', 'admin', 'system'],
    default: 'self'
  },

  adminNotes: String,

  // ─────────────────────────────────────────────────
  // RETENTION (pour conformité RGPD)
  // ─────────────────────────────────────────────────
  retentionUntil: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 an par défaut
    index: true
  },

  // Références vers les entités supprimées
  cascadedDeletions: {
    parentDeletionIds: [mongoose.Schema.Types.ObjectId],
    studentDeletionIds: [mongoose.Schema.Types.ObjectId],
    teacherDeletionIds: [mongoose.Schema.Types.ObjectId],
    removedSessionIds: [Number],
    removedServiceIds: [Number]
  }

}, { timestamps: true });

// ─────────────────────────────────────────────────
// INDEX
// ─────────────────────────────────────────────────
archiveActionSchema.index({ role: 1, permanentlyDeletedAt: -1 });
archiveActionSchema.index({ idmembre: 1 });
archiveActionSchema.index({ email: 1 }, { sparse: true });
archiveActionSchema.index({ numberphone: 1 }, { sparse: true });

// TTL Index — suppression automatique après retentionUntil
archiveActionSchema.index({ retentionUntil: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ArchiveAction', archiveActionSchema);
