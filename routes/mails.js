const express = require('express');
const router = express.Router();
const multer = require('multer');
const Mail = require('../models/Mail');
const User = require('../models/userModel');
const mongoose = require('mongoose');
const { protect } = require('../middleware/authMiddleware'); 

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => {
        const ext = file.originalname.split('.').pop();
        const baseName = file.originalname.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, `${Date.now()}-${baseName}.${ext}`);
    }
});
const upload = multer({ storage: storage });

const activeTimers = {};

module.exports = (io) => {
    // Helper to resolve email strings to ObjectIDs
    const resolveUsers = async (list) => {
        const resolved = [];
        for (const item of (Array.isArray(list) ? list : [list])) {
            if (mongoose.Types.ObjectId.isValid(item)) {
                resolved.push(new mongoose.Types.ObjectId(item));
            } else {
                const user = await User.findOne({ $or: [{ email: item }, { firstname: item }] });
                if (user) resolved.push(user._id);
            }
        }
        return resolved;
    };

    // 1. SEND MAIL 
    router.post('/send', protect, upload.array('attachments', 5), async (req, res) => {
        try {
            let { to, cc, bcc, subject, body, status } = req.body;
            const senderId = req.user.id;

            const attachments = req.files ? req.files.map(file => ({
                fileName: file.originalname,
                fileUrl: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
                fileType: file.mimetype
            })) : [];

            const mailData = {
                sender: senderId,
                to: await resolveUsers(JSON.parse(to || "[]")),
                cc: await resolveUsers(JSON.parse(cc || "[]")),
                bcc: await resolveUsers(JSON.parse(bcc || "[]")),
                subject,
                body,
                attachments,
                status: status === 'draft' ? 'draft' : 'queued'
            };

            const savedMail = await new Mail(mailData).save();

            if (status !== 'draft') {
                const timer = setTimeout(async () => {
                    const updated = await Mail.findByIdAndUpdate(savedMail._id, { status: 'sent', sentAt: Date.now() }, { new: true })
                                              .populate('sender', 'firstname familyname email profilePic');
                    
                    [...updated.to, ...(updated.cc || [])].forEach(id => {
                        io.to(id.toString()).emit('new_mail', { mail: updated });
                    });
                    delete activeTimers[savedMail._id];
                }, 40000);
                activeTimers[savedMail._id] = timer;
            }

            res.status(201).json({ success: true, mailId: savedMail._id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 2. GET MAILS BY TYPE 
    router.get('/list/:type', protect, async (req, res) => {
        try {
            const { type } = req.params;
            const userId = req.user.id; 
            let query = {};

            if (type === 'inbox') query = { $or: [{ to: userId }, { cc: userId }, { bcc: userId }], status: 'sent' };
            else if (type === 'sent') query = { sender: userId, status: 'sent' };
            else if (type === 'drafts') query = { sender: userId, status: 'draft' };
            else if (type === 'trash') query = { $or: [{ sender: userId }, { to: userId }], status: 'trash' };

            const mails = await Mail.find(query)
                .populate('sender', 'firstname familyname email profilePic')
                .populate('to', 'firstname familyname email profilePic')
                .sort({ createdAt: -1 });

            res.status(200).json(mails);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};