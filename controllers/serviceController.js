const service = require('../models/serviceModel');
const prof = require('../models/teacherModel');


const getProfSubjects = async (req, res) => {
  const { id } = req.query;

  try {
    const teacher = await prof.findOne({ id_enseignant: id });

    if (!teacher) {
      return res.status(404).json({ success: false, message: "Enseignant non trouvé" });
    }

    const getAllowedCycles = (mainCycle) => {
      const hierarchy = {
        "Secondaire": ["Secondaire", "Moyen", "Primaire"],
        "Moyen": ["Moyen", "Primaire"],
        "Primaire": ["Primaire"],
        "ESI": ["ESI"]
      };
      return hierarchy[mainCycle] || [mainCycle];
    };

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
    const { id_enseignant } = req.body;

    const profFound = await Teacher.findOne({ id_enseignant: id_enseignant });
    // if le prof existe
    if (!profFound) {
      return res.status(404).json({ 
        status: "fail", 
        message: `L'enseignant avec l'ID ${id_enseignant} n'existe pas dans la base.` 
      });
    }

    const lastService = await Service.findOne().sort({ id_service: -1 });
    const nextId = lastService ? lastService.id_service + 1 : 1;

    const newService = new Service({
      id_service: nextId,
      ...req.body
    });

    await newService.save();

    res.status(201).json({
      status: 'success',
      data: newService
    });

  } catch (error) {
    res.status(400).json({ 
      status: 'fail hhh', 
      message: error.message 
    });
  }
};

 

module.exports = { createService };

module.exports = {
  getProfSubjects,
  createService 
}

