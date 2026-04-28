const Report = require('../models/Report');

// ==========================================
// TÂCHE 3 : Signaler un profil (POST)
// ==========================================
exports.reportProfile = async (req, res) => {
    try {
        // 1. On récupère l'ID de la personne signalée depuis l'URL
        const reportedUserId = req.params.id_user; 
        
        // 2. On récupère les données du formulaire envoyées par le front-end
        const { reporterId, reason, details,id_evaluation  } = req.body; 

        // 3. On crée le signalement
        const newReport = new Report({
            reportedUserId,
            reporterId,
            reason,
            details,
             id_evaluation: id_evaluation ?? null,
            status: 'En attente' // Par défaut, le statut est en attente de vérification par un admin
        });

        // On sauvegarde dans la base de données
        await newReport.save();

        // 4. On renvoie un message de succès (qui servira à afficher la page "Signalement envoyé")
        res.status(201).json({ 
            success: true, 
            message: "Signalement envoyé avec succès. Notre équipe va examiner la situation dans les plus brefs délais.",
            report: newReport
        });

    } catch (error) {
        res.status(500).json({ success: false, error: "Erreur lors de l'envoi du signalement : " + error.message });
    }
};