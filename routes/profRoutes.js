const {getTeacherDashboard}= require("../controllers/profController");
const express = require('express');
const router = express.Router();
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/statistic'  ,protect, restrictTo('teacher'), getTeacherDashboard);

module.exports = router