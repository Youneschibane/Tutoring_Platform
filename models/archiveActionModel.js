const mongoose = require('mongoose');

const archiveActionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
    // index: true (Removed to keep it clean)
  },
  idmembre: {
    type: Number,
    required: true
    // index: true (Removed: was causing duplicate warning)
  },
  role: {
    type: String,
    enum: ['parent', 'student', 'teacher', 'admin'],
    required: true
  },
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
  dataSnapshot: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  deletedBy: {
    type: String,
    enum: ['self', 'admin', 'system'],
    default: 'self'
  },
  adminNotes: String,
  retentionUntil: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    // index: true (Removed: was causing duplicate warning)
  },
  cascadedDeletions: {
    parentDeletionIds: [mongoose.Schema.Types.ObjectId],
    studentDeletionIds: [mongoose.Schema.Types.ObjectId],
    teacherDeletionIds: [mongoose.Schema.Types.ObjectId],
    removedSessionIds: [Number],
    removedServiceIds: [Number]
  }
}, { timestamps: true });

// ─────────────────────────────────────────────────
// INDEXES (Only defined once here)
// ─────────────────────────────────────────────────
archiveActionSchema.index({ userId: 1, role: 1 });
archiveActionSchema.index({ role: 1, permanentlyDeletedAt: -1 });
archiveActionSchema.index({ idmembre: 1 }); // Keeps this one
archiveActionSchema.index({ actionType: 1, createdAt: -1 });

// TTL Index — Cleanly defined once
archiveActionSchema.index({ retentionUntil: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ArchiveAction', archiveActionSchema);