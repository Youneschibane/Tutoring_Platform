const mongoose = require('mongoose');

const enseignantSchema = new mongoose.Schema({

  id_enseignant: {
    type: Number,
    required: true
  },

  // ── Acceptation par l'admin ──────────────────────────────────────────────
  // false par défaut : le teacher ne peut rien faire tant que l'admin n'accepte pas
  accepted: {
    type: Boolean,
    default: false,
    required: true
  },

 
  nature: {
    type: String,
    required: true,
    enum: ["Independant", "Etablissement", "Centre"]
  },

  // ── Localisation (lat/lng séparés + GeoJSON pour recherche 2dsphere) ─────
  latitude: {
    type: Number,
    required: true
  },

  longitude: {
    type: Number,
    required: true
  },
// ── Photo de profil ──────────────────────────────────────────────────────
  
  photo_profil: {
    type: String,
    default: null
  },

  // Champ GeoJSON généré automatiquement pour l'index 2dsphere
  // FIX: le schéma original indexait 'location' qui n'existait pas
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    }
  },

  deplacement: {
    type: Boolean,
    required: true
  },

  rayon_deplacement: {
    type: Number,
    required: true
  },

  description_pedagogique: {
    type: String,
    required: true
  },

  certifications: {
    type: String,
    required: true
  },

  actif: {
    type: Boolean,
    required: true
  },

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
  modalite:{
    //type enum
    type:String ,
    enum: ["En ligne", "En présentiel", "Hybride"],
  },

  subjects: [{
    name: {
      type: String,
      required: true
    },
    cycle: {
      type: String,
      required: true
    }
  }],

  // ── Workflow de validation des enseignants ────────────────────────────────
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
    default: null,
    ref: 'User'
  },

// ── Documents de candidature (soumis à l'inscription) ────────────────────────
documents: {

  cv: {
    url:        { type: String, default: null },  // Cloudinary URL
    publicId:   { type: String, default: null },  // pour suppression Cloudinary
    uploadedAt: { type: Date,   default: null }
  },

  diplomes: [{
    url:        { type: String, required: true },
    publicId:   { type: String, required: true },
    nom:        { type: String, default: null }, // ex: "Licence Mathématiques"
    uploadedAt: { type: Date,   default: Date.now }
  }]

}


});

// ── Synchroniser location GeoJSON depuis latitude/longitude avant save ──────
enseignantSchema.pre('save', function (next) {
  if (this.latitude != null && this.longitude != null) {
    this.location = {
      type: 'Point',
      coordinates: [this.longitude, this.latitude]
    };
  }
  next();
});

// ── Index 2dsphere sur le vrai champ GeoJSON ─────────────────────────────────
enseignantSchema.index({ location: '2dsphere' });
enseignantSchema.index({ rating: -1 });
enseignantSchema.index({ acceptanceStatus: 1 });

const Teacher = mongoose.model('Teacher', enseignantSchema);

module.exports = Teacher;