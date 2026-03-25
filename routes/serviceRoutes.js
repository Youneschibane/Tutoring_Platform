const express = require('express');
const router = express.Router();
const serviceMethods = require('../controllers/serviceController')

router.get('/subjects' , serviceMethods.getProfSubjects);


module.exports = router;