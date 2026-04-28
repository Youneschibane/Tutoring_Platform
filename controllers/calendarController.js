const mongoose = require('mongoose');
const Session = require('../models/sessionModel'); 
const prof = require('../models/teacherModel');  
const Service = require('../models/serviceModel'); 


const getTeacherCalendar = async (req, res) => {
  try {
    const { id_enseignant, month, year } = req.query;
  /*  const userAuth = req.user; 
    if (!userAuth) {
        return res.status(401).json({ success: false, message: "Authentification requise." });
    }
 
    
    if (userAuth.role !== 'admin' && Number(userAuth.idmembre) !== Number(id_enseignant)) {
      return res.status(403).json({ 
        success: false, 
        message: "Accès refusé : Vous ne pouvez pas consulter cet agenda." 
      });
    }*/

    
    if (!id_enseignant || !month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: "Paramètres manquants : id_enseignant, month et year sont requis." 
      });
    }

    
    const tuteur = await prof.findOne({ id_enseignant: id_enseignant });
    if (!tuteur) {
      return res.status(404).json({ success: false, message: "Enseignant introuvable." });
    }

    
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59); 

    
    const seances = await Session.find({
      enseignant: tuteur._id,
      date_seance: {
        $gte: startDate,
        $lte: endDate
      },
      statut: { $ne: "annulee" } 
    })
    .populate({
      path: 'service',
      select: 'nom_service matiere type_service prix isDeleted',
      match: { isDeleted: false } 
    })
    .sort({ date_seance: 1, heure_debut: 1 });

   
    const calendarData = seances.filter(s => s.service !== null);

    return res.status(200).json({
      success: true,
      count: calendarData.length,
      month: month,
      year: year,
      data: calendarData
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Erreur lors de la génération de l'agenda.",
      error: error.message 
    });
  }
};

module.exports = {
  getTeacherCalendar
};


