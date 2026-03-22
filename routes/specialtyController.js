const Specialty = require('../models/educationModel');

const getSubjectsByCycle = async (req, res) => {
  try {
  const { cycleChoisi } = req.query;

  const result = await Specialty.findOne({ cycle: cycleChoisi });

  if (!result) {
    return res.status(404).json({ message: "Niveau non trouvé" });
  }

  res.status(200).json({
    status: 'success',
    subjects: result.subjects 
  });
  } catch (error) {
  res.status(400).json({ status: 'fail', message: error.message });
  }
}; 

module.exports = {
  getSubjectsByCycle
}