const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({

  // ─────────────────────────────
  // IDENTIFIANT
  // ─────────────────────────────
  id_enseignant: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },

  // ─────────────────────────────
  // ACCEPTATION ADMIN
  // ─────────────────────────────
  accepted: {
    type: Boolean,
    default: false,
    index: true
  },

  acceptanceStatus: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },

  rejectionReason: {
    type: String,
    default: null
  },

  reviewedAt: {
    type: Date,
    default: null
  },

  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // ─────────────────────────────
  // PROFIL PROF
  // ─────────────────────────────
  nature: {
    type: String,
    enum: ['Independent', 'Etablissement', 'Centre'],
    required: true,
    index: true
  },

  description_pedagogique: {
    type: String,
    required: true
  },

  deplacement: {
    type: Boolean,
    required: true
  },

  rayon_deplacement: {
    type: Number,
    required: true,
    default: 0
  },

  modalite: {
    type: String,
    enum: ['En ligne', 'En présentiel', 'Hybride'],
    default: 'En ligne'
  },

  // ─────────────────────────────
  // GEO LOCATION (UBER STYLE)
  // ─────────────────────────────
  latitude: {
    type: Number,
    default: 0
  },

  longitude: {
    type: Number,
    default: 0
  },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [lng, lat]
      default: [0, 0]
    }
  },

  // ─────────────────────────────
  // STATS
  // ─────────────────────────────
  rating: {
    type: Number,
    default: 0
  },

  reviewsCount: {
    type: Number,
    default: 0
  },

  online: {
    type: Boolean,
    default: false
  },

  actif: {
    type: Boolean,
    default: true,
    index: true
  },

  // ─────────────────────────────
  // MATIÈRES
  // ─────────────────────────────
  subjects: [
    {
      name: {
        type: String,
        required: true
      },
      cycle: {
        type: String,
        required: true
      }
    }
  ],

  // ─────────────────────────────
  // DOCUMENTS
  // ─────────────────────────────
  documents: {
    cv: {
      url: String,
      publicId: String,
      uploadedAt: Date
    },

    diplomes: [
      {
        url: { type: String, required: true },
        publicId: { type: String, required: true },
        nom: String,
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  }

}, {
  timestamps: true
});


// ─────────────────────────────
// GEO INDEX (IMPORTANT)
// ─────────────────────────────
teacherSchema.index({ location: '2dsphere' });
teacherSchema.index({ rating: -1 });
teacherSchema.index({ acceptanceStatus: 1 });


// ─────────────────────────────
// AUTO GEO SYNC (SAFE VERSION)
// ─────────────────────────────
teacherSchema.pre('save', function () {
  if (
    typeof this.latitude === 'number' &&
    typeof this.longitude === 'number'
  ) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
});


const Teacher = mongoose.model('Teacher', teacherSchema);

module.exports = Teacher;