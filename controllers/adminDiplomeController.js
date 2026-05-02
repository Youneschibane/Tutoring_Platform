const Teacher  = require('../models/teacherModel');
const User     = require('../models/userModel');
const cloudinary = require('../Config/cloudinaryConfig.js');

// ─────────────────────────────────────────────────────────────────
// CYCLE HIERARCHY
// Primaire(0) < Moyen(1) < Lycée(2) < Universitaire(3)
// ─────────────────────────────────────────────────────────────────
const CYCLE_ORDER = ['Primaire', 'Moyen', 'Lycée', 'Universitaire'];

const cycleRank = (cycle) => {
  const idx = CYCLE_ORDER.indexOf(cycle);
  return idx === -1 ? -1 : idx;
};

// ─────────────────────────────────────────────────────────────────
// HELPER — Ajouter matiere/cycle dans subjects sans doublon
// Règle : si la même matière existe déjà, on garde le niveau le plus élevé
// ─────────────────────────────────────────────────────────────────
const mergeSubject = (subjects, newMatiere, newCycle) => {
  const matiereLower = newMatiere.trim().toLowerCase();

  // Cherche si la matière existe déjà (insensible à la casse)
  const existingIdx = subjects.findIndex(
    (s) => s.name.trim().toLowerCase() === matiereLower
  );

  if (existingIdx === -1) {
    // Matière absente → on l'ajoute directement
    subjects.push({ name: newMatiere.trim(), cycle: newCycle });
    return { action: 'added', subjects };
  }

  const existingCycle = subjects[existingIdx].cycle;
  const existingRank  = cycleRank(existingCycle);
  const newRank       = cycleRank(newCycle);

  if (newRank > existingRank) {
    // Nouveau niveau supérieur → on remplace
    subjects[existingIdx].cycle = newCycle;
    return { action: 'upgraded', from: existingCycle, to: newCycle, subjects };
  }

  if (newRank === existingRank) {
    // Même niveau → rien à faire (déjà présent)
    return { action: 'duplicate', subjects };
  }

  // Niveau inférieur → on ignore, on garde l'existant
  return { action: 'ignored', existing: existingCycle, subjects };
};





