const Devis = require('../models/devisModel');
const getNextId = require('../generateID/nextID');
const Education = require('../models/educationModel');
const Teacher = require('../models/teacherModel');
const mongoose = require('mongoose');

const creerDevis = async (req, res) => {
  try {
    const { 
      id_enseignant, 
      matiere, 
      niveau_scolaire, 
      annee_scolaire, 
      objectif, 
      frequence_souhaite, 
      duree_estimee, 
      budget_estime 
    } = req.body;

    const id_eleve = req.user.idmembre; 

    // On cherche si un devis identique est déjà "En_attente"
    const devisExistant = await Devis.findOne({
      id_eleve,
      id_enseignant,
      matiere,
      statut: "En_attente",
      luprof: false, 
      luEtud: true
    });

    if (devisExistant) {
      return res.status(409).json({
        status: 'fail',
        message: "Vous avez déjà une demande de devis en attente pour cette matière avec cet enseignant. Veuillez attendre sa réponse."
      });
    }

    const enseignant = await Teacher.findOne({ id_enseignant: id_enseignant });
    if (!enseignant) {
      return res.status(404).json({
        status: 'fail',
        message: "L'enseignant spécifié n'existe pas."
      });
    }

    const estQualifie = enseignant.subjects.some(sub => sub.name === matiere);
    if (!estQualifie) {
      return res.status(400).json({
        status: 'fail',
        message: `L'enseignant ${enseignant.firstname} ne propose pas de cours de ${matiere}.`
      });
    }

    // --- 4. CONTRÔLE RÉFÉRENTIEL ÉDUCATION ---
    const educationRef = await Education.findOne({
      cycle: niveau_scolaire,
      levelName: annee_scolaire 
    });

    if (!educationRef) {
      return res.status(400).json({
        status: 'fail',
        message: "Niveau ou année scolaire invalide selon le programme officiel."
      });
    }

    // --- CRÉATION DU DEVIS ---
    const id_devis = await getNextId('devis');

    const nouveauDevis = new Devis({
      id_devis,
      id_eleve,
      id_enseignant,
      matiere,
      niveau_scolaire,
      annee_scolaire,
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
      message: 'Demande de devis envoyée avec succès.',
      data: nouveauDevis
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const getMesDevis = async (req , res) => {
  try{
    const userId = req.user.idmembre;
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
    const { statut, messageProf, prixPropose, frequence_proposee, duree_proposee } = req.body;
    const id_prof_connecte = req.user.idmembre;
    const devisId = parseInt(req.params.id);
    const devis = await Devis.findOne({ id_devis: devisId });

    if (!devis) {
      return res.status(404).json({ message: "Devis non trouvé." });
    }

    if (devis.id_enseignant !== id_prof_connecte) {
      return res.status(403).json({ message: "Interdit : Ce n'est pas votre devis." });
    }

    devis.luprof = true;  // Le prof vient de le traiter
    devis.luEtud = false;

    if (statut === 'accepte' || statut === 'refuse') {
      devis.statut = statut;
      devis.repondue = true;
    } else if (statut === 'En_attente') {
      // Le prof propose autre chose
      // On met à jour les champs si fournis, sinon on garde les anciens
      if (prixPropose) devis.budget_estime = prixPropose;
      if (frequence_proposee) devis.frequence_souhaite = frequence_proposee;
      if (duree_proposee) devis.duree_estimee = duree_proposee;
      devis.repondue = true; 
      devis.message_negociation = "L'enseignant a proposé de nouvelles conditions.";
    } else {
      return res.status(400).json({ message: "Statut invalide. Utilisez 'accepte', 'refuse' ou 'En_attente'." });
    }

    // Champs communs
    devis.reponse_enseignant = messageProf;
    devis.dateReponse = Date.now();

    await devis.save();

    res.status(200).json({
      status: 'success',
      message: statut === 'En_attente' ? "Contre-proposition envoyée à l'élève." : `Devis ${statut}.`,
      data: devis
    });

  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

const reponseFinaleEtudiant = async (req, res) => {
  try {
    const { action } = req.body; 
    const devisId = parseInt(req.params.id);
    const devis = await Devis.findOne({ id_devis: devisId });

    if (!devis) return res.status(404).json({ message: "Devis non trouvé." });

    if (devis.statut !== "En_attente") {
      return res.status(400).json({ message: "Le statut final a déjà été décidé par le professeur." });
    }

    devis.statut = action === 'Accepte' ? 'Accepte' : 'Refuse';
    devis.date_reponse_Etudiant = Date.now();
    
    devis.luEtud = true;
    devis.luprof = false; 

    await devis.save();
    res.status(200).json({ status: 'success', message: "Décision finale enregistrée.", data: devis });
  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};

module.exports = {
  creerDevis, 
  getMesDevis,
  repondreDevis,
  reponseFinaleEtudiant
};