const Service = require('../models/serviceModel');
const prof = require('../models/teacherModel');
const Session = require('../models/sessionModel');
const Education = require('../models/educationModel');


const getAllowedCycles = (mainCycle) => {
  const hierarchy = {
    "Lycee": ["Lycee", "College", "Primaire"],
    "College": ["College", "Primaire"],
    "Primaire": ["Primaire"],
    "ESI": ["ESI"]
  };
  return hierarchy[mainCycle] || [mainCycle];
};

const isMatiereValidForCycle = async (cycle, matiere) => {
  const record = await Education.findOne({
    cycle: cycle,
    subjects: matiere   // si matiere est dans le tableau subjects
  });
  return record !== null;
};

const getProfSubjects = async (req, res) => {
  try {
    const id = req.user.idmembre; 
    const teacher = await prof.findOne({ id_enseignant: id });

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Enseignant non trouvé" });
    }

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
    const id_enseignant = req.user.idmembre;
    const { matiere, niveau_concerne, ...rest } = req.body;

    const profFound = await prof.findOne({ id_enseignant: id_enseignant });
    // if le prof existe
    if (!profFound) {
      return res.status(404).json({ 
        status: "fail", 
        message: `L'enseignant avec l'ID ${id_enseignant} n'existe pas dans la base.` 
      });
    }
        if (!matiere || !niveau_concerne) {
      return res.status(400).json({
        status: "fail",
        message: "Les champs 'matiere' et 'niveau_concerne' sont obligatoires."
      });
    }


    const matiereReconnue = await isMatiereValidForCycle(niveau_concerne, matiere);
    if (!matiereReconnue) {
      return res.status(400).json({
        status: "fail",
        message: `La matière "${matiere}" n'est pas enseignée dans le cycle "${niveau_concerne}" selon le programme officiel.`
      });
    }


    const estQualifie = profFound.subjects.some(
      sub => sub.name === req.body.matiere && getAllowedCycles(sub.cycle).includes(req.body.niveau_concerne)
    );
    if (!estQualifie) return res.status(403).json({ message: "Non qualifié pour cette matière/niveau." });
    //check if les champs obligatoiree sont entrées
    const lastService = await Service.findOne().sort({ id_service: -1 });
    const nextId = lastService ? lastService.id_service + 1 : 1;

    const newService = new Service({
      id_service: nextId,
      id_enseignant: id_enseignant,
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
  const id_enseignant = req.user.idmembre;

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

const addSession = async (req, res ) => {
  try {
    const id_enseignant = req.user.idmembre;
    const { 
      id_service, 
      titre, 
      date_seance, 
      heure_debut, 
      heure_fin, 
      mode,
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
    const serviceFound = await Service.findOne({ id_service: id_service  , isDeleted : false });
    if (!tuteur || !serviceFound) {
      return res.status(404).json({
        status: "fail",
        message: "L'enseignant ou le service n'existe pas."
      });
    }

    if(serviceFound.actif === false){
            return res.status(404).json({
        status: "fail",
        message: "le service n'est pas actif."
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

    if (prix !== undefined && prix < 0)
  return res.status(400).json({ message: "Le prix ne peut pas être négatif." });

  if (nombre_max_participants !== undefined && nombre_max_participants < 1)
    return res.status(400).json({ message: "Au moins 1 participant requis." });

    const newSeance = new Session({
      titre, 
      service: serviceFound._id, 
      enseignant: tuteur._id,
      date_seance,
      heure_debut,
      heure_fin,
      mode,
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
    const serviceFound = await Service.findOne({ id_service });

    if(!serviceFound){
        return res.status(404).json({
        status: "fail",
        message: "Service non trouvé."
      });


    }

    const sessions = await Session.find({ service: serviceFound._id }) 
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
    const id_enseignant_auth = req.user.idmembre;
    const { id_service } = req.query;
    const { ...updates } = req.body; 
    
    const service = await Service.findOne({ id_service  , isDeleted : false});

        if (!service) {
      return res.status(404).json({ status: "fail", message: "Service introuvable!" });
    }
    if (service.id_enseignant !== id_enseignant_auth) {
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


    const matiereCible = updates.matiere || service.matiere;
    const cycleCible = updates.niveau_concerne || service.niveau_concerne;

    const matiereReconnue = await isMatiereValidForCycle(cycleCible, matiereCible);
    if (!matiereReconnue) {
      return res.status(400).json({
        status: "fail",
        message: `La matière "${matiereCible}" n'est pas enseignée dans le cycle "${cycleCible}" selon le programme officiel.`
      });
    }
    const tuteur = await prof.findOne({ id_enseignant: id_enseignant_auth });
      
      if (!tuteur || !tuteur.subjects) {
        return res.status(404).json({ status: "fail", message: "Profil enseignant introuvable." });
      }

      const estQualifie = tuteur.subjects.some(sub => 
        sub.name === matiereCible && getAllowedCycles(sub.cycle).includes(cycleCible)
      );

      if (!estQualifie) {
        return res.status(400).json({
          status: "fail",
          message: `Incohérence : Vous n'êtes pas autorisé à enseigner ${matiereCible} au niveau ${cycleCible}.`
        });
      }
    ;

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
    const { ...updates } = req.body;
    const id_enseignant_auth = req.user.idmembre; 

    const profDoc = await prof.findOne({ id_enseignant: id_enseignant_auth });
        const seance = await Session.findById(id_seance);
    if (!seance) return res.status(404).json({ status: "fail", message: "Séance introuvable." });


    if (!profDoc || String(seance.enseignant) !== String(profDoc._id)) {
        return res.status(403).json({ status: "fail", message: "Accès refusé." });
    }

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

    if (updates.date_seance || updates.heure_debut || updates.heure_fin) {
      const d = updates.date_seance || seance.date_seance;
      const h_debut = updates.heure_debut || seance.heure_debut;
      const h_fin = updates.heure_fin || seance.heure_fin;
      const conflit = await Session.findOne({ 
      _id: { $ne: seance._id }, 
      enseignant: profDoc._id, 
      date_seance: d, 
      $or: [
        { heure_debut: { $lt: h_fin }, heure_fin: { $gt: h_debut } }
      ] 
    });

    if (conflit) {
      return res.status(400).json({ 
        status: "fail", 
        message: `Conflit d'horaire avec la séance "${conflit.titre}".` 
      });
    }
    }
    Object.assign(seance, updates);
    await seance.save();

    res.status(200).json({ status: "success", data: seance });

  } catch (error) {
    res.status(400).json({ status: "fail", message: error.message });
  }
};

const deleteService = async (req , res)=> {
try {
    const { id_service } = req.query;
    const id_enseignant_auth = req.user.idmembre;

    const service = await Service.findOne({ id_service , isDeleted : false });
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

const deleteSession = async (req, res) => {
  try {
    const { id_seance } = req.query;
    const { motif_annulation } = req.body;
    const id_enseignant_auth = req.user.idmembre; 

    const profDoc = await prof.findOne({ id_enseignant: id_enseignant_auth });
    const seance = await Session.findById(id_seance);
    if (!seance) return res.status(404).json({ status: "fail", message: "Séance introuvable." });


    if (!profDoc || String(seance.enseignant) !== String(profDoc._id)) {
        return res.status(403).json({ status: "fail", message: "Accès refusé." });
    }

    const debutSeance = new Date(`${seance.date_seance}T${seance.heure_debut}:00`);
    const maintenant = new Date();
    const differenceMS = debutSeance - maintenant;
    const deuxHeuresEnMS = 2 * 60 * 60 * 1000;

    if (differenceMS < 0) {
      return res.status(400).json({ status: "fail", message: "Impossible de supprimer une séance passée." });
    }

    if (seance.mode === "presentiel" && differenceMS < deuxHeuresEnMS) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Séance en présentiel verrouillée (moins de 2h avant le début)." 
      });
    }

    const estVierge = seance.etudiants.length === 0;

    if (estVierge) {
      await Session.findByIdAndDelete(id_seance);
      return res.status(200).json({
        status: "success",
        message: "Séance vierge supprimée définitivement."
      });
    } else {
      seance.statut = "annulée";
      seance.motif_annulation = motif_annulation || "Annulée par le professeur";
      await seance.save();

      return res.status(200).json({
        status: "success",
        message: "Séance annulée avec succès (les étudiants ont été conservés pour l'historique)."
      });
    }

  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
};


module.exports = {
  getProfSubjects,
  createService , 
  getMyservice, 
  addSession,
  getServiceSessions,
  updateService,
  updateSession, 
  deleteService,
  deleteSession,
}

