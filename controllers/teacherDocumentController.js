const Teacher    = require('../models/teacherModel');
const cloudinary = require('../Config/Cloudinaryconfig · JS');

const VALID_CYCLES = ['Primaire', 'Moyen', 'Lycée', 'Universitaire'];
const { notifyAdmin } = require('../controllers/notificationService');

// ─────────────────────────────────────────────────────────────────
// HELPER — Recalculer subjects après suppression d'un diplôme
// Cas 1 : aucun diplôme restant pour cette matière → retirer de subjects
// Cas 2 : diplômes restants → garder le cycle le plus élevé (downgrade)
// ─────────────────────────────────────────────────────────────────
const recalculerSubjects = (diplomesRestants, subjects, matiereSuppr) => {
  const matiereLower = matiereSuppr.trim().toLowerCase();

  const remaining = diplomesRestants.filter(
    (d) => d.matiere?.trim().toLowerCase() === matiereLower
  );

  if (remaining.length === 0) {
    const before  = subjects.find((s) => s.name.trim().toLowerCase() === matiereLower);
    const updated = subjects.filter((s) => s.name.trim().toLowerCase() !== matiereLower);
    return { action: 'removed', matiere: matiereSuppr, before: before?.cycle || null, subjects: updated };
  }

  const highestCycle = remaining.reduce((best, d) => {
    return VALID_CYCLES.indexOf(d.cycle) > VALID_CYCLES.indexOf(best) ? d.cycle : best;
  }, remaining[0].cycle);

  const subjectIdx = subjects.findIndex((s) => s.name.trim().toLowerCase() === matiereLower);
  const before     = subjects[subjectIdx]?.cycle || null;

  if (subjectIdx !== -1) subjects[subjectIdx].cycle = highestCycle;

  return {
    action:   before === highestCycle ? 'unchanged' : 'downgraded',
    matiere:  matiereSuppr,
    before,
    after:    highestCycle,
    subjects
  };
};

