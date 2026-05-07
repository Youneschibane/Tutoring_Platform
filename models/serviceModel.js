const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({

  id_service: { type: Number, required: true, unique: true },

  id_enseignant: { type: Number, required: true, index: true },

  // ← sorti de archivedMeta, au bon niveau
  id_enseignant_mongoose: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  nom_service: { type: String, required: true, trim: true },

  type_service: {
    type: String,
    required: true,
    enum: ["Individuel", "Groupe"]
  },

  matiere: { type: String, required: true, index: true },

  niveau_concerne: {
    type: String,
    required: true,
    enum: ["Primaire", "College", "Lycee", "ESI"],
    index: true
  },

  annee_concerne: { type: String, required: true },

  description: { type: String, required: true, trim: true },

  actif: { type: Boolean, required: true, default: true },

  nombre_max_participants: { type: Number, required: true, min: 1 },

  prix: { type: Number, required: true, min: 0 },

  duree_seance: { type: Number, required: true },

  date_creation: { type: Date, default: Date.now, index: true },

  // ── soft delete ──────────────────────────────
  isDeleted: { type: Boolean, default: false, index: true },

  // ── suspension admin ─────────────────────────
  suspendu: { type: Boolean, default: false, index: true },
  suspendedAt: { type: Date, default: null },
  suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  suspensionReason: { type: String, default: null },

  // ── archive metadata ─────────────────────────
  archivedMeta: {
    isArchived: { type: Boolean, default: false },
    reason: { type: String, default: null },
    archivedAt: { type: Date, default: null },
    id_enseignant: { type: Number, default: null }
  }

}, { timestamps: false });

// ── Indexes ───────────────────────────────────
serviceSchema.index({ isDeleted: 1, suspendu: 1, date_creation: -1 });
serviceSchema.index({ nom_service: 'text', matiere: 'text' });
serviceSchema.index({ prix: 1, niveau_concerne: 1 });
serviceSchema.index({ 'archivedMeta.isArchived': 1, id_enseignant: 1 });

serviceSchema.pre('save', async function () {
  if (!this.id_enseignant_mongoose && this.id_enseignant) {
    const User = mongoose.model('User');
    const user = await User.findOne({ idmembre: this.id_enseignant });
    if (user) this.id_enseignant_mongoose = user._id;
  }
});

module.exports = mongoose.model('Service', serviceSchema);