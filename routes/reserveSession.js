const express = require('express');
const router = express.Router();

const {protect} = require('../middleware/authMiddleware');
const {bookSession,getPastSessions,getUpcomingSessions }=require('../Reserve_session/Reserve_session');


router.post('/bookSession',protect,bookSession);
router.post('/getPastSessions',protect,getPastSessions);
router.post('/getUpcomingSessions',protect,getUpcomingSessions);

module.exports = router;