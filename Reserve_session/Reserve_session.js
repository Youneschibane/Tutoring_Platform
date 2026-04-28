const Seance = require('../models/sessionModel');
const Eleve = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// HELPER — Enrichir une séance avec l'état de suppression des participants
// ═══════════════════════════════════════════════════════════════
const enrichSessionWithDeletedStatus = async (session) => {
  if (!session || !session.students || session.students.length === 0) {
    const sessionObj = session.toObject ? session.toObject() : session;
    return { ...sessionObj, participantsStatus: [] };
  }

  const participantsStatus = [];
  
  for (const student of session.students) {
    participantsStatus.push({
      userId: student.userId,
      idmembre: student.idmembre,
      firstname: student.snapshot?.firstname || 'Inconnu',
      familyname: student.snapshot?.familyname || '',
      isDeleted: student.isDeleted,
      deletedAt: student.deletedAt,
      status: student.isDeleted ? 'account_deleted' : 'active'
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
    let userToEnroll;
    
    if (type_compte === 'parent') {
      const parent = await Parent.findOne({ id_parent: numericIdCompte });
      if (!parent) return res.status(404).json({ message: 'Parent introuvable' });

      studentToBook = await Eleve.findOne({ id_eleve: numericIdEleve });
      if (!studentToBook) return res.status(404).json({ message: 'Enfant introuvable' });

      const isChild = parent.enfants.some(
        (item) => item.student && item.student.toString() === studentToBook._id.toString()
      );
      if (!isChild) return res.status(403).json({ message: "L'élève n'est pas lié à ce parent" });

      // Fetch the child's associated User by idmembre
      userToEnroll = await User.findOne({ idmembre: numericIdEleve })
        .select('firstname familyname role idmembre');
    } else {
      studentToBook = await Eleve.findOne({ id_eleve: numericIdCompte });
      if (!studentToBook) return res.status(404).json({ message: 'Élève introuvable' });

      // Fetch the student's associated User by idmembre
      userToEnroll = await User.findOne({ idmembre: numericIdCompte })
        .select('firstname familyname role idmembre');
    }

    if (!userToEnroll) return res.status(404).json({ message: 'Utilisateur introuvable' });

    // Check if already enrolled
    const seance = await Seance.findOne({ id_seance: Number(session_id) });
    if (!seance) return res.status(404).json({ message: "Séance introuvable" });

    const alreadyEnrolled = seance.students.some(
      s => s.userId.toString() === userToEnroll._id.toString() && !s.isDeleted
    );
    if (alreadyEnrolled) {
      return res.status(400).json({ 
        message: "Élève déjà inscrit à cette séance" 
      });
    }

    // Add student with snapshot
    seance.students.push({
      userId: userToEnroll._id,
      idmembre: userToEnroll.idmembre,
      snapshot: {
        firstname: userToEnroll.firstname,
        familyname: userToEnroll.familyname,
        role: userToEnroll.role
      },
      joinedAt: new Date(),
      isDeleted: false,
      deletedAt: null
    });

    seance.statut = 'confirmee';
    const updatedSeance = await seance.save();

    const enrichedSeance = await enrichSessionWithDeletedStatus(updatedSeance);

    return res.status(201).json({
      status: 'success',
      message: 'Inscription réussie',
      session: enrichedSeance
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

    // Fetch the User associated with this student
    const user = await User.findOne({ idmembre: id_eleve });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const sessions = await Seance.find({
      statut: 'terminee',
      'students.userId': user._id,
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

    // Fetch the User associated with this student
    const user = await User.findOne({ idmembre: id_eleve });
    if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

    const sessions = await Seance.find({
      'students.userId': user._id,
      statut: { $in: ['confirmee', 'reportee'] },
      date_seance: { $gte: new Date() },
      'archivedMeta.isArchived': { $ne: true }
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

// ═══════════════════════════════════════════════════════════════
// GET SESSION DETAIL WITH TEACHER STATUS
// ═══════════════════════════════════════════════════════════════
const getSessionDetail = async (req, res) => {
  try {
    const { id_seance } = req.params;
    const numericIdSeance = Number(id_seance);

    const seance = await Seance.findOne({ id_seance: numericIdSeance })
      .populate('service', 'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname');

    if (!seance) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Séance introuvable' 
      });
    }

    // Determine teacher status based on archivedMeta
    const teacherStatus = seance.archivedMeta?.isArchived 
      ? 'no_longer_active' 
      : 'active';

    // Enrich with deleted student status
    const enrichedSeance = await enrichSessionWithDeletedStatus(seance);

    return res.status(200).json({
      status: 'success',
      data: {
        seance: enrichedSeance,
        teacherStatus: teacherStatus
      }
    });

  } catch (error) {
    console.error('Error fetching session detail:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// UN SEUL EXPORT À LA FIN
// ═══════════════════════════════════════════════════════════════
module.exports = { 
  bookSession, 
  getPastSessions, 
  getUpcomingSessions,
  getSessionDetail,
  enrichSessionWithDeletedStatus 
};