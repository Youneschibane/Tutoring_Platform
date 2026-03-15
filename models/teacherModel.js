const mongoose = require('mongoose');

const enseignant = new mongoose.Schema({

  id_enseignant: {
    type: Number,
    required: true,
    unique: true
  },

  nature: {
    type: String,
    required: true,
    enum: ["Independant", "Etablissement", "Center"]
  },

  
  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },

  deplacement: {
    type: Boolean,
    required: true
  },

  rayon_deplacement: {
    type: Number,
    required: true // meters
  },

  description_pedagogique: {
    type: String,
    required: true
  },

  parcours_academique: {
    type: String,
    required: true
  },

  experience_professionnelle: {
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

  subjects: [{
    type: String
  }]

});

 // GEO INDEX 
enseignant.index({ location: "2dsphere" });

enseignant.index({ rating: -1 });

const Teacher = mongoose.model("Teacher", enseignant);

module.exports = Teacher;