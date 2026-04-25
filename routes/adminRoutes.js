const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { allTeachers, searchTeachers , getTeacherDetails } = require('../controllers/adminTeacherController');
const { getAllServices, searchServices } = require('../controllers/adminServiceController');
const { getAllStudents, searchStudents  } = require('../controllers/adminStudentController');


const { addSubject, removeSubject, getAllLevels , getOptions,getSubjects,getCycles } = require('../controllers/adminEducationController');

router.get('/teachers',        allTeachers);
router.post('/teachers/search' ,searchTeachers);
router.get('/teachers/:id', getTeacherDetails);

router.get('/services',        getAllServices);
router.post('/services/search' ,searchServices);

router.get('/students',        getAllStudents);
router.post('/students/search' ,searchStudents);



router.get('/education',                      getAllLevels);
router.patch('/education/add-subject',    addSubject);
router.patch('/education/remove-subject', removeSubject);
router.get('/education/options',  getOptions);
router.get('/education/subjects', getSubjects);
router.get('/education/cycles',   getCycles);


module.exports = router;