// ═══════════════════════════════════════════════════════════════
// 1. GET — Liste des teachers ayant au moins 1 diplôme en attente
// GET /api/admin/diplomes/pending-teachers
// ═══════════════════════════════════════════════════════════════
exports.getTeachersWithPendingDiplomes = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    // Teachers qui ont au moins 1 entrée dans pending_diplomes
    // et qui ne sont pas encore complètement acceptés
    const teachers = await Teacher.find({
      'pending_diplomes.0': { $exists: true },
      acceptanceStatus: 'pending'
    })
      .select('id_enseignant pending_diplomes subjects documents.diplomes acceptanceStatus')
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Teacher.countDocuments({
      'pending_diplomes.0': { $exists: true },
      acceptanceStatus: 'pending'
    });

    // Enrichir avec infos User (nom, prénom, email)
    const teacherIds = teachers.map((t) => t.id_enseignant);
    const users = await User.find({ idmembre: { $in: teacherIds }, role: 'teacher' })
      .select('idmembre firstname familyname email')
      .lean();

    const userMap = {};
    users.forEach((u) => { userMap[u.idmembre] = u; });

    const enriched = teachers.map((t) => {
      const normalizedSubjects = t.subjects || [];

      const buildDiplomeEntry = (diplome) => {
        const matiere = diplome.matiere || (diplome.subjects?.[0]?.matiere) || null;
        const cycle = diplome.cycle || (diplome.subjects?.[0]?.cycle) || null;

        const matchingSubjects = normalizedSubjects.filter(
          (subject) => {
            const sameName = subject.name && matiere && subject.name.toLowerCase() === matiere.toLowerCase();
            const sameCycle = cycle && subject.cycle === cycle;
            return sameName || sameCycle;
          }
        );

        return {
          id_diplome: diplome.id_diplome || diplome._id?.toString() || null,
          nom: diplome.nom || null,
          url: diplome.url || null,
          publicId: diplome.publicId || null,
          cycle,
          matiere,
          uploadedAt: diplome.uploadedAt,
          subjects: matchingSubjects
        };
      };

      const pending_diplomes_organized = (t.pending_diplomes || []).map(buildDiplomeEntry);
      const accepted_diplomes_organized = (t.documents?.diplomes || []).map(buildDiplomeEntry);

      return {
        id_enseignant: t.id_enseignant,
        user: userMap[t.id_enseignant] || null,
        subjects: normalizedSubjects,
        accepted_diplomes: accepted_diplomes_organized,
        pending_diplomes: pending_diplomes_organized,
        pendingCount: t.pending_diplomes.length,
        acceptanceStatus: t.acceptanceStatus
      };
    });

    return res.status(200).json({
      status:     'success',
      total,
      page,
      totalPages: Math.ceil(total / limit),
      data:       enriched
    });

  } catch (error) {
    console.error("getTeachersWithPendingDiplomes error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};
//exemple de la reponse de getTeachersWithPendingDiplomes
//{
//  "status": "success",
//  "total": 2,
//  "page": 1,  
//  "totalPages": 1,
//  "data": [
//    {
//      "id_enseignant": 1,
//      "user": {
//        "idmembre": 1,
//        "firstname": "John",
//        "familyname": "Doe",
//        "email": "lYBt2@example.com"
//      },
//      "pending_diplomes": [
//        {
//          "id_diplome": "1",
//          "cycle": "Primaire",    
//          "matiere": "Maths",
//          "uploadedAt": "2024-01-01T00:00:00.000Z", 
//          "subjects": [
//            {
//              "name": "Maths",
//              "cycle": "Primaire"   

//            }
//          ]
//        }
//      ],
//      "pendingCount": 1,
//      "acceptanceStatus": "pending"
//    } 


// ═══════════════════════════════════════════════════════════════
// 2. GET — Diplômes en attente d'UN teacher spécifique
// GET /api/admin/diplomes/pending/:id_enseignant
// ═══════════════════════════════════════════════════════════════
exports.getPendingDiplomesOfTeacher = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);

    if (isNaN(id_enseignant)) {
      return res.status(400).json({
        status:  'fail',
        message: "id_enseignant invalide."
      });
    }

    const teacher = await Teacher.findOne({ id_enseignant })
      .select('id_enseignant pending_diplomes subjects documents.diplomes')
      .lean();

    if (!teacher) {
      return res.status(404).json({
        status:  'fail',
        message: "Enseignant introuvable."
      });
    }

    const user = await User.findOne({ idmembre: id_enseignant, role: 'teacher' })
      .select('firstname familyname email')
      .lean();

    // Restructure pending_diplomes avec subjects associés
    const pending_diplomes_organized = teacher.pending_diplomes.map((diplome) => ({
      id_diplome: diplome.id_diplome,
      cycle: diplome.cycle,
      matiere: diplome.matiere,
      uploadedAt: diplome.uploadedAt,
      // Ajouter les subjects associés avec ce diplôme
      subjects: teacher.subjects.filter(
        (subject) => 
          subject.name.toLowerCase() === diplome.matiere.toLowerCase() ||
          subject.cycle === diplome.cycle
      )
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        teacher: {
          id_enseignant: teacher.id_enseignant,
          user,
          subjects: teacher.subjects,
          accepted_diplomes: teacher.documents?.diplomes || [],
          pending_diplomes: pending_diplomes_organized
        }
      }
    });

  } catch (error) {
    console.error("getPendingDiplomesOfTeacher error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur." });
  }
};
// Exemple de réponse de getPendingDiplomesOfTeacher
// Chaque diplôme en attente inclut maintenant un tableau `subjects` lié au diplôme.
/*
{
  "status": "success",
  "data": {
    "teacher": {
      "id_enseignant": 1,
      "user": {
        "firstname": "John",
        "familyname": "Doe",
        "email": "x6o0y@example.com"
      },
      "subjects": [
        {
          "name": "Maths",
          "cycle": "Primaire"
        },
        {
          "name": "Physique",
          "cycle": "Secondaire"
        }
      ],
      "accepted_diplomes": [
        {
          "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/diplome1.jpg",
          "publicId": "diplome1",
          "nom": "Diplôme de Mathématiques",
          "cycle": "Primaire",
          "matiere": "Maths",
          "uploadedAt": "2023-01-01T00:00:00.000Z"
        }
      ],
      "pending_diplomes": [
        {
          "id_diplome": "1",
          "cycle": "Primaire",
          "matiere": "Maths",
          "uploadedAt": "2023-01-01T00:00:00.000Z",
          "subjects": [
            {
              "name": "Maths",
              "cycle": "Primaire"
            }
          ]
        },
        {
          "id_diplome": "2",
          "cycle": "Secondaire",
          "matiere": "Physique",
          "uploadedAt": "2023-01-01T00:00:00.000Z",
          "subjects": [
            {
              "name": "Physique",
              "cycle": "Secondaire"
            }
          ]
        }
      ]
    }
  }
}
*/
      

