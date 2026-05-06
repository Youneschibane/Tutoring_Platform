const express = require('express');
const router = express.Router();
const {getTotalUsersCount,  getTotalTeachersCount,getTotalServicesCount, getSessionChart} = require('../controllers/adminHomepageController');   

router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalTeachers,
      totalServices,
      monthlySessions
    ] = await Promise.all([
      getTotalUsersCount(),
      getTotalTeachersCount(),
      getTotalServicesCount(),
      getSessionChart()
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalTeachers,
        totalServices,
        monthlySessions   
      }
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;