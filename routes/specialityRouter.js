const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialtyController');

router.get('/subjects', specialtyController.getSubjectsByCycle);

module.exports = router;