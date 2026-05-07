const Devis = require('../models/devisModel');
const getNextId = require('../generateID/nextID');
const Education = require('../models/educationModel');
const Teacher = require('../models/teacherModel');
const mongoose = require('mongoose');
const Device = require('../models/deviceModel');
const sendExpoPush = require('../utils/sendExpoPush');
const User = require('../models/userModel');
const Parent = require('../models/parentModel');
const Eleve  = require('../models/studentModel');

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
      budget_estime,
      id_enfant  
    } = req.body;

    const role = req.user.role;
    let id_eleve;

    if (role === 'parent') {
      if (!id_enfant) {
        return res.status(400).json({
          status: 'fail',
          message: "En tant que parent, vous devez fournir l'id de votre enfant (id_enfant)."
        });
      }

      const parent = await Parent.findOne({ id_parent: req.user.idmembre });
      if (!parent) {
        return res.status(404).json({
          status: 'fail',
          message: "Profil parent introuvable."
        });
      }

      const enfantEntry = parent.enfants.find(
        e => e.student?.toString() === id_enfant.toString() ||
             e._id?.toString()     === id_enfant.toString()
      );

      if (!enfantEntry) {
        return res.status(403).json({
          status: 'fail',
          message: "Cet enfant n'appartient pas à votre profil parent."
        });
      }

      const eleveDoc = await Eleve.findById(enfantEntry.student);
      if (!eleveDoc) {
        return res.status(404).json({
          status: 'fail',
          message: "Profil élève de l'enfant introuvable."
        });
      }

      id_eleve = eleveDoc.id_eleve;

    } else if (role === 'student') {
      id_eleve = req.user.idmembre;

    } else {
      return res.status(403).json({
        status: 'fail',
        message: "Seuls les étudiants et les parents peuvent créer un devis."
      });
    }

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
        message: "Vous avez déjà une demande de devis en attente pour cette matière avec cet enseignant."
      });
    }

    const enseignant = await Teacher.findOne({ id_enseignant });
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
        message: `L'enseignant ne propose pas de cours de ${matiere}.`
      });
    }

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
      repondue: false,
      statut: "En_attente",
      reponse_enseignant: "Pas encore de réponse"
    });

    await nouveauDevis.save();

    try {
      const userEnseignant = await User.findOne({ idmembre: enseignant.id_enseignant });

      if (userEnseignant) {
        const devices = await Device.find({ userId: userEnseignant._id, isActive: true });
        console.log('Devices en base:', devices);

        if (devices.length > 0) {
          console.log('Envoi notification...');
          const pushPromises = devices.map(device => {
            console.log('Token:', device.deviceToken);
            return sendExpoPush(device.deviceToken, {
              title: 'Nouveau devis reçu !',
              body: `Un élève a demandé un devis pour ${matiere}`,
              url: '/devis',
              extra: { type: 'devis' },
            }).catch(async err => {
              if (err.code === 'DeviceNotRegistered' || err.details === 'DeviceNotRegistered') {
                await Device.findByIdAndUpdate(device._id, { isActive: false });
              } else {
                console.error('Push error:', err.message);
              }
            });
          });
          await Promise.all(pushPromises);
        } else {
          console.log('No devices found — push not sent');
        }
      } else {
        console.log('User enseignant introuvable');
      }
    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Demande de devis envoyée avec succès.',
      data: nouveauDevis
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ status: 'error', message: error.message });
    }
  }
};

const getMesDevis = async (req, res) => {
  try {
    const userId = req.user.idmembre;
    const role   = req.user.role;

    let query = {};

    if (role === 'student') {
      query = { id_eleve: userId };

    } else if (role === 'parent') {
      const parent = await Parent.findOne({ id_parent: userId });
      if (!parent || parent.enfants.length === 0) {
        return res.status(200).json({ status: 'success', results: 0, data: [] });
      }

      const eleveIds = await Eleve.find({
        _id: { $in: parent.enfants.map(e => e.student) }
      }).select('id_eleve');

      const numericIds = eleveIds.map(e => e.id_eleve);
      query = { id_eleve: { $in: numericIds } };

    } else if (role === 'teacher') {
      query = { id_enseignant: userId };
    }

    const devis = await Devis.find(query);

    return res.status(200).json({
      status:  'success',
      results: devis.length,
      data:    devis
    });

  } catch (error) {
    res.status(500).json({ status: 'fail', message: error.message });
  }
};


