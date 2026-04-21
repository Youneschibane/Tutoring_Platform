const mongoose = require('mongoose');

const mailSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    to: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    }],
    cc: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    bcc: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    subject: { 
        type: String, 
        required: true,
        default: "(Sans objet)"
    },
    body: { 
        type: String, // HTML du Rich Text Editor
    },
    attachments: [
        {
            fileName: String,
            fileUrl: String,
            fileType: String
        }
    ],
    status: {
        type: String,
        enum: ['draft', 'queued', 'sent', 'trash', 'inbox'],
        default: 'queued'
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
    sentAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Mail', mailSchema);