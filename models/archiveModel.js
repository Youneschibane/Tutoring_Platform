const mongoose = require('mongoose');

const archiveSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, required: true },
  idmembre:   { type: Number, required: true },
  firstname:  String,
  familyname: String,
  email:      { type: String },        //  sparse retiré ici
  numberphone:{ type: String },        //  sparse retiré ici

  role: {
    type: String,
    enum: ['parent', 'student', 'teacher', 'admin'],
    required: true
  },

  roleData:             { type: mongoose.Schema.Types.Mixed, default: {} },
  deletionReason:       String,
  deletionScheduledAt:  Date,
  permanentlyDeletedAt: { type: Date, default: Date.now },
  userSnapshot:         mongoose.Schema.Types.Mixed,
  deviceSnapshot:       mongoose.Schema.Types.Mixed,

  retentionUntil: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }

}, { timestamps: true });

// Cleanup expired archives (TTL)
archiveSchema.index({ retentionUntil: 1 }, { expireAfterSeconds: 0 });

// Traceability queries
archiveSchema.index({ role: 1, permanentlyDeletedAt: -1 });
archiveSchema.index({ idmembre: 1 });
archiveSchema.index({ email: 1 },       { sparse: true }); //  sparse ici
archiveSchema.index({ numberphone: 1 }, { sparse: true }); //  sparse ici aussi

module.exports = mongoose.model('Archive', archiveSchema);