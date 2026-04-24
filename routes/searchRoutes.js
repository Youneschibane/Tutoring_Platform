const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const {searchServices}= require('../Search_Services/searchServices');
const { searchBar } = require('../controllers/searchBarController');
// Protected route - requires authentication
router.post('/services', protect, searchServices);
// routes/searchRoutes.js — ajouter


router.get('/searchBar', searchBar); // GET /api/search/searchBar?q=ahmed&page=1&limit=20

module.exports = router;