const repondreDevis = async (req, res) => {
  try {
    const { statut, messageProf, prixPropose, frequence_proposee, duree_proposee } = req.body;
    const id_prof_connecte = req.user.idmembre;
    const devisId          = parseInt(req.params.id);

    const devis = await Devis.findOne({ id_devis: devisId });
    if (!devis) {
      return res.status(404).json({ message: "Devis non trouvé." });
    }

    if (devis.id_enseignant !== id_prof_connecte) {
      return res.status(403).json({ message: "Interdit : Ce n'est pas votre devis." });
    }

    devis.luprof = true;
    devis.luEtud = false;

    let notifTitle = '';
    let notifBody  = '';

    if (statut === 'Accepte') {
      devis.statut   = 'Accepte';
      devis.repondue = true;
      notifTitle = 'Devis accepté';
      notifBody  = `Votre devis pour ${devis.matiere} a été accepté par l'enseignant.`;

    } else if (statut === 'Refuse') {
      devis.statut   = 'Refuse';
      devis.repondue = true;
      notifTitle = 'Devis refusé';
      notifBody  = `Votre devis pour ${devis.matiere} a été refusé par l'enseignant.`;

    } else if (statut === 'En_attente') {
      if (prixPropose)        devis.budget_estime      = prixPropose;
      if (frequence_proposee) devis.frequence_souhaite = frequence_proposee;
      if (duree_proposee)     devis.duree_estimee      = duree_proposee;
      devis.repondue            = true;
      devis.message_negociation = "L'enseignant a proposé de nouvelles conditions.";
      notifTitle = 'Contre-proposition reçue';
      notifBody  = `L'enseignant a proposé de nouvelles conditions pour votre devis de ${devis.matiere}.`;

    } else {
      return res.status(400).json({
        message: "Statut invalide. Utilisez 'Accepte', 'Refuse' ou 'En_attente'."
      });
    }

    devis.reponse_enseignant = messageProf;
    devis.dateReponse        = Date.now();

    await devis.save();

    try {
      let targetUser   = null;
      let targetUserId = null;

      const eleveUser = await User.findOne({ idmembre: devis.id_eleve });

      if (eleveUser) {
        const eleveDevices = await Device.find({ userId: eleveUser._id, isActive: true });

        if (eleveDevices.length > 0) {
          targetUser   = eleveUser;
          targetUserId = eleveUser._id;
        }
      }

      if (!targetUserId) {
        const eleveDoc = await Eleve.findOne({ id_eleve: devis.id_eleve });

        if (eleveDoc && eleveDoc.id_parent) {
          const parentUser = await User.findOne({ idmembre: eleveDoc.id_parent });

          if (parentUser) {
            targetUser   = parentUser;
            targetUserId = parentUser._id;
            console.log('Student has no device — notifying parent instead:', parentUser.idmembre);
          }
        }
      }

      if (targetUserId) {
        const devices = await Device.find({ userId: targetUserId, isActive: true });
        console.log('Devices trouvés:', devices.length);

        if (devices.length > 0) {
          const pushPromises = devices.map(device =>
            sendExpoPush(device.deviceToken, {
              title: notifTitle,
              body:  notifBody,
              url:   '/devis'
            }).catch(async err => {
              if (
                err.code    === 'DeviceNotRegistered' ||
                err.details === 'DeviceNotRegistered'
              ) {
                await Device.findByIdAndUpdate(device._id, { isActive: false });
              } else {
                console.error('Push error:', err.message);
              }
            })
          );
          await Promise.all(pushPromises);
        }
      } else {
        console.log('No user or parent found to notify.');
      }

    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    return res.status(200).json({
      status:  'success',
      message: statut === 'En_attente'
        ? "Contre-proposition envoyée à l'élève."
        : `Devis ${statut}.`,
      data: devis
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ status: 'fail', message: error.message });
    }
  }
};


const reponseFinaleEtudiant = async (req, res) => {
  try {
    const { action } = req.body;
    const devisId    = parseInt(req.params.id);

    const devis = await Devis.findOne({ id_devis: devisId });
    if (!devis) return res.status(404).json({ message: "Devis non trouvé." });

    if (devis.statut !== "En_attente") {
      return res.status(400).json({ message: "Le statut final a déjà été décidé par le professeur." });
    }

    devis.statut               = action === 'Accepte' ? 'Accepte' : 'Refuse';
    devis.date_reponse_Etudiant = Date.now();
    devis.luEtud               = true;
    devis.luprof               = false;

    await devis.save();

    try {
      const accepted     = action === 'Accepte';
      const notifTitle   = accepted ? 'Contre-proposition acceptée' : 'Contre-proposition refusée';
      const notifBody    = accepted
        ? `L'élève a accepté vos nouvelles conditions pour le devis de ${devis.matiere}.`
        : `L'élève a refusé vos nouvelles conditions pour le devis de ${devis.matiere}.`;

      const enseignant = await User.findOne({ idmembre: devis.id_enseignant });

      if (enseignant) {
        const devices = await Device.find({ userId: enseignant._id, isActive: true });

        if (devices.length > 0) {
          const pushPromises = devices.map(device =>
            sendExpoPush(device.deviceToken, {
              title: notifTitle,
              body:  notifBody,
              url:   '/devis'
            }).catch(async err => {
              if (
                err.code    === 'DeviceNotRegistered' ||
                err.details === 'DeviceNotRegistered'
              ) {
                await Device.findByIdAndUpdate(device._id, { isActive: false });
              } else {
                console.error('Push error:', err.message);
              }
            })
          );
          await Promise.all(pushPromises);
        }
      }
    } catch (pushErr) {
      console.error('Push notification error:', pushErr.message);
    }

    return res.status(200).json({
      status:  'success',
      message: "Décision finale enregistrée.",
      data:    devis
    });

  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ status: 'fail', message: error.message });
    }
  }
};

const getParentChildren = async (req, res) => {
  try {
    const id_parent = req.user.idmembre; 
    const role = req.user.role;
    if(role !== 'parent'){
              return res.status(400).json({
          status: 'fail',
          message: "vous n etes pas a parent."
        });

    }
    const parent = await Parent.findOne({ id_parent: parseInt(id_parent) })
      .select('enfants')
      .lean();

    if (!parent) {
      return res.status(404).json({ status: 'fail', message: 'Parent introuvable.' });
    }

    const children = parent.enfants.map(e => ({
      student:    e.student,
      firstname:  e.firstname,
      familyname: e.familyname
    }));

    return res.status(200).json({
      status: 'success',
      total:  children.length,
      data:   children
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};


module.exports = {
  creerDevis, 
  getMesDevis,
  repondreDevis,
  reponseFinaleEtudiant,
  getParentChildren
};