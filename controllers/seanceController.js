const Seance  = require('../models/sessionModel');
const Teacher = require('../models/teacherModel');
const Parent  = require('../models/parentModel');
const User    = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// TEACHER VIEW — List Session Participants
// ═══════════════════════════════════════════════════════════════

const getSessionParticipants = async (req, res) => {
  try {
    const numericIdSeance = Number(req.params.id_seance);

    // ── 1. Fetch session ──────────────────────────────────────
    const seance = await Seance.findOne({ id_seance: numericIdSeance })
      .populate('enseignant', 'id_enseignant');

    if (!seance) {
      return res.status(404).json({
        status:  'fail',
        message: 'Séance introuvable'
      });
    }

    // ── 2. Verify requester is the session's teacher ──────────
    const reqUser = await User.findById(req.user._id).select('idmembre role');

    if (
      reqUser.role !== 'teacher' ||
      reqUser.idmembre !== seance.enseignant.id_enseignant
    ) {
      return res.status(403).json({
        status:  'fail',
        message: "Vous n'êtes pas autorisé à voir les participants de cette séance"
      });
    }

    // ── 3. Build participants list from snapshot ──────────────
    // snapshot is always populated at booking time for both
    // full students (userId set) and children (userId = null).
    const activeParticipants = seance.students.filter((s) => !s.isDeleted);
    const deletedParticipants = seance.students.filter((s) => s.isDeleted);

    const mapParticipant = (s) => ({
      idmembre:         s.idmembre,
      firstname:        s.snapshot?.firstname  || 'Inconnu',
      familyname:       s.snapshot?.familyname || '',
      role:             s.snapshot?.role       || 'student',
      joinedAt:         s.joinedAt,
      status:           s.isDeleted ? 'account_deleted' : 'active',
      deletedAt:        s.deletedAt || null,
      // booking context — useful for teacher to know if parent enrolled child
      reservationType:  s.bookedBy ? 'parent' : 'self',
      bookedByIdmembre: s.bookedByIdmembre || null
    });

    return res.status(200).json({
      status: 'success',
      data: {
        id_seance:          seance.id_seance,
        titre:              seance.titre,
        date_seance:        seance.date_seance,
        totalParticipants:  seance.students.length,
        activeParticipants: activeParticipants.length,
        participants:       seance.students.map(mapParticipant)
      }
    });

  } catch (error) {
    console.error('Error fetching session participants:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// STUDENT VIEW — My Sessions
// Query by idmembre (works for full students who have a User account)
// ═══════════════════════════════════════════════════════════════

const getMySessionsStudent = async (req, res) => {
  try {
    const reqUser = await User.findById(req.user._id).select('idmembre role');

    if (!reqUser || !['student', 'parent'].includes(reqUser.role)) {
      return res.status(403).json({
        status:  'fail',
        message: 'Seul les élèves et parents peuvent accéder à leurs séances'
      });
    }

    // ──────────────────────────────────────────────────────────
    // STUDENT FLOW
    // Full student — has a User account, books for themselves.
    // Query by idmembre (safe for all students, avoids userId=null issues).
    // ──────────────────────────────────────────────────────────
    if (reqUser.role === 'student') {

      const sessions = await Seance.find({
        'students.idmembre':  reqUser.idmembre,
        'students.isDeleted': { $ne: true },
        'archivedMeta.isArchived': { $ne: true }
      })
        .populate('service',    'nom description matiere type_service')
        .populate('enseignant', 'firstname familyname')
        .sort({ date_seance: -1 })
        .lean();

      const mySessions = sessions.map((seance) => {
        const myEntry = seance.students.find(
          (s) => s.idmembre === reqUser.idmembre && !s.isDeleted
        );
        if (!myEntry) return null;

        return {
          id_seance:       seance.id_seance,
          titre:           seance.titre,
          service:         seance.service,
          enseignant:      seance.enseignant,
          date_seance:     seance.date_seance,
          heure_debut:     seance.heure_debut,
          heure_fin:       seance.heure_fin,
          mode:            seance.mode,
          prix:            seance.prix,
          statut:          seance.statut,
          joinedAt:        myEntry.joinedAt,
          myStatus:        'active',
          reservationType: 'self'
        };
      }).filter(Boolean);

      return res.status(200).json({
        status: 'success',
        data:   { count: mySessions.length, sessions: mySessions }
      });
    }

    // ──────────────────────────────────────────────────────────
    // PARENT FLOW
    // Parent books on behalf of their children.
    // Children have NO User account — only an Eleve doc.
    // Query by bookedByIdmembre, then group results by child.
    // ──────────────────────────────────────────────────────────
    if (reqUser.role === 'parent') {

      const parent = await Parent.findOne({ id_parent: reqUser.idmembre }).lean();

      if (!parent) {
        return res.status(404).json({
          status:  'fail',
          message: 'Profil parent introuvable'
        });
      }

      // All sessions where this parent made the booking
      const sessions = await Seance.find({
        'students.bookedByIdmembre': reqUser.idmembre,
        'students.isDeleted':        { $ne: true },
        'archivedMeta.isArchived':   { $ne: true }
      })
        .populate('service',    'nom description matiere type_service')
        .populate('enseignant', 'firstname familyname')
        .sort({ date_seance: -1 })
        .lean();

      // Group sessions by child (idmembre)
      const byChild = {};

      sessions.forEach((seance) => {
        seance.students
          .filter(
            (s) => s.bookedByIdmembre === reqUser.idmembre && !s.isDeleted
          )
          .forEach((entry) => {
            const childId = entry.idmembre;

            if (!byChild[childId]) {
              byChild[childId] = {
                idmembre:   childId,
                firstname:  entry.snapshot?.firstname  || 'Inconnu',
                familyname: entry.snapshot?.familyname || '',
                sessions:   []
              };
            }

            byChild[childId].sessions.push({
              id_seance:       seance.id_seance,
              titre:           seance.titre,
              service:         seance.service,
              enseignant:      seance.enseignant,
              date_seance:     seance.date_seance,
              heure_debut:     seance.heure_debut,
              heure_fin:       seance.heure_fin,
              mode:            seance.mode,
              prix:            seance.prix,
              statut:          seance.statut,
              joinedAt:        entry.joinedAt,
              myStatus:        'active',
              reservationType: 'parent'
            });
          });
      });

      const children = Object.values(byChild);

      return res.status(200).json({
        status: 'success',
        data: {
          totalChildren:  children.length,
          totalSessions:  sessions.length,
          children
        }
      });
    }

  } catch (error) {
    console.error('Error fetching my sessions:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  getSessionParticipants,
  getMySessionsStudent
};
