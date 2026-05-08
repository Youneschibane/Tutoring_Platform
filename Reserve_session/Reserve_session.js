const Seance = require('../models/sessionModel');
const Eleve = require('../models/studentModel');
const Parent = require('../models/parentModel');
const User = require('../models/userModel');

// ═══════════════════════════════════════════════════════════════
// TIMEZONE CONFIG
// ═══════════════════════════════════════════════════════════════

const ALGERIA_TIMEZONE = 'Africa/Algiers';

// ═══════════════════════════════════════════════════════════════
// TIME HELPERS
// ═══════════════════════════════════════════════════════════════

const getCurrentAlgeriaDate = () => {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: ALGERIA_TIMEZONE
    })
  );
};

const buildSessionDates = (session) => {
  const start = new Date(session.date_seance);

  const [startHour, startMinute] = session.heure_debut
    .split(':')
    .map(Number);

  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(session.date_seance);

  const [endHour, endMinute] = session.heure_fin
    .split(':')
    .map(Number);

  end.setHours(endHour, endMinute, 0, 0);

  return {
    start,
    end
  };
};

// upcoming = pas encore terminée
// past = terminée

const getSessionStatus = (session) => {
  const now = getCurrentAlgeriaDate();

  const { end } = buildSessionDates(session);

  return now < end ? 'upcoming' : 'past';
};

const sortSessionsByStartDate = (a, b) => {
  const { start: startA } = buildSessionDates(a);
  const { start: startB } = buildSessionDates(b);

  return startA - startB;
};

// ═══════════════════════════════════════════════════════════════
// HELPER — ENRICH SESSION
// ═══════════════════════════════════════════════════════════════

