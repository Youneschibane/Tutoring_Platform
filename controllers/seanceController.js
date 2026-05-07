const Seance = require('../models/sessionModel');
const Teacher = require('../models/teacherModel');
const Student = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// TEACHER VIEW — List Session Participants
// ═══════════════════════════════════════════════════════════════
const getSessionParticipants = async (req, res) => {
  try {
    const { id_seance } = req.params;
    const numericIdSeance = Number(id_seance);

    // Verify teacher owns the session
    const seance = await Seance.findOne({ id_seance: numericIdSeance })
      .populate('enseignant', 'id_enseignant');

    if (!seance) {
      return res.status(404).json({ 
        status: 'fail', 
        message: 'Séance introuvable' 
      });
    }

    // Check if requester is the teacher of this session
    const teacher = await Teacher.findOne({ _id: seance.enseignant._id })
      .select('id_enseignant');

    const reqUser = await User.findById(req.user._id).select('idmembre role');

    if (reqUser.role !== 'teacher' || reqUser.idmembre !== teacher.id_enseignant) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Vous n\'êtes pas autorisé à voir les participants de cette séance' 
      });
    }

    // Build participants list with snapshot data
    const participants = seance.students.map((s) => ({
      idmembre: s.idmembre,
      firstname: s.snapshot?.firstname || 'Inconnu',
      familyname: s.snapshot?.familyname || '',
      role: s.snapshot?.role || 'student',
      joinedAt: s.joinedAt,
      status: s.isDeleted ? 'account_deleted' : 'active',
      deletedAt: s.deletedAt || null
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        id_seance: seance.id_seance,
        titre: seance.titre,
        date_seance: seance.date_seance,
        totalParticipants: participants.length,
        activeParticipants: participants.filter(p => p.status === 'active').length,
        participants: participants
      }
    });

  } catch (error) {
    console.error('Error fetching session participants:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: error.message 
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// STUDENT/PARENT VIEW — My Sessions (filter own entries)
// ═══════════════════════════════════════════════════════════════
const getMySessionsStudent = async (req, res) => {
  try {
    const reqUser = await User.findById(req.user._id)
      .select('idmembre role');

    if (!reqUser || (reqUser.role !== 'student' && reqUser.role !== 'parent')) {
      return res.status(403).json({
        status: 'fail',
        message: 'Seul les élèves et parents peuvent accéder à leurs séances'
      });
    }

    // Find all sessions where this user is enrolled (including deleted entries)
    const sessions = await Seance.find({
      'students.userId': req.user._id
    })
      .populate('service', 'nom description matiere type_service')
      .populate('enseignant', 'firstname familyname')
      .sort({ date_seance: -1 });

    // Transform to return only relevant participant data
    const mySessions = sessions.map((seance) => {
      // Find my entry in students array
      const myEntry = seance.students.find(s => s.userId.toString() === req.user._id.toString());

      if (!myEntry) return null;

      return {
        id_seance: seance.id_seance,
        titre: seance.titre,
        service: seance.service,
        enseignant: seance.enseignant,
        date_seance: seance.date_seance,
        heure_debut: seance.heure_debut,
        heure_fin: seance.heure_fin,
        mode: seance.mode,
        prix: seance.prix,
        statut: seance.statut,
        joinedAt: myEntry.joinedAt,
        myStatus: myEntry.isDeleted ? 'account_deleted' : 'active'
      };
    }).filter(s => s !== null);

    return res.status(200).json({
      status: 'success',
      data: {
        count: mySessions.length,
        sessions: mySessions
      }
    });

  } catch (error) {
    console.error('Error fetching my sessions:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};


module.exports = {
  getSessionParticipants,
  getMySessionsStudent
};