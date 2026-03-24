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

    const id_eleve = req.user.idmembre; 

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
      repondue : false,
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

const getMesDevis = async (req , res) => {
  try{
    const userId = req.user._id;
    const role = req.user.role; 

    let query = {};

    if(role === "student"|| role === "parent"){
      query = {id_eleve : userId};
    }else if(role === "teacher"){
      query = { id_enseignant: userId };
    }

    const devis = await Devis.find(query)
    
    res.status(200).json(
    {
      status: 'success',
      results: devis.length,
      data: devis
    });

  }catch(error){
    res.status(400).json({ status: 'fail', message: error.message });
  };
}

const repondreDevis = async (req, res) => {
  try {
    const { devisId } = req.params; 
    const { statut, messageProf, prixPropose } = req.body;

    if (!['accepte', 'refuse' , 'En_attente'].includes(statut)) {
      return res.status(400).json({ 
        message: "Le statut doit être 'accepte' ou 'refuse' ou modifier ." 
      });
    }

    const devisMisAJour = await Devis.findByIdAndUpdate(
      devisId,
      { 
        statut, 
        messageProf, 
        prixPropose,
        dateReponse: Date.now() ,
        repondue : true
      },
      { new: true, runValidators: true }
    );

    if (!devisMisAJour) {
      return res.status(404).json({ message: "Devis non trouvé." });
    }

    res.status(200).json({
      status: 'success',
      message: `Le devis a été répondu , le statut :  ${statut}.`,
      data: devisMisAJour
    });

  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

module.exports = {
  creerDevis, 
  getMesDevis,
  repondreDevis
};