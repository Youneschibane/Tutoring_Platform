const Service = require('../models/serviceModel');
const prof = require('../models/teacherModel');
const Session = require('../models/sessionModel');
const Education = require('../models/educationModel');
const mongoose = require('mongoose');
const Device = require('../models/deviceModel');
const sendExpoPush = require('../utils/sendExpoPush');
const multer = require('multer');
const storage = require('../Config/uploadMiddleware');
const upload = multer({ storage: storage });
const Seance   = require('../models/sessionModel');
const Teacher  = require('../models/teacherModel');
const cloudinary = require('../Config/cloudinaryConfig');
const Eleve = require('../models/studentModel');
const User = require('../models/userModel');

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
    if (!tuteur || !serviceFound || serviceFound.suspendu) {
      return res.status(404).json({
        status: "fail",
        message: "L'enseignant ou le service n'existe pas ou le service suspendu."
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
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ status: "fail", message: "ID service requis." });
    }
    const serviceFound = await Service.findOne({id_service :  id});

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

    try {
  const sessions = await Session.find({
    service: service._id,
    statut: { $in: ["confirmee", "reportee"] }
  });

  const studentIds = [
    ...new Set(
      sessions.flatMap(s => s.etudiants.map(e => String(e)))
    )
  ];

  if (studentIds.length > 0) {
    // leurs devices
    const devices = await Device.find({
      userId: { $in: studentIds },
      isActive: true,
      deviceToken: /^ExponentPushToken/ 
    });

    const champsModifies = Object.keys(updates)
      .filter(k => !['id_service', 'id_enseignant', '_id', 'date_creation'].includes(k))
      .join(', ');

    const notifTitle = 'Service modifié';
    const notifBody = `Le service: "${service.titre || service.nom_service}" a été mis à jour${champsModifies ? ` (${champsModifies})` : ''}.`;

    const pushPromises = devices.map(device =>
      sendExpoPush(device.deviceToken, {
        title: notifTitle,
        body: notifBody,
        url: '/services',
        extra: { type: 'service_update', id_service: service.id_service }
      }).catch(err => console.error('Push failed:', err.message))
    );

    await Promise.all(pushPromises);
  } else {
    console.log('Aucun étudiant inscrit');
  }
} catch (notifError) {
  console.error('Erreur notification:', notifError.message);
}


    res.status(200).json({
      status: "success",
      message: "Service mis à jour avec succès et contrôles de sécurité validés.",
      data: service
    });

  } catch (error) {
    console.error('STACK:', error.stack); 
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

    try {
      if (seance.etudiants && seance.etudiants.length > 0) {

        const studentDevicesArrays = await Promise.all(
          seance.etudiants.map(studentObjectId =>
            Device.find({ userId: studentObjectId, isActive: true })
          )
        );

        const allDevices = studentDevicesArrays.flat();

        if (allDevices.length > 0) {
          let body = `Votre séance "${seance.titre}" a été modifiée`;
          if (updates.date_seance) body = `Votre séance "${seance.titre}" a été reportée au ${updates.date_seance}`;
          else if (updates.heure_debut) body = `Votre séance "${seance.titre}" a un nouvel horaire : ${updates.heure_debut} - ${updates.heure_fin || seance.heure_fin}`;
          else if (updates.lieu) body = `Le lieu de votre séance "${seance.titre}" a changé : ${updates.lieu}`;
          else if (updates.lien_visio) body = `Le lien de votre séance "${seance.titre}" a été mis à jour`;

          const pushPromises = allDevices.map(device =>
            sendExpoPush(device.deviceToken, {
              title: 'Séance modifiée',
              body,
              url: '/sessions',
              extra: { type: 'session_update', id_seance: seance.id_seance }
            }).catch(err => {
              console.error('Push failed for device:', device._id, err.message);
            })
          );

          await Promise.all(pushPromises);
        } else {
          console.log('No devices found for students in this session');
        }
      }
    } catch (pushErr) {
      console.error('Notification block error:', pushErr.message);
    }
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
    const estVierge = seances.every(s => !s.etudiants || s.etudiants.length === 0);

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

// ═══════════════════════════════════════════════════════════════
// CONFIRM SESSION AS "ASSUREE" - Mark session as completed/assured
// ═══════════════════════════════════════════════════════════════
const confirmSession = async (req, res) => {
  try {
    const { id_seance } = req.params || req.query;
    const id_enseignant_auth = req.user.idmembre;

    // Validation
    if (!id_seance) {
      return res.status(400).json({
        status: "fail",
        message: "L'ID de la séance est requis."
      });
    }

    const numericIdSeance = Number(id_seance);

    // Find session
    const seance = await Session.findOne({ id_seance: numericIdSeance })
      .populate('enseignant', '_id id_enseignant');

    if (!seance) {
      return res.status(404).json({
        status: "fail",
        message: "Séance introuvable."
      });
    }

    // Verify teacher ownership
    const profDoc = await prof.findOne({ id_enseignant: id_enseignant_auth });
    if (!profDoc || String(seance.enseignant._id) !== String(profDoc._id)) {
      return res.status(403).json({
        status: "fail",
        message: "Accès refusé : Vous n'êtes pas propriétaire de cette séance."
      });
    }

    // Verify session is in "libre" or "confirmee" status
    if (!["libre", "confirmee"].includes(seance.statut)) {
      return res.status(400).json({
        status: "fail",
        message: `Impossible de confirmer une séance au statut "${seance.statut}". Seules les séances "libre" ou "confirmee" peuvent être confirmées.`
      });
    }

    // Calculate session end time
    const sessionDate = new Date(seance.date_seance);
    const [heure, minute] = seance.heure_fin.split(':');
    sessionDate.setHours(parseInt(heure), parseInt(minute), 0, 0);

    const now = new Date();

    // Verify session has passed
    if (now <= sessionDate) {
      return res.status(400).json({
        status: "fail",
        message: `La séance n'est pas encore terminée. Elle se terminera à ${seance.heure_fin}. Vous pourrez la confirmer après cette heure.`
      });
    }

    // Update status to "assuree"
    seance.statut = "assuree";
    await seance.save();

    // Optional: Send notifications to students
    try {
      const studentUserIds = seance.students
        .filter(s => !s.isDeleted)
        .map(s => s.userId);

      if (studentUserIds.length > 0) {
        const devices = await Device.find({
          userId: { $in: studentUserIds },
          isActive: true,
          deviceToken: /^ExponentPushToken/
        });

        const notifTitle = 'Séance confirmée';
        const notifBody = `La séance "${seance.titre}" a été confirmée comme assuree.`;

        const pushPromises = devices.map(device =>
          sendExpoPush(device.deviceToken, {
            title: notifTitle,
            body: notifBody,
            url: '/sessions',
            extra: { type: 'session_confirmed', id_seance: seance.id_seance }
          }).catch(err => console.error('Push failed:', err.message))
        );

        await Promise.all(pushPromises);
      }
    } catch (notifError) {
      console.error('Erreur notification:', notifError.message);
    }

    res.status(200).json({
      status: "success",
      message: "Séance confirmée comme assuree avec succès.",
      data: {
        id_seance: seance.id_seance,
        titre: seance.titre,
        statut: seance.statut,
        date_seance: seance.date_seance,
        heure_debut: seance.heure_debut,
        heure_fin: seance.heure_fin,
        confirmedAt: new Date()
      }
    });

  } catch (error) {
    console.error('Error confirming session:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
};

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

    const estVierge = !seance.etudiants || seance.etudiants.length === 0;

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

const getSessionById = async (req, res) => {
  try {
    const { id_seance } = req.query;
    const session = await Session.findById(id_seance);
    if (!session) return res.status(404).json({ status: 'fail', message: 'Séance introuvable.' });
    res.status(200).json({ status: 'success', data: session });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

const addDocumentToSession = async (req, res) => {
  try {
    const id_enseignant = req.user.idmembre;
    const { id_seance } = req.params;

    const tuteur = await Teacher.findOne({ id_enseignant });
    if (!tuteur) {
      return res.status(404).json({ status: 'fail', message: 'Enseignant introuvable.' });
    }

    const seance = await Seance.findOne({ id_seance: Number(id_seance) });
    if (!seance) {
      return res.status(404).json({ status: 'fail', message: 'Séance introuvable.' });
    }

    if (String(seance.enseignant) !== String(tuteur._id)) {
      return res.status(403).json({ status: 'fail', message: 'Action interdite : Ce n\'est pas votre séance.' });
    }

    if (!req.file) {
      return res.status(400).json({ status: 'fail', message: 'Aucun fichier fourni.' });
    }

    seance.documents.push({
      url:      req.file.path,       // cloudinary URL
      publicId: req.file.filename,   // cloudinary public_id
      nom:      req.body.nom || req.file.originalname,
      uploadedAt: new Date()
    });

    await seance.save();

    return res.status(201).json({
      status:  'success',
      message: 'Document ajouté avec succès.',
      data:    seance.documents[seance.documents.length - 1]
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

const getSessionStudents = async (req, res) => {
  try {
    const { id_seance } = req.params;

    const session = await Seance.findOne({ id_seance: parseInt(id_seance) })
      .select('id_seance titre students date_seance heure_debut heure_fin statut')
      .lean();

    if (!session) {
      return res.status(404).json({
        status:  'fail',
        message: 'Séance introuvable.'
      });
    }

    const activeStudents = session.students.filter(s => !s.isDeleted);

    if (activeStudents.length === 0) {
      return res.status(200).json({
        status:  'success',
        total:   0,
        session: {
          id_seance:   session.id_seance,
          titre:       session.titre,
          date_seance: session.date_seance,
          heure_debut: session.heure_debut,
          heure_fin:   session.heure_fin,
          statut:      session.statut
        },
        data: []
      });
    }

    const idmembres = activeStudents.map(s => s.idmembre);

    const eleves = await Eleve.find({ id_eleve: { $in: idmembres } }).lean();
    const eleveMap = {};
    eleves.forEach(e => { eleveMap[e.id_eleve] = e; });

    const userIds = activeStudents.map(s => s.userId);
    const users   = await User.find({ _id: { $in: userIds } })
      .select('_id idmembre email numberphone photo_profil')
      .lean();

    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const students = activeStudents.map(s => {
      const user  = userMap[s.userId.toString()];
      const eleve = eleveMap[s.idmembre];

      return {
        userId:          s.userId,
        idmembre:        s.idmembre,
        joinedAt:        s.joinedAt,
        firstname:       s.snapshot?.firstname  || null,
        familyname:      s.snapshot?.familyname || null,
        email:           user?.email            || null,
        phone:           user?.numberphone      || null,
        photo:           user?.photo_profil     || null,
        niveau_scolaire: eleve?.niveau_scolaire ?? null,
        yearOfStudy:     eleve?.yearOfStudy     ?? null,
        speciality:      eleve?.speciality      ?? null,
      };
    });

    return res.status(200).json({
      status: 'success',
      total:  students.length,
      session: {
        id_seance:   session.id_seance,
        titre:       session.titre,
        date_seance: session.date_seance,
        heure_debut: session.heure_debut,
        heure_fin:   session.heure_fin,
        statut:      session.statut
      },
      data: students
    });

  } catch (error) {
    console.error('getSessionStudents error:', error);
    return res.status(500).json({
      status:  'error',
      message: error.message
    });
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
  confirmSession,
  deleteService,
  deleteSession,
  getSessionById,
  addDocumentToSession ,
  getSessionStudents
}
