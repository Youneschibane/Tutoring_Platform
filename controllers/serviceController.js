const Service = require('../models/serviceModel');
const prof = require('../models/teacherModel');
const Session = require('../models/sessionModel');

const getProfSubjects = async (req, res) => {
  const { id } = req.query;

  try {
    const teacher = await prof.findOne({ id_enseignant: id });

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Enseignant non trouvé" });
    }

    const getAllowedCycles = (mainCycle) => {
      const hierarchy = {
        "Secondaire": ["Secondaire", "Moyen", "Primaire"],
        "Moyen": ["Moyen", "Primaire"],
        "Primaire": ["Primaire"],
        "ESI": ["ESI"]
      };
      return hierarchy[mainCycle] || [mainCycle];
    };

    const subjectsWithPermissions = teacher.subjects.map(subj => {
      const mainCycle = subj.cycle; 
      
      return {
        name: subj.name || subj.type, 
        originalCycle: mainCycle,
        canTeachIn: getAllowedCycles(mainCycle) 
      };
    });

    return res.status(200).json({
      success: true,
      teacherId: teacher.id_enseignant,
      subjectsPermissions: subjectsWithPermissions
    });

  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

const createService = async (req, res) => {
  try {
    const { id_enseignant } = req.body;

    const profFound = await prof.findOne({ id_enseignant: id_enseignant });
    // if le prof existe
    if (!profFound) {
      return res.status(404).json({ 
        status: "fail", 
        message: `L'enseignant avec l'ID ${id_enseignant} n'existe pas dans la base.` 
      });
    }

    const lastService = await Service.findOne().sort({ id_service: -1 });
    const nextId = lastService ? lastService.id_service + 1 : 1;

    const newService = new Service({
      id_service: nextId,
      ...req.body
    });

    await newService.save();

    res.status(201).json({
      status: 'success',
      data: newService
    });

  } catch (error) {
    res.status(400).json({ 
      status: 'fail', 
      message: error.message 
    });
  }
};

const getMyservice = async (req , res) => 
  {

  try{
  const {id_enseignant} = req.query;


  //if le id du prof n est pas valide 
  if (!id_enseignant) {
    return res.status(400).json({
      success: false,
      message: "L'identifiant du prof  est requis."
    });
  }
  // geting the services 
  const services = await Service.find({ id_enseignant: id_enseignant }).sort({ date_creation: -1 });

  if (!services || services.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Cet enseignant ne propose aucun service."
    });
  }

    return res.status(200).json({
      success: true,
      count: services.length,
      data: services
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Erreur lors de la récupération des services",
      error: error.message
    });
  }
}

const addSession = async (req, res) => {
  try {
    const { 
      id_enseignant, 
      id_service, 
      titre, 
      date_seance, 
      heure_debut, 
      heure_fin, 
      mode,
      type_seance,
      nombre_max_participants,
      lieu,
      lien_visio,
      notes_enseignant,
      prix
    } = req.body;

    if (mode === "presentiel" && !lieu) {
      return res.status(400).json({
        status: "fail",
        message: "Pour une séance en présentiel, le lieu est obligatoire."
      });
    }

    if (mode === "en_ligne" && !lien_visio) {
      return res.status(400).json({
        status: "fail",
        message: "Pour une séance en ligne, le lien de visio est obligatoire."
      });
    }

    const tuteur = await prof.findOne({ id_enseignant: id_enseignant });
    const serviceFound = await Service.findOne({ id_service: id_service });

    if (!tuteur || !serviceFound) {
      return res.status(404).json({
        status: "fail",
        message: "L'enseignant ou le service n'existe pas."
      });
    }
    // on doit tester si le service est lancé par ce prof 
    if (serviceFound.id_enseignant !== id_enseignant) {
      return res.status(403).json({
        status: "fail",
        message: "Action interdite : Ce service n'appartient pas à cet enseignant."
      });
    }

    // verifie si la date est dans le future 
    if (new Date(date_seance) < new Date().setHours(0,0,0,0)) {
    return res.status(400).json({
      status: "fail",
      message: "On ne peut pas créer une séance dans le passé."
    });
    }

  if (heure_fin <= heure_debut) {
  return res.status(400).json({
    status: "fail",
    message: "L'heure de fin doit être après l'heure de début."
  });
  }

  // test crucial : si il ya deja une par le mm prof (n impotre quel service) seance on peut pas le crer 

  const conflit = await Session.findOne({
      enseignant: tuteur._id,
      date_seance: date_seance,
      $or: [
        { heure_debut: { $lt: heure_fin }, heure_fin: { $gt: heure_debut } }
      ]
    });

    if (conflit) {
      return res.status(400).json({
        status: "fail",
        message: `Conflit d'horaire ! Vous avez déjà la séance "${conflit.titre}" de ${conflit.heure_debut} à ${conflit.heure_fin}.`
      });
    }

    const newSeance = new Session({
      titre, 
      service: serviceFound._id, 
      enseignant: tuteur._id,
      date_seance,
      heure_debut,
      heure_fin,
      mode,
      type_seance,
      nombre_max_participants: nombre_max_participants || serviceFound.nombre_max_participants,
      lieu: mode === "presentiel" ? lieu : undefined,
      lien_visio: mode === "en_ligne" ? lien_visio : undefined,
      notes_enseignant,
      statut: "libre",
      prix
    });

    await newSeance.save();

    res.status(201).json({
      status: "success",
      message: "Séance ajoutée avec succès",
      data: newSeance
    });

  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: "Erreur lors de la création",
      error: error.message
    });
  }
};


const getServiceSessions = async (req, res) => {
  try {
    const { id_service } = req.query;

    if (!id_service) {
      return res.status(400).json({ status: "fail", message: "ID service requis." });
    }

    const sessions = await Session.find({ service: id_service }) 
      .sort({ date_seance: 1, heure_debut: 1 });

    if (!sessions || sessions.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "Aucun créneau trouvé pour ce service."
      });
    }

    res.status(200).json({
      status: "success",
      results: sessions.length,
      data: sessions
    });

  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};

const updateService = async (req, res) => {
  try {
    const { id_service } = req.query;
    const { id_enseignant_auth, ...updates } = req.body;
 
    
    const service = await Service.findOne({ id_service });

        if (!service) {
      return res.status(404).json({ status: "fail", message: "Service introuvable!" });
    }

    if (Number(service.id_enseignant) !== Number(id_enseignant_auth)) {
      return res.status(403).json({ 
        status: "fail", 
        message: "Sécurité : Tentative de modification d'un service tiers détectée!" 
      });
    }

        if (service.actif === false) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Un service archivé ne peut plus être modifié!" 
      });
    }



    const forbiddenFields = ['id_service', 'id_enseignant', '_id', 'date_creation'];
    forbiddenFields.forEach(field => delete updates[field]);


    if (updates.prix !== undefined && updates.prix < 0) {
      return res.status(400).json({ status: "fail", message: "Le prix ne peut pas être négatif." });
    }

    Object.assign(service, updates);

    await service.save();

    res.status(200).json({
      status: "success",
      message: "Service mis à jour avec succès et contrôles de sécurité validés.",
      data: service
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Erreur interne lors de la mise à jour",
      error: error.message
    });
  }
};


module.exports = {
  getProfSubjects,
  createService , 
  getMyservice, 
  addSession,
  getServiceSessions,
  updateService
}

