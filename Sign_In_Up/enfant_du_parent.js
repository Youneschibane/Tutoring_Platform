// controllers/enfantController.js

const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const mongoose = require('mongoose');
const getNextId = require('../generateID/nextID');

// ─────────────────────────────────────────────────────────────
// Ajouter un enfant à un parent
// ─────────────────────────────────────────────────────────────
const Eleve  = require('../models/studentModel');

// ─────────────────────────────────────────────────────────────
// Ajouter un enfant
// ─────────────────────────────────────────────────────────────
exports.ajouterEnfant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstname, familyname, yearOfStudy, niveau_scolaire } = req.body;

    // ── VALIDATION ─────────────────────────────
    if (!firstname || !familyname) {
      return res.status(400).json({
        status:  'fail',
        message: "Le prénom et le nom de famille de l'enfant sont obligatoires."
      });
    }

    if (!niveau_scolaire) {
      return res.status(400).json({
        status:  'fail',
        message: "Le niveau scolaire est obligatoire."
      });
    }

    const validNiveaux = ["Primaire", "College", "Lycee", "Esi"];
    if (!validNiveaux.includes(niveau_scolaire)) {
      return res.status(400).json({
        status:  'fail',
        message: `Niveau scolaire invalide. Valeurs acceptées: ${validNiveaux.join(', ')}`
      });
    }

    // ── GET PARENT ─────────────────────────────
    const parent = await Parent.findOne({
      id_parent: req.user.idmembre
    }).session(session);

    if (!parent) {
      return res.status(404).json({
        status:  'fail',
        message: "Profil parent introuvable."
      });
    }

    // ── CREATE ELEVE ───────────────────────────
    const childId = await getNextId('eleve');

    const newEleveArr = await Eleve.create([{
      id_eleve:    childId,
      id_parent:   req.user.idmembre,
      niveau_scolaire,
      yearOfStudy: yearOfStudy || null,
    }], { session });

    const eleve = newEleveArr[0];

    // ── UPDATE PARENT (snapshot: nom seulement) ─
    parent.enfants.push({
      student:    eleve._id,
      firstname,
      familyname
    });

    await parent.save({ session });
    await session.commitTransaction();

    return res.status(201).json({
      status:  'success',
      message: "Enfant ajouté avec succès.",
      data: {
        _id:             eleve._id,
        id_eleve:        eleve.id_eleve,
        firstname,
        familyname,
        niveau_scolaire: eleve.niveau_scolaire,
        yearOfStudy:     eleve.yearOfStudy,
      }
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// Modifier un enfant
// ─────────────────────────────────────────────────────────────
exports.modifierEnfant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id_parent, firstname, familyname, yearOfStudy, niveau_scolaire } = req.body;
    const { id_eleve } = req.params;

    // ── VALIDATION ─────────────────────────────
    if (!id_parent || !id_eleve) {
      return res.status(400).json({
        status:  'fail',
        message: "id_parent et id_eleve sont obligatoires."
      });
    }

    if (!firstname && !familyname && !yearOfStudy && !niveau_scolaire) {
      return res.status(400).json({
        status:  'fail',
        message: "Au moins un champ à modifier est requis."
      });
    }

    if (niveau_scolaire) {
      const validNiveaux = ["Primaire", "College", "Lycee", "Esi"];
      if (!validNiveaux.includes(niveau_scolaire)) {
        return res.status(400).json({
          status:  'fail',
          message: `Niveau scolaire invalide. Valeurs acceptées: ${validNiveaux.join(', ')}`
        });
      }
    }

    // ── FIND ELEVE ─────────────────────────────
    const eleve = await Eleve.findOne({
      id_eleve:  Number(id_eleve),
      id_parent: Number(id_parent)
    }).session(session);

    if (!eleve) {
      return res.status(404).json({
        status:  'fail',
        message: "Elève introuvable."
      });
    }

    // ── UPDATE ELEVE FIELDS ────────────────────
    if (yearOfStudy)     eleve.yearOfStudy     = yearOfStudy;
    if (niveau_scolaire) eleve.niveau_scolaire = niveau_scolaire;

    await eleve.save({ session });

    // ── UPDATE PARENT SNAPSHOT (nom seulement) ─
    if (firstname || familyname) {
      const parent = await Parent.findOne({
        id_parent: Number(id_parent)
      }).session(session);

      if (!parent) {
        return res.status(404).json({
          status:  'fail',
          message: "Parent introuvable."
        });
      }

      const index = parent.enfants.findIndex(
        e => e.student.toString() === eleve._id.toString()
      );

      if (index === -1) {
        return res.status(404).json({
          status:  'fail',
          message: "Enfant non trouvé dans le profil parent."
        });
      }

      if (firstname)  parent.enfants[index].firstname  = firstname;
      if (familyname) parent.enfants[index].familyname = familyname;

      await parent.save({ session });
    }

    await session.commitTransaction();

    return res.status(200).json({
      status:  'success',
      message: "Enfant mis à jour avec succès.",
      data:    eleve
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// Supprimer un enfant
// ─────────────────────────────────────────────────────────────
exports.supprimerEnfant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id_eleve } = req.params;

    const child = await Student.findOne({
      id_eleve:  Number(id_eleve),
      id_parent: req.user.idmembre
    }).session(session);

    if (!child) {
      return res.status(404).json({
        status:  'fail',
        message: "Enfant introuvable ou non autorisé."
      });
    }

    await Student.findByIdAndDelete(child._id).session(session);

    await Parent.updateOne(
      { id_parent: req.user.idmembre },
      { $pull: { enfants: { student: child._id } } },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      status:  'success',
      message: "Enfant supprimé avec succès."
    });

  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ status: 'error', message: error.message });
  } finally {
    session.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// Récupérer tous les enfants d'un parent
// ─────────────────────────────────────────────────────────────
exports.getMesEnfants = async (req, res) => {
  try {
    const parent = await Parent.findOne(
      { id_parent: req.user.idmembre }
    ).populate({
      path:   'enfants.student',
      select: 'id_eleve niveau_scolaire yearOfStudy speciality'
    });

    if (!parent) {
      return res.status(404).json({
        status:  'fail',
        message: 'Profil parent introuvable.'
      });
    }

    if (parent.enfants.length === 0) {
      return res.status(200).json({
        status: 'success',
        total:  0,
        data:   []
      });
    }

    const enfants = parent.enfants
      .filter(e => e.student != null)
      .map(e => ({
        _id:             e.student._id,
        id_eleve:        e.student.id_eleve,
        firstname:       e.firstname,
        familyname:      e.familyname,
        niveau_scolaire: e.student.niveau_scolaire,
        yearOfStudy:     e.student.yearOfStudy ?? null,
        speciality:      e.student.speciality  ?? null,
      }));

    return res.status(200).json({
      status: 'success',
      total:  enfants.length,
      data:   enfants
    });

  } catch (error) {
    console.error('[getMesEnfants]', error);
    return res.status(500).json({
      status:  'error',
      message: error.message
    });
  }
};