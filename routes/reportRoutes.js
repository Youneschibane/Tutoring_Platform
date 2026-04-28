const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Route pour POSTER un signalement (Tâche 3)
router.post('/users/:id_user/report', reportController.reportProfile);

module.exports = router;