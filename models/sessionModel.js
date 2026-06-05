const mongoose = require('mongoose');
const Counter  = require('./counterModel');

// ═══════════════════════════════════════════════════════════════
// SUB-SCHEMA — STUDENT ENTRY
// Supports two booking types:
//   - student books for themselves  → userId set, bookedBy null
//   - parent books for their child  → userId null, bookedBy = parent User ObjectId
// ═══════════════════════════════════════════════════════════════

const studentEntrySchema = new mongoose.Schema(
  {
    // ObjectId of the enrolled User (null when child has no User account)
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: false,
      default:  null
    },

    // Numeric member ID — used as the primary lookup key for children
    idmembre: {
      type:    Number,
      default: null
    },

    // ── Who made the booking ──────────────────────────────────
    // null  → the student booked themselves
    // set   → a parent booked on behalf of their child
    bookedBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: false,
      default:  null
    },
    bookedByIdmembre: {
      type:    Number,
      default: null
    },

    // ── Immutable snapshot at booking time ───────────────────
    snapshot: {
      firstname:  { type: String, default: null },
      familyname: { type: String, default: null },
      role:       { type: String, default: null }
    },

    joinedAt:  { type: Date,    default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null }
  },
  { _id: true }
);

// ═══════════════════════════════════════════════════════════════
// MAIN SCHEMA — SEANCE
// ═══════════════════════════════════════════════════════════════

const seanceSchema = new mongoose.Schema(
  {
    id_seance: {
      type:   Number,
      unique: true
    },

    service: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Service',
      required: true
    },

    enseignant: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Teacher',
      required: true
    },

    titre: {
      type:     String,
      required: true,
      trim:     true
    },

    // ── Participants ──────────────────────────────────────────
    students: [studentEntrySchema],

    // ── Scheduling ────────────────────────────────────────────
    date_seance: {
      type:     Date,
      required: true
    },

    // stored as "HH:mm" strings — Algeria UTC+1, no DST
    heure_debut: {
      type:     String,
      required: true
    },
    heure_fin: {
      type:     String,
      required: true
    },

    nombre_max_participants: {
      type:    Number,
      default: 1
    },

    // ── Delivery ──────────────────────────────────────────────
    mode: {
      type:     String,
      enum:     ['presentiel', 'en_ligne'],
      required: true
    },
    lieu:       { type: String },
    lien_visio: { type: String },

    prix: {
      type:     Number,
      required: true
    },

    statut: {
      type:    String,
      enum:    ['libre', 'confirmee', 'annulee', 'assuree', 'reportee'],
      default: 'libre'
    },

    notes_enseignant: { type: String },

    // ── Archive metadata ──────────────────────────────────────
    archivedMeta: {
      isArchived: { type: Boolean, default: false },
      reason:     { type: String,  default: null },
      archivedAt: { type: Date,    default: null },
      id_enseignant: { type: Number, default: null }
    }
  },
  { timestamps: true }
);

// ═══════════════════════════════════════════════════════════════
// MIDDLEWARE — auto-increment id_seance
// ═══════════════════════════════════════════════════════════════

seanceSchema.pre('save', async function () {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      'seances',
      { $inc: { seq: 1 } },
      { returnDocument: 'after', upsert: true }
    );
    this.id_seance = counter.seq;
  }
});

// ═══════════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════════

// Teacher dashboard queries
seanceSchema.index({ 'archivedMeta.isArchived': 1, enseignant: 1 });

// Student session lookups — primary key for children (no User account)
seanceSchema.index({ 'students.idmembre': 1 });

// Soft-delete filter
seanceSchema.index({ 'students.isDeleted': 1 });

// Parent "sessions I booked" queries
seanceSchema.index({ 'students.bookedByIdmembre': 1 });

// Legacy — keep for enrolled Users that DO have accounts
seanceSchema.index({ 'students.userId': 1 });

module.exports = mongoose.model('Seance', seanceSchema);
