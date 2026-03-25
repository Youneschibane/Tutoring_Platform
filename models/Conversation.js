const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User', // Assure-toi que ton modèle User s'appelle bien 'User'
            required: true 
        }
    ],
    lastMessage: {
        text: { type: String },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    }
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);