// ═══════════════════════════════════════════════════════════════
// AJOUTER UN DIPLÔME (→ pending_diplomes)
// POST /api/teacher/diplomes
// ═══════════════════════════════════════════════════════════════
exports.ajouterDiplome = async (req, res) => {
  let uploadedPublicId = null;
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: "Aucun fichier reçu. Champ attendu: 'diplome'" });
    }

    uploadedPublicId  = req.file.filename;
    const fileUrl     = req.file.path;
    const { matiere, cycle, nom } = req.body;

    if (!matiere?.trim()) {
      await cloudinary.uploader.destroy(uploadedPublicId);
      return res.status(400).json({ status: 'fail', message: "Le champ 'matiere' est obligatoire." });
    }

    if (!cycle || !VALID_CYCLES.includes(cycle)) {
      await cloudinary.uploader.destroy(uploadedPublicId);
      return res.status(400).json({
        status:  'fail',
        message: `Le champ 'cycle' est obligatoire. Valeurs acceptées : ${VALID_CYCLES.join(', ')}`
      });
    }

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });
    if (!teacher) {
      await cloudinary.uploader.destroy(uploadedPublicId);
      return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable." });
    }

    teacher.pending_diplomes.push({
      url: fileUrl, publicId: uploadedPublicId,
      nom: nom?.trim() || 'Diplôme sans titre',
      matiere: matiere.trim(), cycle, uploadedAt: new Date()
    });
    await teacher.save();

    try {
      await notifyAdmin(
        "Nouvelle compétence à vérifier",
        `Le professeur ${teacher.firstname} ${teacher.familyname} a soumis un nouveau diplôme (${matiere} - ${cycle}) pour validation.`,
        "NEW_MODULE_DIPLOMA",
        teacher._id // On passe l'ObjectId pour que l'admin puisse cliquer dessus
      );
    } catch (notifErr) {
      console.error("Erreur notification Admin (Ajout Diplôme):", notifErr.message);
    }

    const added = teacher.pending_diplomes[teacher.pending_diplomes.length - 1];
    return res.status(201).json({
      status:  'success',
      message: "Diplôme soumis avec succès. En attente de validation par l'administrateur.",
      data:    added
    });

  } catch (error) {
    if (uploadedPublicId) { try { await cloudinary.uploader.destroy(uploadedPublicId); } catch (e) {} }
    return res.status(500).json({ status: 'error', message: "Erreur lors de l'ajout du diplôme.", details: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SUPPRIMER UN DIPLÔME ACCEPTÉ
// DELETE /api/teacher/diplomes/:diplome_id
// → recalcule subjects : downgrade ou suppression de la matière
// ═══════════════════════════════════════════════════════════════
exports.supprimerDiplome = async (req, res) => {
  try {
    const { diplome_id } = req.params;

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });
    if (!teacher) return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable." });

    const diplome = teacher.documents.diplomes.id(diplome_id);
    if (!diplome) return res.status(404).json({ status: 'fail', message: "Le diplôme spécifié n'existe pas." });

    const { matiere } = diplome;

    // 1. Supprimer Cloudinary
    if (diplome.publicId) {
      try { await cloudinary.uploader.destroy(diplome.publicId); } catch (e) { console.warn("Cloudinary:", e.message); }
    }

    // 2. Retirer du tableau
    teacher.documents.diplomes.pull(diplome_id);

    // 3. Recalculer subjects sur les diplômes restants
    let subjectUpdate = null;
    if (matiere) {
      subjectUpdate    = recalculerSubjects(teacher.documents.diplomes, teacher.subjects, matiere);
      teacher.subjects = subjectUpdate.subjects;
    }

    await teacher.save();

    return res.status(200).json({
      status:  'success',
      message: "Diplôme supprimé avec succès.",
      data: { subject_update: subjectUpdate, subjects_updated: teacher.subjects }
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: "Erreur lors de la suppression.", details: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET MES DIPLÔMES
// GET /api/teacher/diplomes?statut=all|accepted|non_accepted
// ═══════════════════════════════════════════════════════════════
exports.getMesDiplomes = async (req, res) => {
  try {
    const { statut = 'all' } = req.query;

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre })
      .select('documents.diplomes pending_diplomes');
    if (!teacher) return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable." });

    const accepted = teacher.documents.diplomes || [];
    const pending  = teacher.pending_diplomes   || [];

    let result;
    if (statut === 'accepted')     result = { accepted: { count: accepted.length, items: accepted } };
    else if (statut === 'non_accepted') result = { pending: { count: pending.length, items: pending } };
    else result = {
      accepted: { count: accepted.length, items: accepted },
      pending:  { count: pending.length,  items: pending  },
      total:    accepted.length + pending.length
    };

    return res.status(200).json({ status: 'success', statut, data: result });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: "Impossible de récupérer les diplômes.", details: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SUPPRIMER UN DIPLÔME EN ATTENTE (par le teacher)
// DELETE /api/teacher/diplomes/pending/:diplome_id
// ═══════════════════════════════════════════════════════════════
exports.supprimerPendingDiplome = async (req, res) => {
  try {
    const { diplome_id } = req.params;

    const teacher = await Teacher.findOne({ id_enseignant: req.user.idmembre });
    if (!teacher) return res.status(404).json({ status: 'fail', message: "Profil enseignant introuvable." });

    const diplome = teacher.pending_diplomes.id(diplome_id);
    if (!diplome) return res.status(404).json({ status: 'fail', message: "Diplôme en attente introuvable." });

    if (diplome.publicId) {
      try { await cloudinary.uploader.destroy(diplome.publicId); } catch (e) { console.warn("Cloudinary:", e.message); }
    }

    teacher.pending_diplomes.pull(diplome_id);
    await teacher.save();

    return res.status(200).json({ status: 'success', message: "Diplôme en attente annulé et supprimé." });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: "Erreur lors de la suppression.", details: error.message });
  }
};