// ═══════════════════════════════════════════════════════════════
// 3. PATCH — Accepter un diplôme en attente
// PATCH /api/admin/diplomes/accept/:id_enseignant/:diplome_id
// ═══════════════════════════════════════════════════════════════
exports.accepterDiplome = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);
    const { diplome_id } = req.params;

    if (isNaN(id_enseignant)) {
      return res.status(400).json({ status: 'fail', message: "id_enseignant invalide." });
    }

    const teacher = await Teacher.findOne({ id_enseignant });
    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: "Enseignant introuvable." });
    }

    // Trouver le diplôme dans pending_diplomes
    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending) {
      return res.status(404).json({
        status:  'fail',
        message: "Diplôme en attente introuvable."
      });
    }

    // ── Fusion dans subjects (avec déduplication par niveau) ──
    const mergeResult = mergeSubject(
      teacher.subjects,
      pending.matiere,
      pending.cycle
    );

    // ── Déplacer vers documents.diplomes (acceptés) ──
    const acceptedDiplome = {
      url:        pending.url,
      publicId:   pending.publicId,
      nom:        pending.nom,
      matiere:    pending.matiere,
      cycle:      pending.cycle,
      uploadedAt: pending.uploadedAt
    };

    teacher.documents.diplomes.push(acceptedDiplome);

    // ── Retirer de pending_diplomes ──
    teacher.pending_diplomes.pull(diplome_id);

    await teacher.save();

    const added = teacher.documents.diplomes[teacher.documents.diplomes.length - 1];

    return res.status(200).json({
      status:  'success',
      message: "Diplôme accepté avec succès.",
      data: {
        diplome_accepted:  added,
        subject_merge:     mergeResult,
        subjects_updated:  teacher.subjects
      }
    });

  } catch (error) {
    console.error("accepterDiplome error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur.", details: error.message });
  }
};
//exemple de la reponse de accepterDiplome
/*

{
  "status": "success",
  "message": "Diplome accepté avec succès.",
  "data": {
    "diplome_accepted": {
      "url": "https://res.cloudinary.com/demo/image/upload/v1234567890/diplome1.jpg",
      "publicId": "diplome1", 
      "nom": "Diplôme de Mathématiques",
      "matiere": "Maths",
      "cycle": "Primaire",
      "uploadedAt": "2023-01-01T00:00:00.000Z"
    },
    "subject_merge": {
      "action": "added",
      "subjects": [
        {
          "cycle": "Primaire",
          "matiere": "Maths",
          "uploadedAt": "2023-01-01T00:00:00.000Z"
        }
      ]
    },
    "subjects_updated": [
      {
        "cycle": "Primaire",
        "matiere": "Maths",
        "uploadedAt": "2023-01-01T00:00:00.000Z"
      }
    ]
  }
}
*/    
 
   

// ═══════════════════════════════════════════════════════════════
// 4. DELETE — Rejeter (supprimer) un diplôme en attente
// DELETE /api/admin/diplomes/reject/:id_enseignant/:diplome_id
// Body (optionnel): { reason }
// ═══════════════════════════════════════════════════════════════
exports.rejeterDiplome = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);
    const { diplome_id } = req.params;
    const { reason }     = req.body;

    if (isNaN(id_enseignant)) {
      return res.status(400).json({ status: 'fail', message: "id_enseignant invalide." });
    }

    const teacher = await Teacher.findOne({ id_enseignant });
    if (!teacher) {
      return res.status(404).json({ status: 'fail', message: "Enseignant introuvable." });
    }

    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending) {
      return res.status(404).json({
        status:  'fail',
        message: "Diplôme en attente introuvable."
      });
    }

    // Supprimer le fichier de Cloudinary
    if (pending.publicId) {
      try {
        await cloudinary.uploader.destroy(pending.publicId);
      } catch (e) {
        console.warn("Cloudinary delete warning:", e.message);
      }
    }

    const rejectedInfo = {
      nom:     pending.nom,
      matiere: pending.matiere,
      cycle:   pending.cycle
    };

    // Retirer de pending
    teacher.pending_diplomes.pull(diplome_id);
    await teacher.save();

    return res.status(200).json({
      status:  'success',
      message: "Diplôme rejeté et supprimé.",
      data: {
        rejected: rejectedInfo,
        reason:   reason || null
      }
    });

  } catch (error) {
    console.error("rejeterDiplome error:", error.message);
    return res.status(500).json({ status: 'error', message: "Erreur serveur.", details: error.message });
  }
};
