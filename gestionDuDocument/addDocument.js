const Document = require('../models/documentModel');
const Session = require('../models/sessionModel');
const Service = require('../models/serviceModel');
const Teacher = require('../models/teacherModel');

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const addDocument = async (req, res) => {
  try {
    const {
      type_document,
      access_type,
      service,
      seance,
      description,
      teacher_id
    } = req.body;

    // ── 1. Validation des champs obligatoires ───────────────────────────────
    if (!type_document || !access_type || !teacher_id) {
      return res.status(400).json({
        message: "Les champs type_document, access_type et teacher_id sont obligatoires"
      });
    }

    if (!["public", "private"].includes(access_type)) {
      return res.status(400).json({
        message: "Le type d'accès doit être 'public' ou 'private'"
      });
    }

    // ── 2. Validation du fichier ────────────────────────────────────────────
    if (!req.file) {
      return res.status(400).json({ message: "Le fichier est obligatoire" });
    }

    if (!ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: "Type de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, DOC, DOCX"
      });
    }

    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        message: "La taille du fichier dépasse la limite autorisée (10 MB)"
      });
    }

    // ── 3. Vérification cohérence access_type ↔ service/séance ─────────────
    if (access_type === "public" && !service) {
      return res.status(400).json({
        message: "Le service est obligatoire pour un document public"
      });
    }

    if (access_type === "private" && !seance) {
      return res.status(400).json({
        message: "La séance est obligatoire pour un document privé"
      });
    }

    // ── 4. Vérifier l'enseignant ────────────────────────────────────────────
    const existingTeacher = await Teacher.findOne({ id_enseignant: teacher_id });
    if (!existingTeacher) {
      return res.status(404).json({ message: "Enseignant introuvable" });
    }
    const teacherMongoId = existingTeacher._id;

    // ── 5. Vérifier la propriété du service ou de la séance ─────────────────
    let serviceMongoId = null;
    let seanceMongoId = null;

    if (access_type === "public") {
      const existingService = await Service.findOne({ id_service: service });

      if (!existingService) {
        return res.status(404).json({ message: "Service introuvable" });
      }

      // FIX: utilisation des ObjectId MongoDB pour une comparaison fiable
      // (aligné avec la vérification de la séance plus bas)
      if (existingService.enseignant.toString() !== teacherMongoId.toString()) {
        return res.status(403).json({
          message: "Vous n'êtes pas autorisé à ajouter des documents à ce service"
        });
      }

      serviceMongoId = existingService._id;
    }

    if (access_type === "private") {
      const existingSession = await Session.findOne({ id_seance: seance });

      if (!existingSession) {
        return res.status(404).json({ message: "Séance introuvable" });
      }

      if (existingSession.enseignant.toString() !== teacherMongoId.toString()) {
        return res.status(403).json({
          message: "Vous n'êtes pas autorisé à ajouter des documents à cette séance"
        });
      }

      seanceMongoId = existingSession._id;

      if (!existingSession.service) {
        return res.status(400).json({
          message: "Cette séance n'est associée à aucun service"
        });
      }

      serviceMongoId = existingSession.service;
    }

    // ── 6. Vérifier les doublons ────────────────────────────────────────────
    const doublonExistant = await Document.findOne({
      enseignant: teacherMongoId,
      nom_fichier: req.file.originalname,
      service: serviceMongoId,
      seance: seanceMongoId
    });

    if (doublonExistant) {
      return res.status(409).json({
        message: "Un document avec ce nom existe déjà pour ce service ou cette séance"
      });
    }

    // ── 7. Créer le document ────────────────────────────────────────────────
    const newDocument = await Document.create({
      enseignant: teacherMongoId,
      service: serviceMongoId,
      seance: seanceMongoId,
      access_type,
      type_document,
      nom_fichier: req.file.originalname,
      chemin_fichier: req.file.path,
      taille_fichier: req.file.size,
      description: description || null
    });

    await newDocument.populate([
      { path: 'service',    select: 'nom description' },
      { path: 'seance',     select: 'date_seance statut' },
      { path: 'enseignant', select: 'firstname familyname' }
    ]);

    return res.status(201).json({
      message: "Document ajouté avec succès",
      data: newDocument
    });

  } catch (error) {
    console.error("Erreur lors de l'ajout du document :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de l'ajout du document",
      ...(process.env.NODE_ENV === 'development' && { detail: error.message })
    });
  }
};

// FIX: export objet pour cohérence avec les autres controllers
module.exports = { addDocument };