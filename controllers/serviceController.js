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
      date_seance, 
      heure_debut, 
      heure_fin, 
      mode,
      type_seance,
      nombre_max_participants,
      lieu,
      lien_visio,
      notes_enseignant
    } = req.body;

    const tuteur = await prof.findOne({ id_enseignant: id_enseignant });
    const serviceFound = await Service.findOne({ id_service: id_service });

    if (!tuteur || !serviceFound) {
      return res.status(404).json({
        status: "fail",
        message: "L'enseignant ou le service n'existe pas dans la base de données."
      });
    }

    const newSeance = new Session({
      service: serviceFound._id, 
      enseignant: tuteur._id,
      
      date_seance,
      heure_debut,
      heure_fin,
      mode,
      type_seance: type_seance ,
      nombre_max_participants: nombre_max_participants || serviceFound.nombre_max_participants,
      lieu,
      lien_visio,
      notes_enseignant,
      statut: "en_attente"
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
      message: "Erreur lors de la création de la séance",
      error: error.message
    });
  }
};


module.exports = {
  getProfSubjects,
  createService , 
  getMyservice, 
  addSession

}

