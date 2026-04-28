const User = require('../models/userModel');
const Evaluation = require('../models/Evaluation');
const Mail = require('../models/Mail');
const Report = require('../models/Report');


// --- Tâche 1 : Bannir un utilisateur ---
exports.banUser = async (req, res) => {
  try {
    const { idmembre, duration } = req.body;
    
    let bannedUntil = null;
    if (duration === '24h') bannedUntil = new Date(Date.now() + 24*60*60*1000);
    else if (duration === '7 jours') bannedUntil = new Date(Date.now() + 7*24*60*60*1000);
    // Permanent → bannedUntil reste null mais isActive = false

    const user = await User.findOneAndUpdate(
      { idmembre },
      { isActive: false, bannedUntil },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé." });
    res.status(200).json({ message: `L'accès de ${user.firstname} a été révoqué.` });
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