const Seance = require('../models/sessionModel');
const Eleve = require('../models/studentModel');
const Parent = require('../models/parentModel');

/**
 * Réserver une séance.
 *
 * Body attendu :
 *
 * CAS 1 — Compte élève (réserve pour lui-même) :
 * {
 *   session_id  : String,
 *   type_compte : "eleve",
 *   id_compte   : Number   ← id de l'élève connecté
 * }
 *
 * CAS 2 — Compte parent (réserve pour un de ses enfants) :
 * {
 *   session_id  : String,
 *   type_compte : "parent",
 *   id_compte   : Number,  ← id du parent connecté
 *   id_eleve    : Number   ← id de l'enfant à inscrire
 * }
 */
const bookSession = async (req, res) => {
  try {
    const { session_id, type_compte, id_compte, id_eleve } = req.body;

    // ─── 1. Validation des champs de base ────────────────────────────────────
    if (!session_id || !type_compte || !id_compte) {
      return res.status(400).json({
        message: 'Les champs session_id, type_compte et id_compte sont obligatoires'
      });
    }

    if (!['eleve', 'parent'].includes(type_compte)) {
      return res.status(400).json({
        message: "type_compte doit être 'eleve' ou 'parent'"
      });
    }

    // ─── 2. Identifier l'élève à inscrire selon le type de compte ────────────
    let studentToBook;

    if (type_compte === 'eleve') {
      // L'élève réserve pour lui-même
      studentToBook = await Eleve.findOne({ id_eleve: id_compte });
      if (!studentToBook) {
        return res.status(404).json({ message: 'Compte élève introuvable' });
      }

    } else {
      // Le parent réserve pour un de ses enfants
      if (!id_eleve) {
        return res.status(400).json({
          message: "Un compte parent doit fournir id_eleve (l'enfant à inscrire)"
        });
      }

      const parent = await Parent.findOne({ id_parent: id_compte });
      if (!parent) {
        return res.status(404).json({ message: 'Compte parent introuvable' });
      }

      studentToBook = await Eleve.findOne({ id_eleve });
      if (!studentToBook) {
        return res.status(404).json({ message: 'Élève (enfant) introuvable' });
      }

      // Vérifier que l'enfant appartient bien à ce parent
      const isChild = parent.enfants.some(
        (enfantId) => enfantId.toString() === studentToBook._id.toString()
      );

      if (!isChild) {
        return res.status(403).json({
          message: "Cet élève n'est pas rattaché à votre compte parent"
        });
      }
    }

    // ─── 3. Réservation atomique ─────────────────────────────────────────────
    const session = await Seance.findOneAndUpdate(
      {
        session_id,
        statut: { $in: ['en_attente', 'confirmee'] },
        $expr: { $lt: [{ $size: '$etudiants' }, '$nombre_max_participants'] },
        etudiants: { $ne: studentToBook._id }
      },
      {
        $push: { etudiants: studentToBook._id }
      },
      {
        returnDocument: "after",
        runValidators: true
      }
    ).populate('service enseignant', 'nom prenom titre');

    // ─── 4. Gestion de l'échec ───────────────────────────────────────────────
    if (!session) {
      const checkSession = await Seance.findOne({ session_id });
      if (!checkSession) {
        return res.status(404).json({ message: 'Séance introuvable' });
      }

      return res.status(400).json({
        message: 'Réservation impossible : séance complète, déjà réservée ou statut invalide'
      });
    }

    // ─── 5. Passage en statut "confirmee" si première inscription ────────────
    if (session.statut === 'en_attente') {
      session.statut = 'confirmee';
      await session.save();
    }

    // ─── 6. Réponse succès ───────────────────────────────────────────────────
    return res.status(201).json({
      message: type_compte === 'parent'
        ? `Inscription réussie pour l'élève ${id_eleve} (réservée par le parent ${id_compte})`
        : 'Inscription réussie',
      reservePar: type_compte,
      session
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// SÉANCES PASSÉES
// GET /api/session/past/:id_eleve
// ─────────────────────────────────────────────────────────────────────────────
const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;
 
    const student = await Eleve.findOne({ id_eleve });
    if (!student) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
 
 const sessions = await Seance.find({
  statut:    'terminee',
  etudiants: student._id,
  date_seance: { $lt: new Date() }    
})
      .populate('service',    'nom description')
      .populate('enseignant', 'firstname familyname')
      .sort({ date_seance: -1 });
 
    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });
 
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
 
 
// ─────────────────────────────────────────────────────────────────────────────
// SÉANCES À VENIR
// GET /api/session/upcoming/:id_eleve
// ─────────────────────────────────────────────────────────────────────────────
const getUpcomingSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;
 
    const student = await Eleve.findOne({ id_eleve });
    if (!student) {
      return res.status(404).json({ message: 'Élève non trouvé' });
    }
 
   const sessions = await Seance.find({
  etudiants: student._id,
  statut:    { $in: ['confirmee', 'reportee'] },
  date_seance: { $gte: new Date() }   
})
      .populate('service',    'nom description')
      .populate('enseignant', 'firstname familyname')
      .sort({ date_seance: 1 });
 
    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions
    });
 
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};
 
 
module.exports = { bookSession, getPastSessions, getUpcomingSessions };