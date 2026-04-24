const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const serviceMethods = require('../controllers/serviceController');

// Get subjects - teacher only
router.get('/subjects', protect, restrictTo('teacher'), serviceMethods.getProfSubjects);

// Create service - teacher only
router.post('/create', protect, restrictTo('teacher'), serviceMethods.createService);

// Get my services - protected
router.get('/mesServices', protect, serviceMethods.getMyservice);

// Add session - teacher only
router.post('/addSession', protect, restrictTo('teacher'), serviceMethods.addSession);

// Get service sessions - protected
router.get('/mesSeances', protect, serviceMethods.getServiceSessions);

// Update service - teacher only
router.post('/modifyService', protect, restrictTo('teacher'), serviceMethods.updateService);

// Update session - teacher only
router.post('/modifySession', protect, restrictTo('teacher'), serviceMethods.updateSession);

// Delete service - teacher only
router.post('/deleteService', protect, restrictTo('teacher'), serviceMethods.deleteService);

// Delete session - teacher only
router.post('/deleteSession', protect, restrictTo('teacher'), serviceMethods.deleteSession);

module.exports = router;