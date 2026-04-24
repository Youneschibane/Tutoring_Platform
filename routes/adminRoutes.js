const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { getAllTeachers, searchTeachers } = require('../controllers/adminController');

router.get('/teachers', allTeachers);

router.post('/teachers/search', searchTeachers);

module.exports = router;