const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { allTeachers, searchTeachers , getTeacherDetails } = require('../controllers/adminTeacherController');
const { getAllServices, searchServices , getAllSubjects } = require('../controllers/adminServiceController');
const { addSubject, removeSubject, getAllLevels , getOptions,getSubjects,getCycles } = require('../controllers/adminEducationController');
const { getAllStudents, searchStudents, getAnneesByCycle } = require('../controllers/adminStudentController');
const { getAllRules, addRule, deleteRule } = require('../controllers/adminRuleController');
const adminCtrl = require('../controllers/adminController');

router.get('/students/annees/:cycle',  getAnneesByCycle); 
router.get('/students',                getAllStudents);
router.post('/students/search',        searchStudents);


router.get('/teachers',        allTeachers);
router.post('/teachers/search' ,searchTeachers);
router.get('/teachers/:id', getTeacherDetails);

router.get('/services',        getAllServices);
router.post('/services/search' ,searchServices);
router.get('/services/all-subjects', getAllSubjects);

router.get('/education',                      getAllLevels);
router.patch('/education/add-subject',    addSubject);
router.patch('/education/remove-subject', removeSubject);
router.get('/education/options',  getOptions);
router.get('/education/subjects', getSubjects);
router.get('/education/cycles',   getCycles);


router.get   ('/rules',      getAllRules);
router.post  ('/rules',      addRule);
router.delete('/rules/:id',  deleteRule);


router.get   ('/reports',                 adminCtrl.getReports);
router.get   ('/reports/:id',             adminCtrl.getReportById);
router.patch ('/reports/:id/status',      adminCtrl.updateReportStatus);
router.put   ('/ban',                     adminCtrl.banUser);
router.patch ('/moderate/:id_evaluation', adminCtrl.moderateEvaluation);
router.get   ('/inbox',                   adminCtrl.getAdminMailbox);
router.delete('/reports/:id', adminCtrl.deleteReport);



module.exports = router;
