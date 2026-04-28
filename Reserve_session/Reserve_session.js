const Seance = require('../models/sessionModel');
const Eleve = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// HELPER — Enrichir une séance avec l'état de suppression des participants
// ═══════════════════════════════════════════════════════════════
const enrichSessionWithDeletedStatus = async (session) => {
  if (!session || !session.etudiants || session.etudiants.length === 0) {
    // Si session est un objet Mongoose, on le convertit pour ajouter des propriétés
    const sessionObj = session.toObject ? session.toObject() : session;
    return { ...sessionObj, participantsStatus: [] };
  }

  const studentsIds = session.etudiants || [];
  const students = await Eleve.find({ _id: { $in: studentsIds } });
  
  const participantsStatus = [];
  
  for (const student of students) {
    const user = await User.findOne({ idmembre: student.id_eleve }).select('+isDeleted +deletedAt');
    
    participantsStatus.push({
      studentId: student._id,
      studentName: `${student.prenom} ${student.nom}`,
      isDeleted: user ? user.isDeleted : false,
      deletedAt: user ? user.deletedAt : null,
      status: user && user.isDeleted ? 'permanently_deleted' : 'active'
    });
  }

  const sessionFinal = session.toObject ? session.toObject() : session;
  return {
    ...sessionFinal,
    participantsStatus
  };
};

// ═══════════════════════════════════════════════════════════════
// RÉSERVER UNE SÉANCE
// ═══════════════════════════════════════════════════════════════
const bookSession = async (req, res) => {
  try {
    const { session_id, type_compte, id_compte, id_eleve } = req.body;

    const numericIdSeance = Number(session_id);
    const numericIdCompte = Number(id_compte);
    const numericIdEleve = id_eleve ? Number(id_eleve) : null;

    let studentToBook;
    if (type_compte === 'parent') {
      const parent = await Parent.findOne({ id_parent: numericIdCompte });
      if (!parent) return res.status(404).json({ message: 'Parent introuvable' });

      studentToBook = await Eleve.findOne({ id_eleve: numericIdEleve });
      if (!studentToBook) return res.status(404).json({ message: 'Enfant introuvable' });

      const isChild = parent.enfants.some(
        (item) => item.student && item.student.toString() === studentToBook._id.toString()
      );
      if (!isChild) return res.status(403).json({ message: "L'élève n'est pas lié à ce parent" });
    } else {
      studentToBook = await Eleve.findOne({ id_eleve: numericIdCompte });
    }

    if (!studentToBook) return res.status(404).json({ message: 'Élève introuvable' });

    const session = await Seance.findOneAndUpdate(
      {
        id_seance: numericIdSeance,
        statut: { $in: ['libre', 'confirmee', 'reportee'] },
        etudiants: { $ne: studentToBook._id }
      },
      { 
        $push: { etudiants: studentToBook._id },
        $set: { statut: 'confirmee' }
      },
      { new: true }
    ).populate('service enseignant');

    if (!session) {
      const check = await Seance.findOne({ id_seance: numericIdSeance });
      if (!check) return res.status(404).json({ message: "Séance introuvable" });
      
      return res.status(400).json({ 
        message: "Inscription impossible (déjà inscrit ou séance complète)" 
      });
    }

    return res.status(201).json({
      status: 'success',
      message: 'Inscription réussie',
      session: await enrichSessionWithDeletedStatus(session)
    });

  } catch (error) {
    console.error("Erreur:", error);
    return res.status(500).json({ error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SÉANCES PASSÉES
// ═══════════════════════════════════════════════════════════════
const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;
    const student = await Eleve.findOne({ id_eleve });
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' });

    const sessions = await Seance.find({
      statut: 'terminee',
      etudiants: student._id,
      date_seance: { $lt: new Date() }    
    })
    .populate('service', 'nom description')
    .populate('enseignant', 'firstname familyname')
    .sort({ date_seance: -1 });

    const enrichedSessions = await Promise.all(
      sessions.map(s => enrichSessionWithDeletedStatus(s))
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      sessions: enrichedSessions
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// SÉANCES À VENIR
// ═══════════════════════════════════════════════════════════════
const getUpcomingSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;
    const student = await Eleve.findOne({ id_eleve });
    if (!student) return res.status(404).json({ message: 'Élève non trouvé' });

    const sessions = await Seance.find({
      etudiants: student._id,
      statut: { $in: ['confirmee', 'reportee'] },
      date_seance: { $gte: new Date() }   
    })
    .populate('service', 'nom description')
    .populate('enseignant', 'firstname familyname')
    .sort({ date_seance: 1 });

    const enrichedSessions = await Promise.all(
      sessions.map(s => enrichSessionWithDeletedStatus(s))
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      sessions: enrichedSessions
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// UN SEUL EXPORT À LA FIN
module.exports = { 
  bookSession, 
  getPastSessions, 
  getUpcomingSessions, 
  enrichSessionWithDeletedStatus 
};