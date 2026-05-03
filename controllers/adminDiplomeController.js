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
// HELPER — Merger matiere/cycle dans subjects sans doublon
// Règle : si la même matière existe déjà, on garde le niveau le plus élevé
// ─────────────────────────────────────────────────────────────────
const mergeSubject = (subjects, newMatiere, newCycle) => {
  const matiereLower = newMatiere.trim().toLowerCase();

  const existingIdx = subjects.findIndex(
    (s) => s.name.trim().toLowerCase() === matiereLower
  );

  if (existingIdx === -1) {
    subjects.push({ name: newMatiere.trim(), cycle: newCycle });
    return { action: 'added' };
  }

  const existingCycle = subjects[existingIdx].cycle;
  const existingRank  = cycleRank(existingCycle);
  const newRank       = cycleRank(newCycle);

  if (newRank > existingRank) {
    subjects[existingIdx].cycle = newCycle;
    return { action: 'upgraded', from: existingCycle, to: newCycle };
  }

  if (newRank === existingRank) {
    return { action: 'duplicate' };
  }

  return { action: 'ignored', existing: existingCycle };
};


// ═══════════════════════════════════════════════════════════════════════
// 1. GET — Tous les profs ayant au moins un diplôme avec une matière pending
// GET /api/admin/diplomes/pending-teachers
// ═══════════════════════════════════════════════════════════════════════
// GET /api/admin/diplomes/pending-teachers
exports.getTeachersWithPendingDiplomes = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const filter = {
      $and: [
        { 'pending_diplomes.0': { $exists: true } },
        {
          $or: [
            {
              pending_diplomes: {
                $elemMatch: {
                  subjects: { $elemMatch: { status: 'pending' } }
                }
              }
            },
            {
              pending_diplomes: {
                $elemMatch: { subjects: { $exists: false } }
              }
            }
          ]
        }
      ]
    };

    const teachers = await Teacher.find(filter)
      .select('id_enseignant pending_diplomes')   // ← uniquement ce dont on a besoin
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Teacher.countDocuments(filter);

    const teacherIds = teachers.map((t) => t.id_enseignant);
    const users = await User.find({ idmembre: { $in: teacherIds }, role: 'teacher' })
      .select('idmembre firstname familyname email')
      .lean();

    const userMap = {};
    users.forEach((u) => { userMap[u.idmembre] = u; });

    const enriched = teachers.map((t) => {
      const user = userMap[t.id_enseignant] || null;

      return {
        id_enseignant: t.id_enseignant,
        firstname:     user?.firstname  || null,
        familyname:    user?.familyname || null,
        email:         user?.email      || null,
        pending_diplomes: (t.pending_diplomes || []).map((d) => {
          const subjects = d.subjects || [];
          return {
            id_diplome:           d._id.toString(),
            url:                  d.url,
            publicId:             d.publicId,
            nom:                  d.nom        || 'Diplôme sans titre',
            uploadedAt:           d.uploadedAt || null,
            subjects:             subjects.map((s) => ({
              matiere: s.matiere,
              cycle:   s.cycle,
              status:  s.status || 'pending'
            })),
            pendingSubjectsCount: subjects.filter((s) => s.status === 'pending').length
          };
        })
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
    console.error('getTeachersWithPendingDiplomes error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
};
/*
  Exemple de réponse :
  {
    "status": "success",
    "total": 1,
    "page": 1,
    "totalPages": 1,
    "data": [
      {
        "id_enseignant": 1,
        "user": { "idmembre": 1, "firstname": "John", "familyname": "Doe", "email": "..." },
        "acceptanceStatus": "accepted",
        "subjects": [{ "name": "Maths", "cycle": "Lycée" }],
        "accepted_diplomes": [],
        "pending_diplomes": [
          {
            "id_diplome": "abc123",
            "nom": "Licence Maths",
            "url": "https://...",
            "uploadedAt": "2024-01-01T00:00:00.000Z",
            "subjects": [
              { "matiere": "Maths",   "cycle": "Lycée",  "status": "pending" },
              { "matiere": "Physique","cycle": "Moyen",  "status": "pending" }
            ],
            "pendingSubjectsCount": 2
          }
        ]
      }
    ]
  }
*/


// ═══════════════════════════════════════════════════════════════════════
// 2. GET — Diplômes en attente d'UN teacher spécifique
// GET /api/admin/diplomes/pending/:id_enseignant
// ═══════════════════════════════════════════════════════════════════════
exports.getPendingDiplomesOfTeacher = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);

    if (isNaN(id_enseignant))
      return res.status(400).json({ status: 'fail', message: 'id_enseignant invalide.' });

    const teacher = await Teacher.findOne({ id_enseignant })
      .select('id_enseignant pending_diplomes subjects documents.diplomes acceptanceStatus')
      .lean();

    if (!teacher)
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable.' });

    const user = await User.findOne({ idmembre: id_enseignant, role: 'teacher' })
      .select('firstname familyname email')
      .lean();

    return res.status(200).json({
      status: 'success',
      data: {
        id_enseignant:    teacher.id_enseignant,
        user,
        acceptanceStatus: teacher.acceptanceStatus,
        subjects:         teacher.subjects || [],
        accepted_diplomes: (teacher.documents?.diplomes || []).map((d) => ({
          id_diplome: d._id.toString(),
          nom:        d.nom,
          url:        d.url,
          matiere:    d.matiere,
          cycle:      d.cycle,
          uploadedAt: d.uploadedAt
        })),
        pending_diplomes: (teacher.pending_diplomes || []).map((d) => ({
          id_diplome:           d._id.toString(),
          nom:                  d.nom,
          url:                  d.url,
          uploadedAt:           d.uploadedAt,
          subjects:             d.subjects,
          pendingSubjectsCount: d.subjects.filter((s) => s.status === 'pending').length
        }))
      }
    });

  } catch (error) {
    console.error('getPendingDiplomesOfTeacher error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.' });
  }
};


