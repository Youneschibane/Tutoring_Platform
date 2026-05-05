// routes/adminServiceRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, restrictTo }                                              = require('../middleware/authMiddleware');
const { suspendreService, reactiverService, supprimerService, getAllServices } = require('../controllers/adminServiceController');

router.get('/',                          getAllServices);
router.post('/:id_service/suspendre',    suspendreService);
router.post('/:id_service/reactiver',    reactiverService);
router.delete('/:id_service',            supprimerService);

module.exports = router;