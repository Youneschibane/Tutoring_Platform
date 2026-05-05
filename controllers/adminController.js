const User = require('../models/userModel');
const Evaluation = require('../models/Evaluation');
const Mail = require('../models/Mail');
const Report = require('../models/Report');


// --- Tâche 1 : Bannir un utilisateur ---
exports.banUser = async (req, res) => {
    try {
        const { idmembre, dureeEnJours, estDefinitif } = req.body;

       
        let banUpdate = { banned: true }; 

        if (estDefinitif) {
            
            banUpdate.banExpiresAt = null; 
            banUpdate.isPermanentlyBanned = true;
        } else if (dureeEnJours && dureeEnJours > 0) {
            // Temporary Ban Logic
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + dureeEnJours);
            
            banUpdate.banExpiresAt = expirationDate;
            banUpdate.isPermanentlyBanned = false;
        } else {
            return res.status(400).json({ 
                message: "Veuillez spécifier une durée ou choisir un bannissement définitif." 
            });
        }

        const user = await User.findOneAndUpdate(
            { idmembre: idmembre },
            banUpdate,
            { new: true }
        );

        if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });

        const message = estDefinitif 
            ? `L'accès de ${user.firstname} a été révoqué définitivement.` 
            : `L'accès de ${user.firstname} a été suspendu pour ${dureeEnJours} jour(s).`;

        res.status(200).json({ 
            message, 
            banned: user.banned,
            banExpiresAt: user.banExpiresAt 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
// --- Tâche 2 : Modérer une évaluation (Commentaire) ---
exports.moderateEvaluation = async (req, res) => {
    try {
        const { id_evaluation } = req.params;
        // On utilise 'visible: false' pour masquer au lieu de supprimer (plus sûr)
        const evaluation = await Evaluation.findOneAndUpdate(
            { id_evaluation: id_evaluation },
            { visible: false },
            { new: true }
        );
        if (!evaluation) return res.status(404).json({ message: "Évaluation introuvable." });
        res.status(200).json({ message: "Le commentaire a été masqué par l'admin." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- Tâche 3 : Boîte Mail Admin ---
exports.getAdminMailbox = async (req, res) => {
    try {
        // Récupère les mails envoyés à l'admin connecté
        // On utilise ._id car le modèle Mail utilise des ObjectIds
        const emails = await Mail.find({ to: req.user._id, status: 'inbox' })
            .populate('sender', 'firstname familyname email role')
            .sort({ createdAt: -1 });
        res.status(200).json(emails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
// Lister tous les signalements
exports.getReports = async (req, res) => {
  try {
    const reports = await Report.find().sort({ createdAt: -1 });
    
    // Enrichir chaque report avec les noms depuis User
    const enriched = await Promise.all(reports.map(async (r) => {
      const reporter = await User.findOne({ idmembre: r.reporterId });
      const reported = await User.findOne({ idmembre: r.reportedUserId });
           
      return {
        ...r.toObject(),
        reporterName: reporter ? `${reporter.firstname} ${reporter.familyname}` : `#${r.reporterId}`,
        reportedName: reported ? `${reported.firstname} ${reported.familyname}` : `#${r.reportedUserId}`,
      };
    }));

    res.status(200).json({ status: 'success', data: enriched });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Détail d'un signalement
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Signalement introuvable.' });

    const reporter = await User.findOne({ idmembre: report.reporterId });
    const reported = await User.findOne({ idmembre: report.reportedUserId });

    res.status(200).json({
      status: 'success',
      data: {
        ...report.toObject(),
        reporterName: reporter ? `${reporter.firstname} ${reporter.familyname}` : `#${report.reporterId}`,
        reportedName: reported ? `${reported.firstname} ${reported.familyname}` : `#${report.reportedUserId}`,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Changer le statut d'un signalement
exports.updateReportStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!report) return res.status(404).json({ message: 'Signalement introuvable.' });
    res.status(200).json({ status: 'success', data: report });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReport = async (req, res) => {
  try {
    await Report.findByIdAndDelete(req.params.id);
    res.status(200).json({ status: 'success', message: 'Signalement supprimé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Détail d'un signalement
exports.getReportById = async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Signalement introuvable.' });

    const reporter = await User.findOne({ idmembre: report.reporterId });
    const reported = await User.findOne({ idmembre: report.reportedUserId });

    const evaluation = report.id_evaluation 
      ? await Evaluation.findOne({ id_evaluation: report.id_evaluation })
      : null;

    res.status(200).json({
      status: 'success',
      data: {
        ...report.toObject(),
        reporterName: reporter ? `${reporter.firstname} ${reporter.familyname}` : `#${report.reporterId}`,
        reportedName: reported ? `${reported.firstname} ${reported.familyname}` : `#${report.reportedUserId}`,
        commentaire: evaluation?.commentaire || null,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};