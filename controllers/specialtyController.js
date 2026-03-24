const Specialty = require('../models/educationModel');

const getSubjectsByCycle = async (req, res) => {
  try {
    const { cycleChoisi, niveau, specialité } = req.query;
    let results = []; 

    if (cycleChoisi === "ESI") {
      let filter = { cycle: "ESI", levelName: niveau };
      
      if (niveau === "2CS") {
        if (specialité) {
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

  if (cycle?.toLowerCase() === 'secondaire') {
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
      cycle: "Secondaire",
      nature: nature,
      subjects: subjects
    });
  }

  return res.status(400).json({ 
    status: 'fail', 
    message: "Le cycle doit être 'secondaire' pour cette fonction." 
  });
};


module.exports = {
  getSubjectsByCycle,
  getEsiSpeciality,
  getEsiYears,
  getSubjectByNature
};