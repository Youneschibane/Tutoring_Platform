const express = require('express');
const router = express.Router();
const devisController = require('../controllers/devisController');
const protect = require('../middleware/authMiddleware');
router.post('/demander', protect, devisController.creerDevis);

module.exports = router;