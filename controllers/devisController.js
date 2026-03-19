const Devis = require('../models/devisModel');
const getNextId = require('../generateID/nextID');

const creerDevis = async (req, res) => {
  try {
    const { 
      id_enseignant, 
      matiere, 
      niveau_scolaire, 
      objectif, 
      frequence_souhaite, 
      duree_estimee, 
      budget_estime 
    } = req.body;

    // Récupérer l'ID de l'élève depuis le token (authentification)
    const id_eleve = req.user.idmembre; 

    // générer un ID unique pour le devis
    const id_devis = await getNextId('devis');

    //Créer l'objet Devis
    const nouveauDevis = new Devis({
      id_devis,
      id_eleve,
      id_enseignant,
      matiere,
      niveau_scolaire,
      objectif,
      frequence_souhaite,
      duree_estimee,
      budget_estime,
      statut: "En_attente",
      reponse_enseignant: "Pas encore de réponse"
    });

    await nouveauDevis.save();

    res.status(201).json({
      status: 'success',
      message: 'Demande de devis envoyée avec succès à l\'enseignant.',
      data: nouveauDevis
    });

  } catch (error) {
    console.error("Erreur création devis:", error);
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};


module.exports = {
  creerDevis
};