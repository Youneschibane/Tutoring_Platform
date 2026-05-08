const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { allTeachers, searchTeachers, getTeacherDetails } = require('../controllers/adminTeacherController');
const { addSubject, removeSubject, getAllLevels, getOptions, getSubjects, getCycles } = require('../controllers/adminEducationController');
const { getAllStudents, searchStudents, getAnneesByCycle } = require('../controllers/adminStudentController');
const { getAllRules, addRule, deleteRule } = require('../controllers/adminRuleController');
const adminCtrl = require('../controllers/adminController');
const { getAllParents, searchParents } = require('../controllers/adminParentController');
const {getTotalUsersCount,  getTotalTeachersCount,getTotalServicesCount, getSessionChart} = require('../controllers/adminHomepageController');   

// router.use(protect, restrictTo('admin'));

router.get ('/students/annees/:cycle', getAnneesByCycle);
router.get ('/students',               getAllStudents);
router.post('/students/search',        searchStudents);

router.get ('/teachers',         allTeachers);
router.post('/teachers/search',  searchTeachers);
router.get ('/teachers/:id',     getTeacherDetails);

router.get  ('/education',                getAllLevels);
router.patch('/education/add-subject',    addSubject);
router.patch('/education/remove-subject', removeSubject);
router.get  ('/education/options',        getOptions);
router.get  ('/education/subjects',       getSubjects);
router.get  ('/education/cycles',         getCycles);

router.get   ('/rules',      getAllRules);
router.post  ('/rules',      addRule);
router.delete('/rules/:id',  deleteRule);

router.get   ('/reports',                 adminCtrl.getReports);
router.get   ('/reports/:id',             adminCtrl.getReportById);
router.patch ('/reports/:id/status',      adminCtrl.updateReportStatus);
router.delete('/reports/:id',             adminCtrl.deleteReport);

router.put  ('/ban',                     adminCtrl.banUser);
router.patch('/moderate/:id_evaluation', adminCtrl.moderateEvaluation);
router.get  ('/inbox',                   adminCtrl.getAdminMailbox);

router.get ('/parents',        getAllParents);
router.post('/parents/search', searchParents);

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalTeachers,
      totalServices,
      monthlySessions
    ] = await Promise.all([
      getTotalUsersCount(),
      getTotalTeachersCount(),
      getTotalServicesCount(),
      getSessionChart()
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalTeachers,
        totalServices,
        monthlySessions   
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

router.get(
    '/search-suggest', 
    protect, 
    restrictTo('admin'), 
    adminCtrl.getSearchSuggest
);


module.exports = router;
