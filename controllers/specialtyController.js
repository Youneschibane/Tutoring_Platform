const Specialty = require('../models/educationModel');
const prof = require("../models/teacherModel");
const mongoose = require('mongoose');

const getAllowedCycles = (mainCycle) => {
  const hierarchy = {
    "Lycee": ["Lycee", "College", "Primaire"],
    "College": ["College", "Primaire"],
    "Primaire": ["Primaire"],
    "ESI": ["ESI"]
  };
  return hierarchy[mainCycle] || [mainCycle];
};


const getSubjectsByCycle = async (req, res) => {
  try {
    const { cycleChoisi, niveau, specialité } = req.query;
    let results = []; 

    if (cycleChoisi === "ESI") {
      let filter = { cycle: "ESI" };

      if (niveau) {
        filter.levelName = niveau;
        if (niveau === "2CS" && specialité) {
          filter.specialty = specialité.toUpperCase();
        }
      }
      results = await Specialty.find(filter);
      
      if (!results || results.length === 0) {
        return res.status(404).json({ message: "Modules ESI non trouvés pour ce niveau/spécialité" });
      }
    } else {
      results = await Specialty.find({ cycle: cycleChoisi });

      if (!results || results.length === 0) {
        return res.status(404).json({ message: "Niveau non trouvé" });
      }
    }

    const allSubjects = results.flatMap(doc => doc.subjects);
    const uniqueSubjects = [...new Set(allSubjects)];

    res.status(200).json({
      status: 'success',
      subjects: uniqueSubjects
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

const getEsiYears = async (req, res) => {
  try {
    const years = await Specialty.distinct('levelName', { cycle: 'ESI' });

    res.status(200).json({
      status: 'success',
      years
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

const getEsiSpeciality = async (req, res) => {
  try {
    const { year } = req.query;

    if (year !== '2CS') {
      return res.status(200).json({
        status: 'success',
        specialties: [] 
      });
    }

    const specialties = await Specialty.distinct('specialty', { 
      cycle: 'ESI', 
      levelName: '2CS' 
    });

    res.status(200).json({
      status: 'success',
      specialties
    });
  } catch (error) {
    res.status(400).json({ status: 'fail', message: error.message });
  }
};

const getSubjectByNature = async (req, res) => {
  const { cycle, nature } = req.query;

  if (cycle?.toLowerCase() === 'lycee') {
    let subjects = [];

    switch (nature?.toLowerCase()) {
      case 'technique':
        subjects = ["SVT","Mathématiques", "Physique", "Génie Civil", "Génie Mécanique", "Génie Électrique", "Génie des Procédés"];
        break;

      case 'lettre':
        subjects = ["Philosophie", "Arabe", "Histoire-Géo", "Français", "Anglais", "Espagnol", "Allemand"];
        break;

      case 'gestion':
        subjects = ["Comptabilité et Gestion Financière", "Économie et Management", "Droit"];
        break;

      default:
        return res.status(404).json({ 
          status: 'fail', 
          message: "Nature de filière inconnue (choisissez technique, lettre ou gestion )" 
        });
    }

    return res.status(200).json({
      status: 'success',
      cycle: "Lycee",
      nature: nature,
      subjects: subjects
    });
  }

  return res.status(400).json({ 
    status: 'fail', 
    message: "Le cycle doit être 'Lycee' pour cette fonction." 
  });
};


const getYears = async (req, res) => {
  try {
    const { cycle } = req.query;

    if (!cycle) {
      return res.status(400).json({ message: "Le paramètre 'cycle' est obligatoire." });
    }

    const results = await Specialty.find({ cycle: cycle });

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Aucune donnée trouvée pour ce cycle." });
    }

    const structure = {};

    results.forEach(doc => {
      const level = doc.levelName;
      const spec = doc.specialty;

      if (!structure[level]) {
        structure[level] = [];
      }

      if (spec && spec !== "" && !structure[level].includes(spec)) {
        structure[level].push(spec);
      }
    });

    const finalData = Object.keys(structure).map(level => ({
      level: level,
      specialties: structure[level] 
    }));

    res.status(200).json({
      status: 'success',
      cycle: cycle,
      data: finalData
    });

  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};


const getSubjectsProf = async (req, res) => {
  try {
    const { id_enseignant } = req.query; 

    const teacher = await prof.findOne({ id_enseignant: id_enseignant });

    if (!teacher) {
      return res.status(404).json({ 
        success: false, 
        message: "Enseignant non trouvé." 
      });
    }

    const subjectsWithPermissions = teacher.subjects.map(subj => {
      const mainCycle = subj.cycle;
      return {
        matiere: subj.name,
        cycleOriginal: mainCycle,
        cyclesAutorises: getAllowedCycles(mainCycle) 
      };
    });

    return res.status(200).json({
      success: true,
      teacherName: `${teacher.firstname} ${teacher.familyname}`,
      competences: subjectsWithPermissions
    });

  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Erreur serveur", 
      error: error.message 
    });
  }
};

module.exports = {
  getSubjectsByCycle,
  getEsiSpeciality,
  getEsiYears,
  getSubjectByNature, 
  getYears,
  getSubjectsProf,
  
};