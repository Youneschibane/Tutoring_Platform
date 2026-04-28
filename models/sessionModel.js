const mongoose = require("mongoose");
const Counter = require("./counterModel");

const seanceSchema = new mongoose.Schema({

  id_seance: {
    type: Number,
    unique: true
  },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },

  enseignant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher" ,
    required: true
  },

  titre : {
    type : String,
    required : true,
  },

  students: [
    {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
      idmembre: {
        type: Number,
        default: null
      },
      snapshot: {
        firstname: {
          type: String,
          default: null
        },
        familyname: {
          type: String,
          default: null
        },
        role: {
          type: String,
          default: null
        }
      },
      joinedAt: {
        type: Date,
        default: Date.now
      },
      isDeleted: {
        type: Boolean,
        default: false
      },
      deletedAt: {
        type: Date,
        default: null
      }
    }
  ],

  date_seance: {
    type: Date,
    required: true
  },

  heure_debut: {
    type: String,
    required: true
  },

  heure_fin: {
    type: String,
    required: true
  },

  nombre_max_participants: {
    type: Number,
    default: 1
  },

  mode: {
    type: String,
    enum: ["presentiel", "en_ligne"],
    required: true
  },

  lieu: {
    type: String
  },

  lien_visio: {
    type: String
  },
  prix: {
    type : Number,
    required : true
  },

  statut: {
    type: String,
    enum: ["libre", "confirmee", "annulee", "assuree", "reportee"],
    default: "libre"
  },



  notes_enseignant: {
    type: String
  },

  // ── archive metadata ────────────────────────
  archivedMeta: {
    isArchived: {
      type: Boolean,
      default: false
    },
    reason: {
      type: String,
      default: null
    },
    archivedAt: {
      type: Date,
      default: null
    },
    id_enseignant: {
      type: Number,
      default: null
    }
  }

}, { timestamps: true });

//  Auto-increment adapté à ton counterModel
seanceSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      "seances",            // _id du compteur
      { $inc: { seq: 1 } }, // incrémenter seq de 1
      { returnDocument: "after", upsert: true }
    );
    this.id_seance = counter.seq;
  }
  next();
});

// ─────────────────────────────────────────────
// INDEXES
// ─────────────────────────────────────────────
seanceSchema.index({ 'archivedMeta.isArchived': 1, enseignant: 1 });
seanceSchema.index({ 'students.userId': 1 });
seanceSchema.index({ 'students.isDeleted': 1 });

module.exports = mongoose.model("Seance", seanceSchema);