const express = require('express');
const router  = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');
const {
  getTeachersWithPendingDiplomes,
  getPendingDiplomesOfTeacher,
  accepterDiplome,
  rejeterMatiere,
  rejeterDiplome
} = require('../controllers/adminDiplomeController');

router.get('/getTeachersWithPendingDiplomes',
  protect, restrictTo('admin'),
  getTeachersWithPendingDiplomes
);

router.get('/getPendingDiplomesOfTeacher/:id_enseignant',
  protect, restrictTo('admin'),
  getPendingDiplomesOfTeacher
);

router.patch('/accept/:id_enseignant/:diplome_id',
  protect, restrictTo('admin'),
  accepterDiplome
);


router.patch('/reject/:id_enseignant/:diplome_id',
  protect, restrictTo('admin'), rejeterMatiere); 



router.patch('/reject-diplome/:id_enseignant/:diplome_id', rejeterDiplome);

module.exports = router;