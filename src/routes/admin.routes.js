/*const express = require('express');
const router = express.Router();
const adminCtrl = require('../controllers/admin.controller');
//const authAdmin = require('../middlewares/authAdmin');
// const auth = require('../middlewares/auth'); // Importe ton middleware JWT global ici

// Applique authAdmin (et ton auth JWT) sur toutes les routes ci-dessous
router.put('/ban', authAdmin, adminCtrl.banUser);
router.patch('/moderate/:id_evaluation', authAdmin, adminCtrl.moderateEvaluation);
router.get('/inbox', authAdmin, adminCtrl.getAdminMailbox);
router.get('/reports', adminCtrl.getReports);
router.get('/reports/:id', adminCtrl.getReportById);
router.patch('/reports/:id/status', adminCtrl.updateReportStatus);

module.exports = router;*/
const express   = require('express');
const router    = express.Router();
const adminCtrl = require('../controllers/admin.controller');

router.get   ('/reports',                 adminCtrl.getReports);
router.get   ('/reports/:id',             adminCtrl.getReportById);
router.patch ('/reports/:id/status',      adminCtrl.updateReportStatus);
router.put   ('/ban',                     adminCtrl.banUser);
router.patch ('/moderate/:id_evaluation', adminCtrl.moderateEvaluation);
router.get   ('/inbox',                   adminCtrl.getAdminMailbox);
router.delete('/reports/:id', adminCtrl.deleteReport);

module.exports = router;
