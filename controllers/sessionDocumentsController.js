const mongoose = require('mongoose');
const Session  = require('../models/sessionModel');
const Document = require('../models/documentModel');

const getSessionDocuments = async (req, res) => {
  try {

    // ── 1. Récupérer les paramètres ───────────────────────────────────────
    const { session_id, page = 1, limit = 10 } = req.body;

    if (!session_id) {
      return res.status(400).json({
        message: "Le champ session_id est obligatoire"
      });
    }

    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const skip     = (pageNum - 1) * limitNum;

    // ── 2. Vérifier que la séance existe ──────────────────────────────────
    const session = await Session.findOne({ id_seance: session_id })
      .select('_id id_seance titre date_seance service enseignant statut')
      .populate('service',    'nom description')
      .populate('enseignant', 'firstname familyname')
      .lean();

    if (!session) {
      return res.status(404).json({
        message: "Séance introuvable"
      });
    }

    const sessionMongoId = session._id;

    // ── 3. Compter le total des documents attachés ─────────────────────────
    const filter = { seance: sessionMongoId };

    const totalDocuments = await Document.countDocuments(filter);
    const totalPages     = Math.ceil(totalDocuments / limitNum);

    if (!totalDocuments) {
      return res.status(200).json({
        message: "Aucun document attaché à cette séance",
        seance: {
          id_seance:   session.id_seance,
          titre:       session.titre,
          date_seance: session.date_seance,
          statut:      session.statut,
          service:     session.service,
          enseignant:  session.enseignant,
        },
        total:       0,
        totalPages:  0,
        currentPage: pageNum,
        limit:       limitNum,
        data:        []
      });
    }

    // ── 4. Récupérer les documents paginés ────────────────────────────────
    const documents = await Document.find(filter)
      .populate('enseignant', 'firstname familyname')
      .populate('service',    'nom description')
      .select('-__v')
      .skip(skip)
      .limit(limitNum)
      .lean();

    // ── 5. Grouper par type_document ──────────────────────────────────────
    const grouped = {};

    documents.forEach(doc => {
      const type = doc.type_document;

      if (!grouped[type]) {
        grouped[type] = [];
      }

      grouped[type].push(doc);
    });

    // ── 6. Formater la réponse finale ─────────────────────────────────────
    const groupedArray = Object.entries(grouped).map(([type, docs]) => ({
      type_document: type,
      count:         docs.length,
      documents:     docs
    }));

    return res.status(200).json({
      message:     "Documents de la séance récupérés avec succès",
      seance: {
        id_seance:   session.id_seance,
        titre:       session.titre,
        date_seance: session.date_seance,
        statut:      session.statut,
        service:     session.service,
        enseignant:  session.enseignant,
      },
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

module.exports = { getSessionDocuments };