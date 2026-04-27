const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportedUserId: { type: Number, required: true }, // L'ID de l'utilisateur signalé
    reporterId: { type: Number, required: true },     // L'ID de celui qui signale
    reason: { type: String, required: true },         // La raison (ex: "Harcèlement")
    details: { type: String }, 
    id_evaluation: { type: Number, default: null },                     
    status: { 
        type: String, 
        enum: ['En attente', 'En cours', 'Traité'], 
        default: 'En attente' 
    }
}, { timestamps: true }); // Ajoute automatiquement createdAt et updatedAt

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;