// controllers/enfantController.js

const Student = require('../models/studentModel');
const Parent  = require('../models/parentModel');
const mongoose = require('mongoose');
const getNextId = require('../generateID/nextID');

// ─────────────────────────────────────────────────────────────
// Ajouter un enfant à un parent
// ─────────────────────────────────────────────────────────────
exports.ajouterEnfant = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { firstname, familyname } = req.body;

    // ── VALIDATION ─────────────────────────────
    if (!firstname || !familyname) {
      return res.status(400).json({
        status: 'fail',
        message: "Le prénom et le nom de famille de l'enfant sont obligatoires."
      });
    }

    // ── GET PARENT ─────────────────────────────
    const parent = await Parent.findOne({
      id_parent: req.user.idmembre
    }).session(session);

    if (!parent) {
      return res.status(404).json({
        status: 'fail',
        message: "Profil parent introuvable."
      });
    }

    // ── CREATE STUDENT ─────────────────────────
    const childId = await getNextId('student');

    const newChildArr = await Student.create([{
      id_eleve: childId,
      id_parent: req.user.idmembre
    }], { session });

    const student = newChildArr[0];

    // ── UPDATE PARENT (snapshot) ───────────────
    parent.enfants.push({
      student: student._id,
      firstname,
      familyname
    });

    await parent.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      status: 'success',
      message: "Enfant ajouté avec succès.",
      data: {
        _id: student._id,
        id_eleve: student.id_eleve,
        firstname,
        familyname
      }
    });

  } catch (error) {
    await session.abortTransaction();

    return res.status(500).json({
      status: 'error',
      message: error.message
    });

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
    const { id_parent} = req.body;
    const { id_eleve } = req.params;
    const { firstname, familyname } = req.body;

    // ── VALIDATION ─────────────────────────────
    if (!id_parent || !id_eleve) {
      return res.status(400).json({
        status: 'fail',
        message: "id_parent et id_eleve sont obligatoires."
      });
    }

    if (!firstname && !familyname) {
      return res.status(400).json({
        status: 'fail',
        message: "Au moins un champ à modifier est requis."
      });
    }

    // ── FIND STUDENT ───────────────────────────
    const student = await Student.findOne({
      id_eleve: Number(id_eleve),
      id_parent: Number(id_parent)
    }).session(session);

    if (!student) {
      return res.status(404).json({
        status: 'fail',
        message: "Student introuvable."
      });
    }

    // ── FIND PARENT ────────────────────────────
    const parent = await Parent.findOne({
      id_parent: Number(id_parent)
    }).session(session);

    if (!parent) {
      return res.status(404).json({
        status: 'fail',
        message: "Parent introuvable."
      });
    }

    // ── FIND CHILD IN PARENT ARRAY ────────────
    const index = parent.enfants.findIndex(
      e => e.student.toString() === student._id.toString()
    );

    if (index === -1) {
      return res.status(404).json({
        status: 'fail',
        message: "Enfant non trouvé dans le parent."
      });
    }

    // ── UPDATE SNAPSHOT ────────────────────────
    if (firstname) {
      parent.enfants[index].firstname = firstname;
    }

    if (familyname) {
      parent.enfants[index].familyname = familyname;
    }

    await parent.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Enfant mis à jour avec succès.",
      data: parent.enfants[index]
    });

  } catch (error) {
    await session.abortTransaction();

    return res.status(500).json({
      status: 'error',
      message: error.message
    });

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

    // ── FIND STUDENT ───────────────────────────
    const child = await Student.findOne({
      id_eleve: Number(id_eleve),
      id_parent: req.user.idmembre
    }).session(session);

    if (!child) {
      return res.status(404).json({
        status: 'fail',
        message: "Enfant introuvable ou non autorisé."
      });
    }

    // ── DELETE STUDENT ─────────────────────────
    await Student.findByIdAndDelete(child._id).session(session);

    // ── REMOVE FROM PARENT SNAPSHOT ───────────
    await Parent.updateOne(
      { id_parent: req.user.idmembre },
      {
        $pull: {
          enfants: {
            student: child._id
          }
        }
      },
      { session }
    );

    await session.commitTransaction();

    return res.status(200).json({
      status: 'success',
      message: "Enfant supprimé avec succès."
    });

  } catch (error) {
    await session.abortTransaction();

    return res.status(500).json({
      status: 'error',
      message: error.message
    });

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
    ).populate('enfants.student');

    if (!parent) {
      return res.status(404).json({
        status: 'fail',
        message: 'Parent not found'
      });
    }

    const enfants = parent.enfants.map(e => ({
      _id: e.student?._id,
      id_eleve: e.student?.id_eleve,
      firstname: e.firstname,
      familyname: e.familyname
    }));

    return res.status(200).json({
      status: 'success',
      total: enfants.length,
      data: enfants
    });

  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};