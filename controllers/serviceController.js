const service = require('../models/serviceModel');
const prof = require('../models/teacherModel');

const getProfSubjects = async (req, res) => {
  const { id } = req.query;

  try {

    const teacher = await prof.findOne({ id_enseignant: id });

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: `No professor found with id_enseignant: ${id}`
      });
    }

    return res.status(200).json({
      success: true,
      teacherId: teacher.id_enseignant,
      subjects: teacher.subjects
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
};

module.exports = {
  getProfSubjects
}

