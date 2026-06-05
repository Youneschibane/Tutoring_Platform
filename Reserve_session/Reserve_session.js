const Seance = require('../models/sessionModel');
const Eleve  = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User   = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// TIMEZONE CONFIG
// Algeria is always UTC+1 (no DST)
// ═══════════════════════════════════════════════════════════════

const ALGERIA_UTC_OFFSET = '+01:00';

// ═══════════════════════════════════════════════════════════════
// TIME HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Build start/end as proper UTC Date objects by treating
 * heure_debut / heure_fin as Algeria local time (UTC+1).
 * Works correctly regardless of server timezone (Render = UTC).
 */
const buildSessionDatesUTC = (session) => {
  const dateStr = new Date(session.date_seance)
    .toISOString()
    .split('T')[0];

  const pad = (n) => String(n).padStart(2, '0');

  const [startHour, startMinute] = session.heure_debut.split(':').map(Number);
  const [endHour,   endMinute]   = session.heure_fin.split(':').map(Number);

  const start = new Date(
    `${dateStr}T${pad(startHour)}:${pad(startMinute)}:00${ALGERIA_UTC_OFFSET}`
  );
  const end = new Date(
    `${dateStr}T${pad(endHour)}:${pad(endMinute)}:00${ALGERIA_UTC_OFFSET}`
  );

  return { start, end };
};

/** upcoming = not yet finished */
const getSessionStatus = (session) => {
  const now       = new Date();
  const { end }   = buildSessionDatesUTC(session);
  return now < end ? 'upcoming' : 'past';
};

const sortSessionsByStartDate = (a, b) => {
  const { start: startA } = buildSessionDatesUTC(a);
  const { start: startB } = buildSessionDatesUTC(b);
  return startA - startB;
};

// ═══════════════════════════════════════════════════════════════
// HELPER — ENRICH SESSION
// Adds participantsStatus + sessionStatus to any session object.
// Works for both enrolled Users and children without User accounts.
// ═══════════════════════════════════════════════════════════════

const enrichSessionWithDeletedStatus = async (session) => {
  const sessionObj = session.toObject ? session.toObject() : { ...session };

  if (!session?.students?.length) {
    return {
      ...sessionObj,
      participantsStatus: [],
      sessionStatus: getSessionStatus(sessionObj)
    };
  }

  const participantsStatus = session.students.map((student) => ({
    // identity
    userId:           student.userId   || null,
    idmembre:         student.idmembre || null,

    // name from snapshot (set at booking time — always reliable)
    firstname:        student.snapshot?.firstname  || 'Inconnu',
    familyname:       student.snapshot?.familyname || '',

    // soft-delete info
    isDeleted: student.isDeleted,
    deletedAt: student.deletedAt,
    status:    student.isDeleted ? 'account_deleted' : 'active',

    // booking context
    bookedBy:         student.bookedBy         || null,
    bookedByIdmembre: student.bookedByIdmembre || null,

    // 'self' → student booked themselves
    // 'parent' → a parent booked on behalf of their child
    reservationType:  student.bookedBy ? 'parent' : 'self'
  }));

  return {
    ...sessionObj,
    participantsStatus,
    sessionStatus: getSessionStatus(sessionObj)
  };
};

// ═══════════════════════════════════════════════════════════════
// BOOK SESSION
// ═══════════════════════════════════════════════════════════════

/**
 * Body params:
 *   session_id   {Number}  — id_seance
 *   type_compte  {String}  — 'parent' | 'student'
 *   id_compte    {Number}  — idmembre of the person making the request
 *   id_eleve     {Number}  — (parent flow only) idmembre of the child to enroll
 */
