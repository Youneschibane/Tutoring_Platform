const express = require('express');
const router = express.Router();
const serviceMethods = require('../controllers/serviceController')
const { protect, restrictTo } = require('../middleware/authMiddleware');
const calendarMethods = require('../controllers/calendarController');


router.get('/subjects'         ,protect , restrictTo('teacher') , serviceMethods.getProfSubjects);
router.post('/create'          ,protect , restrictTo('teacher') ,  serviceMethods.createService);
router.get('/mesServices'      ,protect , restrictTo('teacher') , serviceMethods.getMyservice);
router.post('/addSession'      ,protect , restrictTo('teacher') , serviceMethods.addSession);
router.get('/mesSeances'       ,protect , restrictTo('teacher') , serviceMethods.getServiceSessions);
router.put('/modifyService'    ,protect , restrictTo('teacher') , serviceMethods.updateService);
router.put('/modifySession'    ,protect , restrictTo('teacher') , serviceMethods.updateSession);
router.delete('/deleteService' ,protect , restrictTo('teacher') , serviceMethods.deleteService);
router.delete('/deleteSession' ,protect , restrictTo('teacher') , serviceMethods.deleteSession);
router.get('/agenda', calendarMethods.getTeacherCalendar);


module.exports = router;