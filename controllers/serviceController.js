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
      isDeleted : false,
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
  const services = await Service.find({ id_enseignant: id_enseignant , isDeleted : false}).sort({ date_creation: -1 });

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


const updateSession = async (req, res) => {
  try {
    const { id_seance } = req.query;
    const { id_enseignant_auth, ...updates } = req.body;

    const seance = await Session.findById(id_seance);
    if (!seance) return res.status(404).json({ status: "fail", message: "Séance introuvable." });

    // on doit vérifier si la séance est trop proche (Moins de 2h)

    const debutSeance = new Date(`${seance.date_seance}T${seance.heure_debut}:00`);
    const now = new Date();
    
    const differenceMS = debutSeance - now;
    const deuxHeuresEnMS = 2 * 60 * 60 * 1000;

    if (differenceMS < deuxHeuresEnMS && differenceMS > 0 && seance.mode === "presentiel") {
      return res.status(400).json({
        status: "fail",
        message: "Modification impossible : la séance commence dans moins de 2 heures et elle présentiel ou dans le passé"
      });
    }

if (differenceMS < 0) {
  return res.status(400).json({
    status: "fail",
    message: "Action impossible : Cette séance est déjà terminée ou en cours."
  });
}

if (String(seance.enseignant) !== String(id_enseignant_auth)) {
    return res.status(403).json({ status: "fail", message: "Accès refusé." });
}
    if (updates.date_seance || updates.heure_debut || updates.heure_fin) {
      const d = updates.date_seance || seance.date_seance;
      const h_debut = updates.heure_debut || seance.heure_debut;
      const h_fin = updates.heure_fin || seance.heure_fin;

      const conflit = await Session.findOne({
        _id: { $ne: seance._id },
        enseignant: id_enseignant_auth,
        date_seance: d,
        $or: [{ heure_debut: { $lt: h_fin }, heure_fin: { $gt: h_debut } }]
      });

      if (conflit) {
        return res.status(400).json({
          status: "fail",
          message: `Conflit d'horaire avec la séance "${conflit.titre}".`
        });
      }
    }

    Object.keys(updates).forEach(key => seance[key] = updates[key]);
    await seance.save();

    res.status(200).json({ status: "success", data: seance });

  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const deleteService = async (req , res)=> {
try {
    const { id_service } = req.query;
    const { id_enseignant_auth } = req.body;

    const service = await Service.findOne({ id_service });
    if (!service) return res.status(404).json({ status: "fail", message: "Service introuvable." });

    if (service.id_enseignant !== id_enseignant_auth) {
      return res.status(403).json({ status: "fail", message: "Accès refusé." });
    }

    const seances = await Session.find({ service: service._id });

    // Vérifier s'il y a des séances "Engagées" (Confirmées ou Reportées)
    const aDesEngagements = seances.some(s => 
      s.statut === "confirmee" || s.statut === "reportee"
    );

    if (aDesEngagements) {
      return res.status(400).json({
        status: "fail",
        message: "Suppression impossible : vous avez des séances confirmées ou reportées. Gérez-les d'abord."
      });
    }

    // si le service est "Vierge" 
    const estVierge = seances.every(s => s.etudiants.length === 0);

    if (estVierge) {
      // Suppression Physique
      await Session.deleteMany({ service: service._id });
      await Service.deleteOne({ _id: service._id });

      return res.status(200).json({
        status: "success",
        message: "Service vierge et ses créneaux supprimés définitivement."
      });
    } else {
      service.actif = false;
      service.isDeleted = true;
      await service.save();

      // si il ya des sceance libre on vas les annulées 
      await Session.updateMany(
        { service: service._id, statut: "libre" },
        { $set: { statut: "annulée", motif_annulation: "Service supprimé par le professeur" } }
      );

      return res.status(200).json({
        status: "success",
        message: "Service archivé avec succès."
      });
    }

  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
}



module.exports = {
  getProfSubjects,
  createService , 
  getMyservice, 
  addSession,
  getServiceSessions,
  updateService,
  updateSession, 
  deleteService
}

