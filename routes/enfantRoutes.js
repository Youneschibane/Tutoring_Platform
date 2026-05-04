// routes/enfantRoutes.js
const express = require('express');
const router  = express.Router();

const { protect, restrictTo }  = require('../middleware/authMiddleware');
const { ajouterEnfant, modifierEnfant, supprimerEnfant, getMesEnfants } = require('../Sign_In_Up/enfant_du_parent');

// Parent uniquement
router.get('/',              protect, restrictTo('parent'), getMesEnfants);
router.post('/',             protect, restrictTo('parent'), ajouterEnfant);
router.patch('/:id_eleve',   protect, restrictTo('parent'), modifierEnfant);
router.delete('/:id_eleve',  protect, restrictTo('parent'), supprimerEnfant);

module.exports = router;