// ═══════════════════════════════════════════════════════════════════════
// 3. PATCH — Accepter un diplôme → toutes ses matières pending sont acceptées
// PATCH /api/admin/diplomes/accept/:id_enseignant/:diplome_id
// ═══════════════════════════════════════════════════════════════════════
exports.accepterDiplome = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);
    const { diplome_id } = req.params;

    if (isNaN(id_enseignant))
      return res.status(400).json({ status: 'fail', message: 'id_enseignant invalide.' });

    const teacher = await Teacher.findOne({ id_enseignant });
    if (!teacher)
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable.' });

    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending)
      return res.status(404).json({ status: 'fail', message: 'Diplôme introuvable.' });

    // Uniquement les matières encore en attente
    const pendingSubjects = pending.subjects.filter((s) => s.status === 'pending');

    if (pendingSubjects.length === 0)
      return res.status(400).json({
        status:  'fail',
        message: 'Aucune matière en attente dans ce diplôme.'
      });

    // ── Merger chaque matière dans teacher.subjects + marquer comme accepted ──
    const mergeResults = [];
    for (const subject of pendingSubjects) {
      const result = mergeSubject(teacher.subjects, subject.matiere, subject.cycle);
      subject.status = 'accepted';
      mergeResults.push({ matiere: subject.matiere, cycle: subject.cycle, action: result.action });
    }

    // ── Ajouter une entrée dans documents.diplomes par matière acceptée ──
    // (respecte le modèle existant qui a matiere/cycle en champs plats)
    for (const subject of pendingSubjects) {
      teacher.documents.diplomes.push({
        url:        pending.url,
        publicId:   pending.publicId,
        nom:        pending.nom,
        matiere:    subject.matiere,
        cycle:      subject.cycle,
        uploadedAt: pending.uploadedAt
      });
    }

    // ── Retirer de pending_diplomes ──
    teacher.pending_diplomes.pull(diplome_id);

    await teacher.save();

    return res.status(200).json({
      status:  'success',
      message: `Diplôme accepté — ${mergeResults.length} matière(s) ajoutée(s).`,
      data: {
        merge_results:    mergeResults,
        subjects_updated: teacher.subjects
      }
    });

  } catch (error) {
    console.error('accepterDiplome error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.', details: error.message });
  }
};

/*
  Exemple de réponse :
  {
    "status": "success",
    "message": "Diplôme accepté — 2 matière(s) ajoutée(s).",
    "data": {
      "merge_results": [
        { "matiere": "Maths",    "cycle": "Lycée", "action": "added"    },
        { "matiere": "Physique", "cycle": "Moyen", "action": "upgraded" }
      ],
      "subjects_updated": [
        { "name": "Maths",    "cycle": "Lycée" },
        { "name": "Physique", "cycle": "Moyen" }
      ]
    }
  }
*/


