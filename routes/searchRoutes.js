const express = require('express');
const router = express.Router();

const protect = require('../middleware/authMiddleware');
const {searchServices}= require('../Search_Services/searchServices');


router.post('/services' ,searchServices);

module.exports = router;