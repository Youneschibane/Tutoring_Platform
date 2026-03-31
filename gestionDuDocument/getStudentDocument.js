const Session = require('../models/sessionModel');
const Document = require('../models/documentModel');
const Student = require('../models/studentModel');

const getStudentDocuments = async (req, res) => {
  try {

    // ── 1. Récupérer l'ID numérique depuis le body ──────────────────────────
    const { student_id } = req.body;

    if (!student_id) {
      return res.status(400).json({
        message: "Le champ student_id est obligatoire"
      });
    }

    // ── 2. Vérifier que l'étudiant existe ───────────────────────────────────
    const existingStudent = await Student.findOne({ id_eleve: student_id });

    if (!existingStudent) {
      return res.status(404).json({
        message: "Étudiant introuvable"
      });
    }

    const studentMongoId = existingStudent._id; // _id MongoDB pour les requêtes suivantes

    // ── 3. Récupérer les séances de l'étudiant ──────────────────────────────
    const sessions = await Session.find({ etudiants: studentMongoId })
      .select('_id service')
      .lean();

    if (!sessions.length) {
      return res.status(200).json({
        message: "Aucune séance trouvée pour cet étudiant",
        total: 0,
        data: []
      });
    }

    const sessionIds = sessions.map(s => s._id);

    const serviceIds = [
      ...new Set(
        sessions
          .map(s => s.service)
          .filter(Boolean)
          .map(id => id.toString())
      )
    ];

    // ── 4. Récupérer tous les documents accessibles ─────────────────────────
    const query = { $or: [] };

    if (serviceIds.length) {
      query.$or.push({ service: { $in: serviceIds }, access_type: "public" });
    }

    if (sessionIds.length) {
      query.$or.push({ seance: { $in: sessionIds }, access_type: "private" });
    }

    if (!query.$or.length) {
      return res.status(200).json({
        message: "Aucun document disponible",
        total: 0,
        data: []
      });
    }

    const documents = await Document.find(query)
      .populate("service", "nom description")
      .populate("seance", "date_seance statut")
      .populate("enseignant", "firstname familyname")
      .lean();

    if (!documents.length) {
      return res.status(200).json({
        message: "Aucun document trouvé pour cet étudiant",
        total: 0,
        data: []
      });
    }

    // ── 5. Organiser les documents par service ──────────────────────────────
    const result = {};

    documents.forEach(doc => {
      const serviceObj = doc.service || doc.seance?.service || null;
      const serviceId = serviceObj?._id?.toString() ?? 'sans_service';

      if (!result[serviceId]) {
        result[serviceId] = {
          service: serviceObj,
          documents_publics: [],
          documents_prives: []
        };
      }

      if (doc.access_type === "public") {
        result[serviceId].documents_publics.push(doc);
      } else {
        result[serviceId].documents_prives.push(doc);
      }
    });

    return res.status(200).json({
      message: "Documents récupérés avec succès",
      total: documents.length,
      data: Object.values(result)
    });

  } catch (error) {
    console.error("Erreur récupération documents :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération des documents",
      ...(process.env.NODE_ENV === 'development' && { detail: error.message })
    });
  }
};

module.exports = getStudentDocuments;


