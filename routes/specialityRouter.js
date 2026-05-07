const express = require('express');
const router = express.Router();
const specialtyController = require('../controllers/specialtyController');

router.get('/subjects', specialtyController.getSubjectsByCycle);

router.get('/levels' , specialtyController.getEsiYears);

router.get('/list' , specialtyController.getEsiSpeciality); 

router.get('/nature' , specialtyController.getSubjectByNature);

router.get('/annee' , specialtyController.getYears);

router.get('/prof', specialtyController.getSubjectsProf);





module.exports = router;