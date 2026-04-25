const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');

const { allTeachers, searchTeachers } = require('../controllers/adminTeacherController');
const { getAllServices, searchServices } = require('../controllers/adminServiceController');
const { getAllStudents, searchStudents } = require('../controllers/adminStudentController');

router.get('/teachers',        allTeachers);
router.post('/teachers/search' ,searchTeachers);

router.get('/services',        getAllServices);
router.post('/services/search' ,searchServices);

router.get('/students',        getAllStudents);
router.post('/students/search' ,searchStudents);

module.exports = router;
