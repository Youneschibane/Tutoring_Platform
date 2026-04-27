const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation'); // IMPORTÉ ICI
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

module.exports = (io) => {
    // 1. ENVOYER UN MESSAGE
    router.post('/', upload.single('file'), async (req, res) => {
        try {
            const { conversationId, sender, text } = req.body;
            
            let fileUrl = "";
            if (req.file) {
                fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }

            const newMessage = new Message({
                conversationId,
                sender,
                text,
                messageType: req.file ? (req.file.mimetype.startsWith('image') ? 'image' : 'file') : 'text',
                fileUrl
            });

            const savedMessage = await newMessage.save();

            // --- NOUVEAU : MISE À JOUR DU DERNIER MESSAGE ---
            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    text: text || (req.file ? "Fichier envoyé" : ""),
                    sender: sender
                }
            });

            // EMISSION TEMPS RÉEL
            io.to(conversationId).emit('receive_message', savedMessage);

            res.status(200).json(savedMessage);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // 2. RÉCUPÉRER L'HISTORIQUE (avec populate pour voir qui a envoyé quoi)
    router.get('/:conversationId', async (req, res) => {
        try {
            const messages = await Message.find({ conversationId: req.params.conversationId })
                                          .populate('sender', 'username'); // Optionnel : pour avoir le nom
            res.status(200).json(messages);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    });

    return router;
};