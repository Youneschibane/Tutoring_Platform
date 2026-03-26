const express = require('express');
const router = express.Router();
const Mail = require('../models/Mail');
const multer = require('multer');
const path = require('path');

// Configuration Multer pour les pièces jointes
const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, 'uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + '-' + file.originalname); }
});
const upload = multer({ storage: storage });

// Stockage temporaire des timers pour l'annulation (Undo)
const activeTimers = {};

module.exports = (io) => {

    // 1. ENVOYER UN MAIL (LANCE LE TIMER DE 60 SECONDES)
    router.post('/send', upload.array('attachments', 5), async (req, res) => {
        try {
            const { sender, to, cc, bcc, subject, body } = req.body;
            
            const attachments = req.files.map(file => ({
                fileName: file.originalname,
                fileUrl: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
                fileType: file.mimetype
            }));

            const newMail = new Mail({
                sender,
                to: JSON.parse(to),
                cc: cc ? JSON.parse(cc) : [],
                bcc: bcc ? JSON.parse(bcc) : [],
                subject,
                body,
                attachments,
                status: 'queued'
            });

            const savedMail = await newMail.save();

            // LOGIQUE UNDO : On attend 60 secondes avant de valider l'envoi
            const timer = setTimeout(async () => {
                await Mail.findByIdAndUpdate(savedMail._id, { 
                    status: 'sent', 
                    sentAt: Date.now() 
                });
                
                // Notification via Socket.io aux destinataires (To et Cc uniquement, pas Bcc pour rester anonyme)
                const recipients = [...newMail.to, ...(newMail.cc || [])];
                recipients.forEach(id => {
                    io.to(id.toString()).emit('new_mail', { message: "Nouveau mail reçu", mailId: savedMail._id });
                });

                delete activeTimers[savedMail._id];
                console.log(`Mail ${savedMail._id} officiellement envoyé.`);
            }, 60000); // 60 000 ms = 1 minute

            activeTimers[savedMail._id] = timer;

            res.status(201).json({ message: "Mail en cours d'envoi...", mailId: savedMail._id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    // 2. ANNULER L'ENVOI (UNDO)
    router.post('/undo/:mailId', async (req, res) => {
        const { mailId } = req.params;

        if (activeTimers[mailId]) {
            clearTimeout(activeTimers[mailId]); // On arrête le chrono
            delete activeTimers[mailId];

            await Mail.findByIdAndUpdate(mailId, { status: 'draft' });
            res.status(200).json({ message: "Envoi annulé. Le mail est retourné dans les brouillons." });
        } else {
            res.status(400).json({ error: "Le délai d'annulation est dépassé ou le mail n'existe pas." });
        }
    });

    // 3. RÉCUPÉRER LA BOÎTE DE RÉCEPTION
    router.get('/inbox/:userId', async (req, res) => {
        try {
            const userId = req.params.userId;
            const mails = await Mail.find({
                $or: [
                    { to: userId },
                    { cc: userId },
                    { bcc: userId }
                ],
                status: 'sent'
            })
            .populate('sender', 'username profilePic')
            .sort({ sentAt: -1 });

            res.status(200).json(mails);
        } catch (err) {
            res.status(500).json(err);
        }
    });

    return router;
};