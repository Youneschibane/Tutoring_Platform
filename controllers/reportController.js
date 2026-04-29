const Report = require('../models/Report');

// ==========================================
// TÂCHE 3 : Signaler un profil (POST)
// ==========================================


exports.reportProfile = async (req, res) => {
    try {
        const reportedUserId = Number(req.params.id_user); 
        const { reason, details, id_evaluation } = req.body;
        const reporterId = Number(req.body.reporterId);      

        const newReport = new Report({
            reportedUserId,
            reporterId,
            reason,
            details,
            id_evaluation: id_evaluation ?? null,
            status: 'En attente'
        });

        await newReport.save();

        res.status(201).json({ 
            success: true, 
            message: "Signalement envoyé avec succès.",
            report: newReport
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Erreur : " + error.message });
    }
};