const mongoose = require('mongoose');
const Session  = require('../models/sessionModel');
const Document = require('../models/documentModel');
const Teacher  = require('../models/teacherModel');

const getSessionDocuments = async (req, res) => {
  try {

    // ── 1. Paramètres ─────────────────────────────────────────────────────
    // teacher_mongo_id vient du JWT via req.user — pas du body
    const { session_id, page = 1, limit = 10 } = req.body;

    if (!session_id) {
      return res.status(400).json({ message: "Le champ session_id est obligatoire" });
    }

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip     = (pageNum - 1) * limitNum;

    // ── 2. Récupérer le Teacher document via idmembre du JWT ──────────────
    // La séance stocke ref: "Teacher" (_id du teacherModel), pas ref: "User"
    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre })
      .select('_id firstname familyname')
      .lean();

    if (!teacher) {
      return res.status(404).json({ message: "Profil enseignant introuvable" });
    }

    // ── 3. Vérifier que la séance existe ──────────────────────────────────
    const session = await Session.findOne({ id_seance: session_id })
      .select('_id id_seance titre date_seance service enseignant statut archivedMeta')
      .populate('service', '_id nom description')
      .lean();

    if (!session) {
      return res.status(404).json({ message: "Séance introuvable" });
    }

    // ── 4. Check ownership ────────────────────────────────────────────────
    const sessionOwnerId = session.enseignant?.toString();
    const teacherMongoId = teacher._id.toString();

    if (sessionOwnerId !== teacherMongoId) {
      return res.status(403).json({
        message: "Accès refusé : vous n'êtes pas l'enseignant de cette séance"
      });
    }

    // ── 5. Séance archivée ────────────────────────────────────────────────
    if (session.archivedMeta?.isArchived) {
      return res.status(403).json({ message: "Cette séance est archivée" });
    }

    // ── 6. Compter ────────────────────────────────────────────────────────
    const filter = { seance: session._id };

    const totalDocuments = await Document.countDocuments(filter);
    const totalPages     = Math.ceil(totalDocuments / limitNum);

    // ── 7. Info communes — extraites UNE seule fois ───────────────────────
    const commonInfo = {
      enseignant: {
        _id:        teacher._id,
        firstname:  teacher.firstname,
        familyname: teacher.familyname
      },
      service: {
        _id:         session.service?._id,
        nom:         session.service?.nom,
        description: session.service?.description
      }
    };

    if (!totalDocuments) {
      return res.status(200).json({
        message:     "Aucun document attaché à cette séance",
        seance:      _formatSession(session),
        ...commonInfo,
        total:       0,
        totalPages:  0,
        currentPage: pageNum,
        limit:       limitNum,
        data:        []
      });
    }

    // ── 8. Documents paginés — sans populate prof/service (déjà en haut) ──
    const documents = await Document.find(filter)
      .select('-__v -enseignant -service')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // ── 9. Grouper par type_document ──────────────────────────────────────
    const grouped = {};

    documents.forEach(doc => {
      const type = doc.type_document;
      if (!grouped[type]) grouped[type] = [];

      const { type_document, seance, ...cleanDoc } = doc;
      grouped[type].push(cleanDoc);
    });

    const groupedArray = Object.entries(grouped).map(([type, docs]) => ({
      type_document: type,
      count:         docs.length,
      documents:     docs
    }));

    // ── 10. Réponse finale ────────────────────────────────────────────────
    return res.status(200).json({
      message:     "Documents de la séance récupérés avec succès",
      seance:      _formatSession(session),
      ...commonInfo,
      total:       totalDocuments,
      totalPages,
      currentPage: pageNum,
      limit:       limitNum,
      data:        groupedArray
    });

  } catch (error) {
    console.error("Erreur récupération documents séance :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération des documents",
      ...(process.env.NODE_ENV === 'development' && { detail: error.message })
    });
  }
};

const _formatSession = (session) => ({
  id_seance:   session.id_seance,
  titre:       session.titre,
  date_seance: session.date_seance,
  statut:      session.statut,
});

module.exports = { getSessionDocuments };