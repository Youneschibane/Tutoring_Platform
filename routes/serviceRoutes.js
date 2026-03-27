const express = require('express');
const router = express.Router();
const serviceMethods = require('../controllers/serviceController')


router.get('/subjects' , serviceMethods.getProfSubjects);

router.post('/create' , serviceMethods.createService);

router.get('/mesServices' , serviceMethods.getMyservice);

router.post('/addSession' , serviceMethods.addSession);

router.get('/mesSeances' , serviceMethods.getServiceSessions);

module.exports = router;