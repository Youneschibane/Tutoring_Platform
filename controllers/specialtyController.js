const Specialty = require('../models/educationModel');

const getSubjectsByCycle = async (req, res) => {
  try {
    const { cycleChoisi } = req.query;

    const results = await Specialty.find({ cycle: cycleChoisi });

    if (!results || results.length === 0) {
      return res.status(404).json({ message: "Niveau non trouvé" });
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

module.exports = {
  getSubjectsByCycle,
  getEsiSpeciality,
  getEsiYears
};