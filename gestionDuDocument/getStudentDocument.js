const mongoose = require('mongoose');
const Session  = require('../models/sessionModel');
const Document = require('../models/documentModel');
const Student  = require('../models/studentModel');

const getStudentDocuments = async (req, res) => {
  try {
    const { student_id, page = 1, limit = 10, keyword } = req.body;

    if (!student_id) {
      return res.status(400).json({ message: "Le champ student_id est obligatoire" });
    }

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));

    // ── 1. Vérifier l'étudiant ─────────────────────────────
    const student = await Student.findOne({ id_eleve: student_id }).select('_id');
    if (!student) {
      return res.status(404).json({ message: "Étudiant introuvable" });
    }

    // ── 2. Récupérer les séances (CORRIGÉ) ───────────────
    // On cherche dans le tableau d'objets 'students'
    const sessions = await Session.find({
      $or: [
        { "students.userId": student._id },
        { "students.idmembre": Number(student_id) }
      ]
    })
      .select('_id service')
      .lean();

    if (!sessions.length) {
      return res.status(200).json({
        message: "Aucune séance trouvée",
        total: 0,
        totalPages: 0,
        currentPage: pageNum,
        data: []
      });
    }

    const sessionIds = sessions.map(s => s._id);

    const serviceIds = [
      ...new Set(
        sessions.map(s => s.service?.toString()).filter(Boolean)
      )
    ].map(id => new mongoose.Types.ObjectId(id));

    // ── 3. Query documents ───────────────────────────────
    const query = {
      $or: [
        { service: { $in: serviceIds }, access_type: "public" },
        { seance:  { $in: sessionIds }, access_type: "private" }
      ]
    };

    // ── 4. Aggregate ─────────────────────────────────────
    let pipeline = [
      { $match: query },

      {
        $lookup: {
          from: "services", // Assurez-vous que c'est le bon nom de collection
          localField: "service",
          foreignField: "_id",
          as: "service"
        }
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },

      {
        $group: {
          _id: "$service._id",
          service: { $first: "$service" },

          documents_publics: {
            $push: {
              $cond: [
                { $eq: ["$access_type", "public"] },
                "$$ROOT",
                "$$REMOVE"
              ]
            }
          },

          documents_prives: {
            $push: {
              $cond: [
                { $eq: ["$access_type", "private"] },
                "$$ROOT",
                "$$REMOVE"
              ]
            }
          }
        }
      },

      // ── supprimer services vides ────────────────────
      {
        $match: {
          $or: [
            { documents_publics: { $ne: [] } },
            { documents_prives: { $ne: [] } }
          ]
        }
      }
    ];

    // ── 5. Filtre keyword APRÈS groupement (CORRIGÉ) ──────
    if (keyword && keyword.trim() !== '') {
      pipeline.push({
        $match: {
          // Modifié de 'service.nom' à 'service.nom_service' selon votre schéma
          "service.nom_service": {
            $regex: keyword.trim(),
            $options: "i"
          }
        }
      });
    }

    // ── 6. Pagination ───────────────────────────────────
    pipeline.push(
      { $skip: (pageNum - 1) * limitNum },
      { $limit: limitNum }
    );

    const data = await Document.aggregate(pipeline);

    // ── 7. Total count (sans pagination) ────────────────
    const countPipeline = pipeline.filter(stage =>
      !stage.$skip && !stage.$limit
    );

    const totalResult = await Document.aggregate([
      ...countPipeline,
      { $count: "total" }
    ]);

    const total = totalResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limitNum);

    // ── 8. Response ─────────────────────────────────────
    return res.status(200).json({
      message: "Documents récupérés avec succès",
      keyword: keyword?.trim() || null,
      total,
      totalPages,
      currentPage: pageNum,
      limit: limitNum,
      data
    });

  } catch (error) {
    console.error("Erreur récupération documents :", error);
    return res.status(500).json({
      message: "Erreur serveur",
      ...(process.env.NODE_ENV === 'development' && { detail: error.message })
    });
  }
};

module.exports = { getStudentDocuments };