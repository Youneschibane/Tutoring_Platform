// routes/adminServiceRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, restrictTo }                                              = require('../middleware/authMiddleware');
const { suspendreService, reactiverService, supprimerService, getAllServices } = require('../controllers/adminServiceController');

router.get('/',                         protect, restrictTo('admin'), getAllServices);
router.post('/:id_service/suspendre',   protect, restrictTo('admin'), suspendreService);
router.post('/:id_service/reactiver',   protect, restrictTo('admin'), reactiverService);
router.delete('/:id_service',           protect, restrictTo('admin'), supprimerService);

module.exports = router;