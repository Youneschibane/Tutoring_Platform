const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const {searchServices}= require('../Search_Services/searchServices');

const { searchBarPro } = require('../controllers/searchBarPro');
const{searchTeacherPro}=require('../controllers/searchTeacherPro');
const { getServiceByNumericId } = require('../controllers/getServiceInfo');
// Protected route - requires authentication
router.post('/services', protect, searchServices);
router.get('/service/:id_service', getServiceByNumericId);
// routes/searchRoutes.js — ajouter



router.post('/searchBarPro', searchBarPro); // GET /api/search/searchBarPro?q=ahmed&page=1&limit=20
router.post('/searchTeachers', searchTeacherPro); // GET /api/search/searchTeachers?q=ahmed&page=1&limit=20

module.exports = router;