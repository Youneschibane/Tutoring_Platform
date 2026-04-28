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

  // ── Photo de profil ──────────────────────────────────────────────────────
  
  photo_profil: {
    type: String,
    default: null
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
    
  
  reviewsCount: { type: Number, default: 0 },

  subjects: [{
    name: {
      type: String,
      required: true
    },
    cycle: {
      type: String,
      required: true
    }
  }]

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

const Teacher = mongoose.model('Teacher', enseignantSchema);

module.exports = Teacher;