const enrichSessionWithDeletedStatus = async (session) => {
  if (
    !session ||
    !session.students ||
    session.students.length === 0
  ) {
    const sessionObj = session.toObject
      ? session.toObject()
      : session;

    return {
      ...sessionObj,
      participantsStatus: [],
      sessionStatus: getSessionStatus(sessionObj)
    };
  }

  const participantsStatus = [];

  for (const student of session.students) {
    participantsStatus.push({
      userId: student.userId,
      idmembre: student.idmembre,

      firstname:
        student.snapshot?.firstname || 'Inconnu',

      familyname:
        student.snapshot?.familyname || '',

      isDeleted: student.isDeleted,

      deletedAt: student.deletedAt,

      status: student.isDeleted
        ? 'account_deleted'
        : 'active'
    });
  }

  const sessionObj = session.toObject
    ? session.toObject()
    : session;

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
    const {
      session_id,
      type_compte,
      id_compte,
      id_eleve
    } = req.body;

    const numericIdSeance = Number(session_id);
    const numericIdCompte = Number(id_compte);
    const numericIdEleve = id_eleve
      ? Number(id_eleve)
      : null;

    let studentToBook;
    let userToEnroll;

    // ───────────────────────────────────────────────────────────
    // PARENT BOOKING
    // ───────────────────────────────────────────────────────────

    if (type_compte === 'parent') {
      const parent = await Parent.findOne({
        id_parent: numericIdCompte
      });

      if (!parent) {
        return res.status(404).json({
          message: 'Parent introuvable'
        });
      }

      studentToBook = await Eleve.findOne({
        id_eleve: numericIdEleve
      });

      if (!studentToBook) {
        return res.status(404).json({
          message: 'Enfant introuvable'
        });
      }

      const isChild = parent.enfants.some(
        (item) =>
          item.student &&
          item.student.toString() ===
            studentToBook._id.toString()
      );

      if (!isChild) {
        return res.status(403).json({
          message:
            "L'élève n'est pas lié à ce parent"
        });
      }

      userToEnroll = await User.findOne({
        idmembre: numericIdEleve
      }).select(
        'firstname familyname role idmembre'
      );
    }

    // ───────────────────────────────────────────────────────────
    // STUDENT BOOKING
    // ───────────────────────────────────────────────────────────

    else {
      studentToBook = await Eleve.findOne({
        id_eleve: numericIdCompte
      });

      if (!studentToBook) {
        return res.status(404).json({
          message: 'Élève introuvable'
        });
      }

      userToEnroll = await User.findOne({
        idmembre: numericIdCompte
      }).select(
        'firstname familyname role idmembre'
      );
    }

    if (!userToEnroll) {
      return res.status(404).json({
        message: 'Utilisateur introuvable'
      });
    }

    // ───────────────────────────────────────────────────────────
    // GET SESSION
    // ───────────────────────────────────────────────────────────

    const seance = await Seance.findOne({
      id_seance: numericIdSeance
    });

    if (!seance) {
      return res.status(404).json({
        message: 'Séance introuvable'
      });
    }

    // ───────────────────────────────────────────────────────────
    // CHECK ALREADY ENROLLED
    // ───────────────────────────────────────────────────────────

    const alreadyEnrolled = seance.students.some(
      (student) =>
        student.userId.toString() ===
          userToEnroll._id.toString() &&
        !student.isDeleted
    );

    if (alreadyEnrolled) {
      return res.status(400).json({
        message:
          'Élève déjà inscrit à cette séance'
      });
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
      await enrichSessionWithDeletedStatus(
        updatedSeance
      );

    return res.status(201).json({
      success: true,
      message: 'Inscription réussie',
      session: enrichedSeance
    });

  } catch (error) {
    console.error('BOOK SESSION ERROR:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET PAST SESSIONS
// ═══════════════════════════════════════════════════════════════

const getPastSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    // ───────────────────────────────────────────────────────────
    // CHECK STUDENT
    // ───────────────────────────────────────────────────────────

    const student = await Eleve.findOne({
      id_eleve
    }).lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé'
      });
    }

    // ───────────────────────────────────────────────────────────
    // CHECK USER
    // ───────────────────────────────────────────────────────────

    const user = await User.findOne({
      idmembre: id_eleve
    })
      .select('_id')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // ───────────────────────────────────────────────────────────
    // GET SESSIONS
    // ───────────────────────────────────────────────────────────

    const sessions = await Seance.find({
      'students.userId': user._id,

      'students.isDeleted': {
        $ne: true
      },

      'archivedMeta.isArchived': {
        $ne: true
      }
    })
      .populate(
        'service',
        'nom description type_service matiere'
      )
      .populate(
        'enseignant',
        'firstname familyname'
      )
      .lean();

    // ───────────────────────────────────────────────────────────
    // FILTER PAST SESSIONS
    // ───────────────────────────────────────────────────────────

    const pastSessions = sessions
      .filter(
        (session) =>
          getSessionStatus(session) === 'past'
      )
      .sort(sortSessionsByStartDate)
      .reverse();

    // ───────────────────────────────────────────────────────────
    // ENRICH
    // ───────────────────────────────────────────────────────────

    const enrichedSessions = await Promise.all(
      pastSessions.map((session) =>
        enrichSessionWithDeletedStatus(session)
      )
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error(
      'GET PAST SESSIONS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET UPCOMING SESSIONS
// ═══════════════════════════════════════════════════════════════

const getUpcomingSessions = async (req, res) => {
  try {
    const { id_eleve } = req.body;

    // ───────────────────────────────────────────────────────────
    // CHECK STUDENT
    // ───────────────────────────────────────────────────────────

    const student = await Eleve.findOne({
      id_eleve
    }).lean();

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Élève non trouvé'
      });
    }

    // ───────────────────────────────────────────────────────────
    // CHECK USER
    // ───────────────────────────────────────────────────────────

    const user = await User.findOne({
      idmembre: id_eleve
    })
      .select('_id')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // ───────────────────────────────────────────────────────────
    // GET SESSIONS
    // ───────────────────────────────────────────────────────────

    const sessions = await Seance.find({
      'students.userId': user._id,

      'students.isDeleted': {
        $ne: true
      },

      statut: {
        $in: ['confirmee', 'reportee']
      },

      'archivedMeta.isArchived': {
        $ne: true
      }
    })
      .populate(
        'service',
        'nom description type_service matiere'
      )
      .populate(
        'enseignant',
        'firstname familyname'
      )
      .lean();

    // ───────────────────────────────────────────────────────────
    // FILTER UPCOMING
    // ───────────────────────────────────────────────────────────

    const upcomingSessions = sessions
      .filter(
        (session) =>
          getSessionStatus(session) ===
          'upcoming'
      )
      .sort(sortSessionsByStartDate);

    // ───────────────────────────────────────────────────────────
    // ENRICH
    // ───────────────────────────────────────────────────────────

    const enrichedSessions = await Promise.all(
      upcomingSessions.map((session) =>
        enrichSessionWithDeletedStatus(session)
      )
    );

    return res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      sessions: enrichedSessions
    });

  } catch (error) {
    console.error(
      'GET UPCOMING SESSIONS ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ═══════════════════════════════════════════════════════════════
// GET SESSION DETAIL
// ═══════════════════════════════════════════════════════════════

const getSessionDetail = async (req, res) => {
  try {
    const { id_seance } = req.params;

    const numericIdSeance = Number(id_seance);

    const seance = await Seance.findOne({
      id_seance: numericIdSeance
    })
      .populate(
        'service',
        'nom description type_service matiere'
      )
      .populate(
        'enseignant',
        'firstname familyname'
      )
      .lean();

    if (!seance) {
      return res.status(404).json({
        success: false,
        message: 'Séance introuvable'
      });
    }

    // ───────────────────────────────────────────────────────────
    // TEACHER STATUS
    // ───────────────────────────────────────────────────────────

    const teacherStatus =
      seance.archivedMeta?.isArchived
        ? 'no_longer_active'
        : 'active';

    // ───────────────────────────────────────────────────────────
    // ENRICH SESSION
    // ───────────────────────────────────────────────────────────

    const enrichedSeance =
      await enrichSessionWithDeletedStatus(
        seance
      );

    return res.status(200).json({
      success: true,

      data: {
        seance: enrichedSeance,
        teacherStatus
      }
    });

  } catch (error) {
    console.error(
      'GET SESSION DETAIL ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      error: error.message
    });
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