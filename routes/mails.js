const express = require('express');
const router = express.Router();
const multer = require('multer');
const Mail = require('../models/Mail');
const User = require('../models/userModel');
const mongoose = require('mongoose');

// Configuration Multer — nom de fichier SANS espaces ni caractères spéciaux
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        // FIX : remplacer espaces et caractères spéciaux pour éviter %20 dans l'URL
        const ext = file.originalname.split('.').pop(); // extension : pdf, docx...
        const baseName = file.originalname
            .replace(/\.[^/.]+$/, '')           // enlever l'extension
            .replace(/\s+/g, '_')               // espaces → underscore
            .replace(/[^a-zA-Z0-9._-]/g, '');  // autres caractères spéciaux → supprimés
        const cleanName = `${Date.now()}-${baseName}.${ext}`;
        cb(null, cleanName);
    }
});
const upload = multer({ storage: storage });

// Stockage des timers pour la fonction "Annuler l'envoi"
const activeTimers = {};

module.exports = (io) => {

    // 1. ENVOYER UN MAIL (AVEC TIMER DE 40s ET SOCKET.IO)
    router.post('/send', upload.array('attachments', 5), async (req, res) => {
        console.log("ROUTE /send touchée !");
        try {
            let { sender, to, cc, bcc, subject, body, status } = req.body;

            const safeParse = (data) => {
                if (!data) return [];
                if (typeof data === 'string') {
                    try {
                        const parsed = JSON.parse(data);
                        return Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        return [data];
                    }
                }
                return Array.isArray(data) ? data : [data];
            };

            const parsedTo = safeParse(to);
            const parsedCc = safeParse(cc);
            const parsedBcc = safeParse(bcc);

            // Convertir emails/IDs en ObjectIds
            const resolveUsers = async (list) => {
                const resolved = [];
                for (const item of list) {
                    if (mongoose.Types.ObjectId.isValid(item)) {
                        resolved.push(new mongoose.Types.ObjectId(item));
                    } else {
                        const user = await User.findOne({
                            $or: [{ email: item }, { firstname: item }]
                        });
                        if (user) resolved.push(user._id);
                    }
                }
                return resolved;
            };

            const resolvedTo = await resolveUsers(parsedTo);
            const resolvedCc = await resolveUsers(parsedCc);
            const resolvedBcc = await resolveUsers(parsedBcc);

            // URL propre sans espaces ni %20
            const attachments = req.files ? req.files.map(file => ({
                fileName: file.originalname,  // nom original pour l'affichage
                fileUrl: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`, // filename propre sur disque
                fileType: file.mimetype
            })) : [];

            //  Si status=draft (sauvegarde brouillon depuis compose), on n'attend pas 40s
            if (status === 'draft') {
                const draftMail = new Mail({
                    sender: new mongoose.Types.ObjectId(sender),
                    to: resolvedTo,
                    cc: resolvedCc,
                    bcc: resolvedBcc,
                    subject,
                    body,
                    attachments,
                    status: 'draft'
                });
                const saved = await draftMail.save();
                return res.status(201).json({
                    success: true,
                    message: "Brouillon sauvegardé",
                    mailId: saved._id
                });
            }

            const newMail = new Mail({
                sender: new mongoose.Types.ObjectId(sender),
                to: resolvedTo,
                cc: resolvedCc,
                bcc: resolvedBcc,
                subject,
                body,
                attachments,
                status: 'queued'
            });

            const savedMail = await newMail.save();
            console.log("Mail en attente ID:", savedMail._id);

            const timer = setTimeout(async () => {
                const updatedMail = await Mail.findByIdAndUpdate(savedMail._id, {
                    status: 'sent',
                    sentAt: Date.now()
                }, { new: true });

                const fullMail = await Mail.findById(updatedMail._id)
                    .populate('sender', 'firstname familyname email profilePic');

                const recipients = [...fullMail.to, ...(fullMail.cc || [])];
                recipients.forEach(id => {
                    io.to(id.toString()).emit('new_mail', {
                        message: "Nouveau mail reçu",
                        mail: fullMail
                    });
                });

                console.log(` Mail "${fullMail.subject}" envoyé définitivement.`);
                delete activeTimers[savedMail._id];
            }, 40000);

            activeTimers[savedMail._id] = timer;

            return res.status(201).json({
                success: true,
                message: "Mail mis en file d'attente (40s)",
                mailId: savedMail._id
            });

        } catch (err) {
            console.error(" Erreur Send:", err);
            return res.status(500).json({ error: err.message });
        }
    });

    //  ANNULER L'ENVOI (UNDO)
    router.post('/undo/:mailId', async (req, res) => {
        const { mailId } = req.params;
        if (activeTimers[mailId]) {
            clearTimeout(activeTimers[mailId]);
            delete activeTimers[mailId];
            await Mail.findByIdAndUpdate(mailId, { status: 'draft' });
            res.status(200).json({ message: "Envoi annulé, remis en brouillons." });
        } else {
            res.status(400).json({ error: "Trop tard ou ID invalide." });
        }
    });

    //  DÉTAILS D'UN MAIL
    router.get('/detail/:id', async (req, res) => {
        try {
            const mail = await Mail.findById(req.params.id)
                .populate('sender', 'firstname familyname email profilePic')
                .populate('to', 'firstname familyname email profilePic')
                .populate('cc', 'firstname familyname email profilePic');
            if (!mail) return res.status(404).json({ error: "Mail introuvable" });
            res.status(200).json(mail);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    //  MARQUER COMME LU
    router.patch('/:id/read', async (req, res) => {
        try {
            const { isRead } = req.body;
            const updated = await Mail.findByIdAndUpdate(
                req.params.id,
                { isRead },
                { new: true }
            );
            res.status(200).json({ message: "Statut lu mis à jour", mail: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    //  RÉCUPÉRATION DES MAILS PAR TYPE
    router.get('/:type/:userId', async (req, res) => {
        try {
            const { type, userId } = req.params;
            const userObjectId = new mongoose.Types.ObjectId(userId);
            let query = {};

            if (type === 'inbox') {
                query = {
                    $or: [{ to: userObjectId }, { cc: userObjectId }, { bcc: userObjectId }],
                    status: 'sent'
                };
            } else if (type === 'sent') {
                query = { sender: userObjectId, status: 'sent' };
            } else if (type === 'drafts') {
                query = { sender: userObjectId, status: 'draft' };
            } else if (type === 'trash') {
                query = {
                    $or: [{ sender: userObjectId }, { to: userObjectId }],
                    status: 'trash'
                };
            } else {
                return res.status(400).json({ error: `Type inconnu : ${type}` });
            }

            const mails = await Mail.find(query)
                .populate('sender', 'firstname familyname email profilePic')
                .populate('to', 'firstname familyname email profilePic')
                .sort({ createdAt: -1 });

            res.status(200).json(mails);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    //  CHANGER LE STATUT (corbeille, etc.)
    router.patch('/:id', async (req, res) => {
        try {
            const updated = await Mail.findByIdAndUpdate(
                req.params.id,
                req.body,
                { new: true }
            );
            res.status(200).json({ message: "Mise à jour réussie", mail: updated });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
