const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/authMiddleware'); 

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

module.exports = (io) => {
    // 1. SEND A MESSAGE (Protected)
    router.post('/', protect, upload.single('file'), async (req, res) => {
        try {
            const { conversationId, text } = req.body;
            const senderId = req.user.id; 
            let fileUrl = "";
            if (req.file) {
                fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
            }

            const newMessage = new Message({
                conversationId,
                sender: senderId,
                text,
                messageType: req.file ? (req.file.mimetype.startsWith('image') ? 'image' : 'file') : 'text',
                fileUrl
            });

            const savedMessage = await newMessage.save();

           
            await Conversation.findByIdAndUpdate(conversationId, {
                lastMessage: {
                    text: text || (req.file ? "File sent" : ""),
                    sender: senderId
                }
            });

            io.to(conversationId).emit('receive_message', savedMessage);
            res.status(200).json(savedMessage);
        } catch (err) {
            res.status(500).json({ error: 'Failed to send message' });
        }
    });

    // 2. GET HISTORY 
    router.get('/:conversationId', protect, async (req, res) => {
        try {
            const conv = await Conversation.findById(req.params.conversationId);
            
            // SECURITY: Check if user is part of this chat
            if (!conv.participants.includes(req.user.id)) {
                return res.status(403).json({ error: "Unauthorized access to this history" });
            }

            const messages = await Message.find({ conversationId: req.params.conversationId })
                                          .populate('sender', 'username profilePic');
            res.status(200).json(messages);
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch messages' });
        }
    });

    return router;
};

