const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: { type: String }, // Optionnel si c'est un fichier
    fileUrl: { type: String }, // URL de l'image ou du fichier
    messageType: { 
        type: String, 
        enum: ['text', 'image', 'file'], 
        default: 'text' 
    }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);