const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    reportedUserId: { type: Number, required: true }, 
    reporterId: { type: Number, required: true },     
    reason: { type: String, required: true },         
    details: { type: String }, 
    id_evaluation: { type: Number, default: null },                     
    status: { 
        type: String, 
        enum: ['En attente', 'En cours', 'Traité'], 
        default: 'En attente' 
    }
}, { timestamps: true }); 

const Report = mongoose.model('Report', reportSchema);
module.exports = Report;