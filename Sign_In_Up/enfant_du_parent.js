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

    if (!firstname || !familyname) {
      return res.status(400).json({
        status: 'fail',
        message: "Le prénom et le nom de famille de l'enfant sont obligatoires."
      });
    }

    // Récupérer le profil parent via idmembre du user connecté
    const parent = await Parent.findOne({ id_parent: req.user.idmembre }).session(session);
    if (!parent) {
      return res.status(404).json({ status: 'fail', message: "Profil parent introuvable." });
    }

    const childId = await getNextId('student');

    const newChild = new Student({
      id_eleve:   childId,
      id_parent:  req.user.idmembre,
      firstname,
      familyname
    });

    await newChild.save({ session });

    parent.enfants.push(newChild._id);
    await parent.save({ session });

    await session.commitTransaction();

    return res.status(201).json({
      status:  'success',
      message: "Enfant ajouté avec succès.",
      data:    newChild
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
  try {
    const { id_eleve } = req.params; // id_eleve (Number)
    const { firstname, familyname } = req.body;

    if (!firstname && !familyname) {
      return res.status(400).json({
        status: 'fail',
        message: "Au moins un champ à modifier est requis (firstname ou familyname)."
      });
    }

    // Vérifier que l'enfant appartient bien à ce parent
    const child = await Student.findOne({
      id_eleve:  Number(id_eleve),
      id_parent: req.user.idmembre
    });

    if (!child) {
      return res.status(404).json({
        status: 'fail',
        message: "Enfant introuvable ou vous n'êtes pas autorisé à le modifier."
      });
    }

    const updates = {};
    if (firstname)  updates.firstname  = firstname;
    if (familyname) updates.familyname = familyname;

    const updatedChild = await Student.findOneAndUpdate(
      { id_eleve: Number(id_eleve), id_parent: req.user.idmembre },
      { $set: updates },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      status:  'success',
      message: "Enfant mis à jour avec succès.",
      data:    updatedChild
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
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

    // Vérifier que l'enfant appartient bien à ce parent
    const child = await Student.findOne({
      id_eleve:  Number(id_eleve),
      id_parent: req.user.idmembre
    }).session(session);

    if (!child) {
      return res.status(404).json({
        status: 'fail',
        message: "Enfant introuvable ou vous n'êtes pas autorisé à le supprimer."
      });
    }

    // Supprimer l'enfant
    await Student.findByIdAndDelete(child._id).session(session);

    // Retirer l'enfant du tableau du parent
    await Parent.findOneAndUpdate(
      { id_parent: req.user.idmembre },
      { $pull: { enfants: child._id } },
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
    const enfants = await Student.find({ id_parent: req.user.idmembre })
      .select('id_eleve firstname familyname ');

    return res.status(200).json({
      status:  'success',
      total:   enfants.length,
      data:    enfants
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};