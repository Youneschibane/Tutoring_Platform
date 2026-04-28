const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const { 
  bookSession,
  getPastSessions,
  getUpcomingSessions,
  getSessionDetail 
} = require('../Reserve_session/Reserve_session');

const {
  getSessionParticipants,
  getMySessionsStudent
} = require('../controllers/seanceController');

// Helper middleware to restrict to specific role
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        status: 'fail', 
        message: 'Vous n\'êtes pas autorisé à accéder à cette ressource' 
      });
    }
    next();
  };
};

// Protected routes - requires authentication
router.post('/bookSession', protect, bookSession);
router.post('/getPastSessions', protect, getPastSessions);
router.post('/getUpcomingSessions', protect, getUpcomingSessions);
router.get('/session/:id_seance', protect, getSessionDetail);

// Seance participant management
router.get('/session/:id_seance/participants', protect, restrictTo('teacher'), getSessionParticipants);
router.get('/mes-seances', protect, restrictTo('student', 'parent'), getMySessionsStudent);

module.exports = router;