const bookSession = async (req, res) => {
  try {
    const { session_id, type_compte, id_compte, id_eleve } = req.body;

    const numericIdSeance = Number(session_id);
    const numericIdCompte = Number(id_compte);
    const numericIdEleve  = id_eleve ? Number(id_eleve) : null;

    // ── Fetch session ────────────────────────────────────────
    const seance = await Seance.findOne({ id_seance: numericIdSeance });

    if (!seance) {
      return res.status(404).json({ message: 'Séance introuvable' });
    }

    // ── Check capacity ───────────────────────────────────────
    const activeStudents = seance.students.filter((s) => !s.isDeleted).length;

    if (activeStudents >= seance.nombre_max_participants) {
      return res.status(400).json({ message: 'Séance complète' });
    }

    // ────────────────────────────────────────────────────────
    // PARENT BOOKING
    // Child does NOT have a User account — only an Eleve doc.
    // We store: userId = null, idmembre = child's id,
    //           bookedBy = parent's User ObjectId
    // ────────────────────────────────────────────────────────
    if (type_compte === 'parent') {

      if (!numericIdEleve) {
        return res.status(400).json({ message: 'id_eleve est requis pour une réservation parent' });
      }

      // 1. Verify parent exists
      const parent = await Parent.findOne({ id_parent: numericIdCompte });
      if (!parent) {
        return res.status(404).json({ message: 'Parent introuvable' });
      }

      // 2. Verify child (Eleve) exists
      const eleve = await Eleve.findOne({ id_eleve: numericIdEleve });
      if (!eleve) {
        return res.status(404).json({ message: 'Enfant introuvable' });
      }

      // 3. Verify child belongs to this parent
      const childEntry = parent.enfants.find(
        (item) => item.student?.toString() === eleve._id.toString()
      );
      if (!childEntry) {
        return res.status(403).json({ message: "L'élève n'est pas lié à ce parent" });
      }

      // 4. Prevent duplicate enrollment (keyed on idmembre for children)
      const alreadyEnrolled = seance.students.some(
        (s) => s.idmembre === numericIdEleve && !s.isDeleted
      );
      if (alreadyEnrolled) {
        return res.status(400).json({ message: 'Élève déjà inscrit à cette séance' });
      }

      // 5. Get parent's User document (needed for bookedBy reference)
      const parentUser = await User.findOne({ idmembre: numericIdCompte })
        .select('_id idmembre');
      if (!parentUser) {
        return res.status(404).json({ message: 'Compte parent introuvable' });
      }

      // 6. Snapshot: prefer parent.enfants entry (has firstname/familyname),
      //    fall back to fields on the Eleve doc if they ever exist.
      const snapshotFirstname  = childEntry.firstname  || 'Inconnu';
      const snapshotFamilyname = childEntry.familyname || '';

      // 7. Push student entry
      seance.students.push({
        userId:           null,               // child has no User account
        idmembre:         numericIdEleve,
        bookedBy:         parentUser._id,
        bookedByIdmembre: parentUser.idmembre,
        snapshot: {
          firstname:  snapshotFirstname,
          familyname: snapshotFamilyname,
          role:       'student'
        },
        joinedAt:  new Date(),
        isDeleted: false,
        deletedAt: null
      });
    }

    // ────────────────────────────────────────────────────────
    // STUDENT BOOKING
    // Student has a full User account — userId is set, bookedBy null.
    // ────────────────────────────────────────────────────────
    else {

      // 1. Verify Eleve profile exists
      const eleve = await Eleve.findOne({ id_eleve: numericIdCompte });
      if (!eleve) {
        return res.status(404).json({ message: 'Élève introuvable' });
      }

      // 2. Verify User account exists
      const userToEnroll = await User.findOne({ idmembre: numericIdCompte })
        .select('_id idmembre firstname familyname role');
      if (!userToEnroll) {
        return res.status(404).json({ message: 'Utilisateur introuvable' });
      }

      // 3. Prevent duplicate enrollment (keyed on userId for full users)
      const alreadyEnrolled = seance.students.some(
        (s) =>
          s.userId?.toString() === userToEnroll._id.toString() &&
          !s.isDeleted
      );
      if (alreadyEnrolled) {
        return res.status(400).json({ message: 'Élève déjà inscrit à cette séance' });
      }

      // 4. Push student entry
      seance.students.push({
        userId:           userToEnroll._id,
        idmembre:         userToEnroll.idmembre,
        bookedBy:         null,
        bookedByIdmembre: null,
        snapshot: {
          firstname:  userToEnroll.firstname,
          familyname: userToEnroll.familyname,
          role:       userToEnroll.role
        },
        joinedAt:  new Date(),
        isDeleted: false,
        deletedAt: null
      });
    }

    // ── Confirm session ──────────────────────────────────────
    seance.statut = 'confirmee';

    const updatedSeance  = await seance.save();
    const enrichedSeance = await enrichSessionWithDeletedStatus(updatedSeance);

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      session: enrichedSeance
    });

  } catch (error) {
    console.error('BOOK SESSION ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET PAST SESSIONS
// Works for both: student (has User) and child (no User, idmembre only)
// ═══════════════════════════════════════════════════════════════

const getPastSessions = async (req, res) => {
  try {
    const id_eleve = Number(req.body.id_eleve);

    // Verify the Eleve profile exists
    const student = await Eleve.findOne({ id_eleve }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Élève non trouvé' });
    }

    // Query by idmembre — works for both children (userId=null) and full students
    const sessions = await Seance.find({
      'students.idmembre':   id_eleve,
      'students.isDeleted':  { $ne: true },
      'archivedMeta.isArchived': { $ne: true },
      statut: { $in: ['assuree', 'annulee'] }
    })
      .populate('service',    'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    const pastSessions = sessions
      .filter((s) => getSessionStatus(s) === 'past')
      .sort(sortSessionsByStartDate)
      .reverse();

    const enrichedSessions = await Promise.all(
      pastSessions.map((s) => enrichSessionWithDeletedStatus(s))
    );

    return res.status(200).json({
      success: true,
      count:   enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('GET PAST SESSIONS ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET UPCOMING SESSIONS
// ═══════════════════════════════════════════════════════════════

const getUpcomingSessions = async (req, res) => {
  try {
    const id_eleve = Number(req.body.id_eleve);

    // Verify the Eleve profile exists
    const student = await Eleve.findOne({ id_eleve }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Élève non trouvé' });
    }

    // Query by idmembre — works for both children and full students
    const sessions = await Seance.find({
      'students.idmembre':   id_eleve,
      'students.isDeleted':  { $ne: true },
      'archivedMeta.isArchived': { $ne: true },
      statut: { $in: ['libre', 'confirmee', 'reportee'] }
    })
      .populate('service',    'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    const upcomingSessions = sessions
      .filter((s) => getSessionStatus(s) === 'upcoming')
      .sort(sortSessionsByStartDate);

    const enrichedSessions = await Promise.all(
      upcomingSessions.map((s) => enrichSessionWithDeletedStatus(s))
    );

    return res.status(200).json({
      success: true,
      count:   enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('GET UPCOMING SESSIONS ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET SESSIONS BOOKED BY A PARENT
// Returns all sessions where bookedByIdmembre === id_parent,
// regardless of which child was enrolled.
// ═══════════════════════════════════════════════════════════════

const getSessionsByParent = async (req, res) => {
  try {
    const id_parent = Number(req.body.id_parent);

    const parent = await Parent.findOne({ id_parent }).lean();
    if (!parent) {
      return res.status(404).json({ success: false, message: 'Parent non trouvé' });
    }

    const sessions = await Seance.find({
      'students.bookedByIdmembre': id_parent,
      'students.isDeleted':        { $ne: true },
      'archivedMeta.isArchived':   { $ne: true }
    })
      .populate('service',    'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    const enrichedSessions = await Promise.all(
      sessions.map((s) => enrichSessionWithDeletedStatus(s))
    );

    // Attach sessionStatus then split upcoming / past
    const upcoming = enrichedSessions
      .filter((s) => s.sessionStatus === 'upcoming')
      .sort(sortSessionsByStartDate);

    const past = enrichedSessions
      .filter((s) => s.sessionStatus === 'past')
      .sort(sortSessionsByStartDate)
      .reverse();

    return res.status(200).json({
      success:          true,
      countUpcoming:    upcoming.length,
      countPast:        past.length,
      upcomingSessions: upcoming,
      pastSessions:     past
    });

  } catch (error) {
    console.error('GET SESSIONS BY PARENT ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET SESSION DETAIL
// ═══════════════════════════════════════════════════════════════

const getSessionDetail = async (req, res) => {
  try {
    const numericIdSeance = Number(req.params.id_seance);

    const seance = await Seance.findOne({ id_seance: numericIdSeance })
      .populate('service',    'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    if (!seance) {
      return res.status(404).json({ success: false, message: 'Séance introuvable' });
    }

    const teacherStatus   = seance.archivedMeta?.isArchived ? 'no_longer_active' : 'active';
    const enrichedSeance  = await enrichSessionWithDeletedStatus(seance);

    return res.status(200).json({
      success: true,
      data:    { seance: enrichedSeance, teacherStatus }
    });

  } catch (error) {
    console.error('GET SESSION DETAIL ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════

module.exports = {
  bookSession,
  getPastSessions,
  getUpcomingSessions,
  getSessionsByParent,
  getSessionDetail,
  enrichSessionWithDeletedStatus,
  getSessionStatus
};
