const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
    id_evaluation: { type: Number, required: true },
    id_participation: { type: Number, required: true },
    id_enseignant: { type: Number, required: true },
    id_eleve: { 
        type: Number, 
        required: true,
        ref: 'User'
    },
    note: { type: Number, required: true, min: 0, max: 5 },
    qualite_enseignement: { type: Number, required: true },
    ponctualite: { type: Number, required: true },
    carte_explication: { type: Number, required: true },
    pedagogie: { type: Number, required: true },
    commentaire: { type: String, required: true },
    date_evaluation: { type: Date, default: Date.now },
    visible: { type: Boolean, default: true }
});

module.exports = mongoose.model('Evaluation', evaluationSchema);