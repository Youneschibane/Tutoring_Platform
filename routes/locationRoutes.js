const express = require('express');
const router = express.Router();

const location = require('../controllers/locationController');

router.get('/willaya' , location.getWillaya );

router.get('/commune'  , location.getCommuneByWillaya);

module.exports = router;