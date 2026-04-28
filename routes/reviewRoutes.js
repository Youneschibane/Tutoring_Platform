const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');

// Route pour POSTER une évaluation (Tâche 1)
router.post('/evaluations', reviewController.createReview);

// Route pour LIRE les évaluations d'un professeur (Tâche 2)
//router.get('/enseignants/:id_enseignant/evaluations', reviewController.getTeacherReviews);
router.get('/enseignants/:id_enseignant/evaluations', (req, res, next) => {
  console.log('Route atteinte !', req.params);
  next();
}, reviewController.getTeacherReviews);

module.exports = router;