// ═══════════════════════════════════════════════════════════════════════
// 4. PATCH — Rejeter UNE matière dans un diplôme
//            Si toutes les matières sont rejetées → supprimer le diplôme
// PATCH /api/admin/diplomes/reject/:id_enseignant/:diplome_id
// Body: { matiere: String, cycle: String, reason?: String }
// ═══════════════════════════════════════════════════════════════════════
exports.rejeterMatiere = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);
    const { diplome_id } = req.params;
    const { matiere, cycle} = req.body;

    if (isNaN(id_enseignant))
      return res.status(400).json({ status: 'fail', message: 'id_enseignant invalide.' });

    if (!matiere || !cycle)
      return res.status(400).json({ status: 'fail', message: 'matiere et cycle sont requis.' });

    const teacher = await Teacher.findOne({ id_enseignant });
    if (!teacher)
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable.' });

    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending)
      return res.status(404).json({ status: 'fail', message: 'Diplôme introuvable.' });

    // Trouver la matière spécifique (uniquement si encore pending)
    const subject = pending.subjects.find(
      (s) =>
        s.matiere.trim().toLowerCase() === matiere.trim().toLowerCase() &&
        s.cycle === cycle &&
        s.status === 'pending'
    );

    if (!subject)
      return res.status(404).json({
        status:  'fail',
        message: 'Matière introuvable dans ce diplôme ou déjà traitée.'
      });

    // ── Marquer cette matière comme rejetée ──
    subject.status = 'rejected';

    // ── Vérifier si toutes les matières sont rejetées → supprimer le diplôme ──
    const allRejected = pending.subjects.every((s) => s.status === 'rejected');
    let cloudinaryDeleted = false;

    if (allRejected) {
      if (pending.publicId) {
        try {
          await cloudinary.uploader.destroy(pending.publicId);
          cloudinaryDeleted = true;
        } catch (e) {
          console.warn('Cloudinary delete warning:', e.message);
        }
      }
      teacher.pending_diplomes.pull(diplome_id);
    }

    await teacher.save();

    const matieres_restantes = allRejected
      ? []
      : pending.subjects
          .filter((s) => s.status === 'pending')
          .map((s) => ({ matiere: s.matiere, cycle: s.cycle }));

    return res.status(200).json({
      status:  'success',
      message: allRejected
        ? 'Toutes les matières rejetées — diplôme supprimé.'
        : `Matière "${matiere}" (${cycle}) rejetée. ${matieres_restantes.length} matière(s) encore en attente.`,
      data: {
        rejected_subject:   { matiere, cycle },
        reason:             reason || null,
        diplome_supprime:   allRejected,
        cloudinary_deleted: cloudinaryDeleted,
        matieres_restantes
      }
    });

  } catch (error) {
    console.error('rejeterMatiere error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.', details: error.message });
  }
};





// ═══════════════════════════════════════════════════════════════════════
// 5. PATCH — Rejeter un diplôme entier (toutes ses matières d'un coup)
// PATCH /api/admin/diplomes/reject-diplome/:id_enseignant/:diplome_id
// Body: { reason?: String }
// ═══════════════════════════════════════════════════════════════════════

exports.rejeterDiplome = async (req, res) => {
  try {
    const id_enseignant = parseInt(req.params.id_enseignant);
    const { diplome_id } = req.params;
    

    if (isNaN(id_enseignant))
      return res.status(400).json({ status: 'fail', message: 'id_enseignant invalide.' });

    const teacher = await Teacher.findOne({ id_enseignant });
    if (!teacher)
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable.' });

    const pending = teacher.pending_diplomes.id(diplome_id);
    if (!pending)
      return res.status(404).json({ status: 'fail', message: 'Diplôme introuvable.' });

    const rejectedInfo = {
      nom:       pending.nom,
      url:       pending.url,
      subjects:  pending.subjects.map((s) => ({ matiere: s.matiere, cycle: s.cycle })),
      uploadedAt: pending.uploadedAt
    };

    // ── Supprimer le fichier de Cloudinary ──
    let cloudinaryDeleted = false;
    if (pending.publicId) {
      try {
        await cloudinary.uploader.destroy(pending.publicId);
        cloudinaryDeleted = true;
      } catch (e) {
        console.warn('Cloudinary delete warning:', e.message);
      }
    }

    // ── Retirer le diplôme entier de pending_diplomes ──
    teacher.pending_diplomes.pull(diplome_id);

    await teacher.save();

    return res.status(200).json({
      status:  'success',
      message: `Diplôme "${rejectedInfo.nom}" rejeté et supprimé.`,
      data: {
        diplome_rejete:     rejectedInfo,
        reason:             reason || null,
        cloudinary_deleted: cloudinaryDeleted
      }
    });

  } catch (error) {
    console.error('rejeterDiplome error:', error.message);
    return res.status(500).json({ status: 'error', message: 'Erreur serveur.', details: error.message });
  }
};
/*
  Exemple de réponse (matière rejetée, diplôme pas encore supprimé) :
  {
    "status": "success",
    "message": "Matière \"Physique\" (Moyen) rejetée. 1 matière(s) encore en attente.",
    "data": {
      "rejected_subject": { "matiere": "Physique", "cycle": "Moyen" },
      "reason": "Diplôme non reconnu",
      "diplome_supprime": false,
      "cloudinary_deleted": false,
      "matieres_restantes": [{ "matiere": "Maths", "cycle": "Lycée" }]
    }
  }
    */
/*
  Exemple de réponse (toutes les matières rejetées → diplôme supprimé) :
  {
    "status": "success",
    "message": "Toutes les matières rejetées — diplôme supprimé.",
    "data": {
      "rejected_subject": { "matiere": "Maths", "cycle": "Lycée" },
      "reason": null,
      "diplome_supprime": true,
      "cloudinary_deleted": true,
      "matieres_restantes": []
    }
  }
    */
