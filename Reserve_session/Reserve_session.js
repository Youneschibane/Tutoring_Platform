const Seance = require('../models/sessionModel');
const Eleve = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User = require('../models/userModel');

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
  // Extract YYYY-MM-DD from the stored date, ignoring server TZ
  const dateStr = new Date(session.date_seance)
    .toISOString()
    .split('T')[0];

  const pad = (n) => String(n).padStart(2, '0');

  const [startHour, startMinute] = session.heure_debut
    .split(':')
    .map(Number);

  const [endHour, endMinute] = session.heure_fin
    .split(':')
    .map(Number);

  // ISO 8601 with explicit +01:00 → JS parses to correct UTC
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
  const now = new Date(); // UTC, works on any server
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
    userId: student.userId,
    idmembre: student.idmembre,
    firstname: student.snapshot?.firstname || 'Inconnu',
    familyname: student.snapshot?.familyname || '',
    isDeleted: student.isDeleted,
    deletedAt: student.deletedAt,
    status: student.isDeleted ? 'account_deleted' : 'active'
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

const bookSession = async (req, res) => {
  try {
    const { session_id, type_compte, id_compte, id_eleve } = req.body;

    const numericIdSeance = Number(session_id);
    const numericIdCompte = Number(id_compte);
    const numericIdEleve = id_eleve ? Number(id_eleve) : null;

    let studentToBook;
    let userToEnroll;

    // ───────────────────────────────────────────────────────────
    // PARENT BOOKING
    // ───────────────────────────────────────────────────────────

    if (type_compte === 'parent') {
      const parent = await Parent.findOne({ id_parent: numericIdCompte });

      if (!parent) {
        return res.status(404).json({ message: 'Parent introuvable' });
      }

      studentToBook = await Eleve.findOne({ id_eleve: numericIdEleve });

      if (!studentToBook) {
        return res.status(404).json({ message: 'Enfant introuvable' });
      }

      const isChild = parent.enfants.some(
        (item) =>
          item.student &&
          item.student.toString() === studentToBook._id.toString()
      );

      if (!isChild) {
        return res
          .status(403)
          .json({ message: "L'élève n'est pas lié à ce parent" });
      }

      userToEnroll = await User.findOne({ idmembre: numericIdEleve }).select(
        'firstname familyname role idmembre'
      );
    }

    // ───────────────────────────────────────────────────────────
    // STUDENT BOOKING
    // ───────────────────────────────────────────────────────────

    else {
      studentToBook = await Eleve.findOne({ id_eleve: numericIdCompte });

      if (!studentToBook) {
        return res.status(404).json({ message: 'Élève introuvable' });
      }

      userToEnroll = await User.findOne({ idmembre: numericIdCompte }).select(
        'firstname familyname role idmembre'
      );
    }

    if (!userToEnroll) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
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
    // ───────────────────────────────────────────────────────────

    const alreadyEnrolled = seance.students.some(
      (student) =>
        student.userId.toString() === userToEnroll._id.toString() &&
        !student.isDeleted
    );

    if (alreadyEnrolled) {
      return res
        .status(400)
        .json({ message: 'Élève déjà inscrit à cette séance' });
    }

    // ───────────────────────────────────────────────────────────
    // ADD STUDENT
    // ───────────────────────────────────────────────────────────

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
    const enrichedSeance =
      await enrichSessionWithDeletedStatus(updatedSeance);

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
// ═══════════════════════════════════════════════════════════════

const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    const student = await Eleve.findOne({ id_eleve }).lean();

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Élève non trouvé' });
    }

    const user = await User.findOne({ idmembre: id_eleve })
      .select('_id')
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Only include completed (assuree) or cancelled (annulee) sessions
    const sessions = await Seance.find({
      'students.userId': user._id,
      'students.isDeleted': { $ne: true },
      'archivedMeta.isArchived': { $ne: true },
      statut: { $in: ['assuree', 'annulee'] }
    })
      .populate('service', 'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    const pastSessions = sessions
      .filter((session) => getSessionStatus(session) === 'past')
      .sort(sortSessionsByStartDate)
      .reverse();

    const enrichedSessions = await Promise.all(
      pastSessions.map((session) => enrichSessionWithDeletedStatus(session))
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
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
    const { id_eleve } = req.body;

    const student = await Eleve.findOne({ id_eleve }).lean();

    if (!student) {
      return res
        .status(404)
        .json({ success: false, message: 'Élève non trouvé' });
    }

    const user = await User.findOne({ idmembre: id_eleve })
      .select('_id')
      .lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: 'Utilisateur non trouvé' });
    }

    // Only include pending, confirmed, or rescheduled sessions (not completed/assured or cancelled/annulee)
    const sessions = await Seance.find({
      'students.userId': user._id,
      'students.isDeleted': { $ne: true },
      statut: { $in: ['libre', 'confirmee', 'reportee'] },
      'archivedMeta.isArchived': { $ne: true }
    })
      .populate('service', 'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    const upcomingSessions = sessions
      .filter((session) => getSessionStatus(session) === 'upcoming')
      .sort(sortSessionsByStartDate);

    const enrichedSessions = await Promise.all(
      upcomingSessions.map((session) => enrichSessionWithDeletedStatus(session))
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
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
    const { id_seance } = req.params;

    const numericIdSeance = Number(id_seance);

    const seance = await Seance.findOne({ id_seance: numericIdSeance })
      .populate('service', 'nom description type_service matiere')
      .populate('enseignant', 'firstname familyname')
      .lean();

    if (!seance) {
      return res
        .status(404)
        .json({ success: false, message: 'Séance introuvable' });
    }

    const teacherStatus = seance.archivedMeta?.isArchived
      ? 'no_longer_active'
      : 'active';

    const enrichedSeance = await enrichSessionWithDeletedStatus(seance);

    return res.status(200).json({
      success: true,
      data: { seance: enrichedSeance, teacherStatus }
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