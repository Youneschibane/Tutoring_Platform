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

/**
 * upcoming = pas encore terminée
 * past     = terminée
 */
const getSessionStatus = (session) => {
  const now     = new Date();
  const { end } = buildSessionDatesUTC(session);
  return now < end ? 'upcoming' : 'past';
};

const sortSessionsByStartDate = (a, b) => {
  const { start: startA } = buildSessionDatesUTC(a);
  const { start: startB } = buildSessionDatesUTC(b);
  return startA - startB;
};

// ═══════════════════════════════════════════════════════════════
// HELPER — ENRICH SESSION
// ═══════════════════════════════════════════════════════════════

const enrichSessionWithDeletedStatus = async (session) => {
  const sessionObj = session.toObject ? session.toObject() : session;

  if (!session?.students?.length) {
    return {
      ...sessionObj,
      participantsStatus: [],
      sessionStatus: getSessionStatus(sessionObj)
    };
  }

  const participantsStatus = session.students.map((student) => ({
    userId:     student.userId,
    idmembre:   student.idmembre,
    firstname:  student.snapshot?.firstname  || 'Inconnu',
    familyname: student.snapshot?.familyname || '',
    isDeleted:  student.isDeleted,
    deletedAt:  student.deletedAt,
    status:     student.isDeleted ? 'account_deleted' : 'active'
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
 *
 * PARENT FLOW:
 *   - Child has NO User account (Eleve doc only)
 *   - userId   → parent's ObjectId   (only User available)
 *   - idmembre → child's idmembre    (to identify which child)
 *   - snapshot → child's name        (from parent.enfants entry)
 *
 * STUDENT FLOW:
 *   - Student has a full User account
 *   - userId   → student's ObjectId
 *   - idmembre → student's idmembre
 *   - snapshot → student's name from User doc
 */
const bookSession = async (req, res) => {
  try {
    const { session_id, type_compte, id_compte, id_eleve } = req.body;

    const numericIdSeance = Number(session_id);
    const numericIdCompte = Number(id_compte);
    const numericIdEleve  = id_eleve ? Number(id_eleve) : null;

    let snapshotFirstname;
    let snapshotFamilyname;
    let snapshotRole;
    let enrollUserId;
    let enrollIdmembre;

    // ───────────────────────────────────────────────────────────
    // PARENT BOOKING
    // userId   = parent ObjectId  (child has no User account)
    // idmembre = child idmembre   (to track which child)
    // snapshot = child name       (from parent.enfants)
    // ───────────────────────────────────────────────────────────

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

      // 4. Get parent User (only available User in this flow)
      const parentUser = await User.findOne({ idmembre: numericIdCompte })
        .select('_id idmembre');
      if (!parentUser) {
        return res.status(404).json({ message: 'Compte parent introuvable' });
      }

      // 5. Compose entry values
      enrollUserId       = parentUser._id;             // parent ObjectId
      enrollIdmembre     = numericIdEleve;              // child idmembre ✅
      snapshotFirstname  = childEntry.firstname  || 'Inconnu'; // child name ✅
      snapshotFamilyname = childEntry.familyname || '';
      snapshotRole       = 'student';
    }

    // ───────────────────────────────────────────────────────────
    // STUDENT BOOKING
    // userId   = student ObjectId
    // idmembre = student idmembre
    // snapshot = student name from User doc
    // ───────────────────────────────────────────────────────────

    else {

      // 1. Verify Eleve profile exists
      const eleve = await Eleve.findOne({ id_eleve: numericIdCompte });
      if (!eleve) {
        return res.status(404).json({ message: 'Élève introuvable' });
      }

      // 2. Get student User account
      const studentUser = await User.findOne({ idmembre: numericIdCompte })
        .select('_id idmembre firstname familyname role');
      if (!studentUser) {
        return res.status(404).json({ message: 'Utilisateur introuvable' });
      }

      // 3. Compose entry values
      enrollUserId       = studentUser._id;
      enrollIdmembre     = studentUser.idmembre;
      snapshotFirstname  = studentUser.firstname;
      snapshotFamilyname = studentUser.familyname;
      snapshotRole       = studentUser.role;
    }

    // ───────────────────────────────────────────────────────────
    // GET SESSION
    // ───────────────────────────────────────────────────────────

    const seance = await Seance.findOne({ id_seance: numericIdSeance });
    if (!seance) {
      return res.status(404).json({ message: 'Séance introuvable' });
    }

    // ───────────────────────────────────────────────────────────
    // CHECK ALREADY ENROLLED
    // parent flow → check by idmembre (userId = parent, not child)
    // student flow → check by userId
    // ───────────────────────────────────────────────────────────

    const alreadyEnrolled = seance.students.some((s) => {
      if (s.isDeleted) return false;
      if (type_compte === 'parent') {
        return s.idmembre === enrollIdmembre;
      }
      return s.userId?.toString() === enrollUserId.toString();
    });

    if (alreadyEnrolled) {
      return res.status(400).json({ message: 'Élève déjà inscrit à cette séance' });
    }

    // ───────────────────────────────────────────────────────────
    // ADD STUDENT
    // ───────────────────────────────────────────────────────────

    seance.students.push({
      userId:   enrollUserId,        // parent ObjectId (parent flow) OR student ObjectId
      idmembre: enrollIdmembre,      // child idmembre  (parent flow) OR student idmembre
      snapshot: {
        firstname:  snapshotFirstname,  // always the child/student name ✅
        familyname: snapshotFamilyname,
        role:       snapshotRole
      },
      joinedAt:  new Date(),
      isDeleted: false,
      deletedAt: null
    });

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
// Works for both:
//   - student with User account → query by students.userId
//   - child without User        → query by students.idmembre
// ═══════════════════════════════════════════════════════════════

const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    // 1. Verify Eleve profile exists
    const student = await Eleve.findOne({ id_eleve }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Élève non trouvé' });
    }

    // 2. Try to find a User account for this idmembre
    //    Student → has User  → query by students.userId
    //    Child   → no User   → query by students.idmembre (set at booking time)
    const user = await User.findOne({ idmembre: id_eleve }).select('_id').lean();

    const studentQuery = user
      ? { 'students.userId': user._id }
      : { 'students.idmembre': Number(id_eleve) };

    const sessions = await Seance.find({
      ...studentQuery,
      'students.isDeleted':      { $ne: true },
      'archivedMeta.isArchived': { $ne: true },
      statut:                    { $in: ['assuree', 'annulee'] }
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
      success:  true,
      count:    enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('GET PAST SESSIONS ERROR:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET UPCOMING SESSIONS
// Works for both:
//   - student with User account → query by students.userId
//   - child without User        → query by students.idmembre
// ═══════════════════════════════════════════════════════════════

const getUpcomingSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    // 1. Verify Eleve profile exists
    const student = await Eleve.findOne({ id_eleve }).lean();
    if (!student) {
      return res.status(404).json({ success: false, message: 'Élève non trouvé' });
    }

    // 2. Try to find a User account for this idmembre
    //    Student → has User  → query by students.userId
    //    Child   → no User   → query by students.idmembre (set at booking time)
    const user = await User.findOne({ idmembre: id_eleve }).select('_id').lean();

    const studentQuery = user
      ? { 'students.userId': user._id }
      : { 'students.idmembre': Number(id_eleve) };

    const sessions = await Seance.find({
      ...studentQuery,
      'students.isDeleted':      { $ne: true },
      'archivedMeta.isArchived': { $ne: true },
      statut:                    { $in: ['libre', 'confirmee', 'reportee'] }
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
      success:  true,
      count:    enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error('GET UPCOMING SESSIONS ERROR:', error);
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

    const teacherStatus  = seance.archivedMeta?.isArchived ? 'no_longer_active' : 'active';
    const enrichedSeance = await enrichSessionWithDeletedStatus(seance);

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
  getSessionDetail,
  enrichSessionWithDeletedStatus,
  getSessionStatus
};
