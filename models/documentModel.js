const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({

  enseignant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true
  },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service"
  },

  seance: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Seance"
  },

  access_type: {
    type: String,
    enum: ["public", "private"],
    required: true
  },

  type_document: {
    type: String,
    enum: ["Support_cours", "Exercice", "Correction", "Autre"],
    required: true
  },

  nom_fichier: {
    type: String,
    required: true
  },

  chemin_fichier: {
    type: String,
    required: true
  },

  taille_fichier: {
    type: Number
  },

  description: {
    type: String
  }

}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);