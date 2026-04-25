const Education = require('../models/educationModel'); 

const getLevelName = (cycle, level, specialty) => {
  if (cycle === 'Primaire') return `${level}AP`;
  if (cycle === 'College')  return `${level}AM`;
  if (cycle === 'ESI') {
    const esiMap = { 1: '1CP', 2: '2CP', 3: '1CS', 4: '2CS' };
    return esiMap[level] || `${level}CS`;
  }
  return null;
};

// GET /api/admin/education/options?cycle=Lycee
const getOptions = async (req, res) => {
  try {
    const { cycle } = req.query;

    if (!cycle) {
      return res.status(400).json({ message: 'cycle est obligatoire.' });
    }

    const docs = await Education.find({ cycle }).sort({ level: 1 });

    if (docs.length === 0) {
      return res.status(404).json({ message: `Aucun niveau trouvé pour le cycle "${cycle}".` });
    }

    // Build options based on cycle
    if (cycle === 'Primaire' || cycle === 'College') {
      // Just levels, no specialty
      const levels = docs.map(d => ({
        level: d.level,
        levelName: d.levelName
      }));
      return res.status(200).json({
        status: 'success',
        cycle,
        needsSpecialty: false,
        levels
      });
    }

    if (cycle === 'Lycee') {
      // Group by level → list specialties per level
      const grouped = {};
      docs.forEach(d => {
        if (!grouped[d.level]) {
          grouped[d.level] = { level: d.level, specialties: [] };
        }
        grouped[d.level].specialties.push({
          specialty: d.specialty,
          levelName: d.levelName
        });
      });
      return res.status(200).json({
        status: 'success',
        cycle,
        needsSpecialty: true,
        levels: Object.values(grouped)
      });
    }

    if (cycle === 'ESI') {
      // Group by level → list specialties per level
      const grouped = {};
      docs.forEach(d => {
        if (!grouped[d.level]) {
          grouped[d.level] = {
            level: d.level,
            levelName: d.levelName,
            specialties: []
          };
        }
        if (d.specialty) grouped[d.level].specialties.push(d.specialty);
      });
      return res.status(200).json({
        status: 'success',
        cycle,
        needsSpecialty: true,
        levels: Object.values(grouped)
      });
    }

    return res.status(400).json({ message: `Cycle "${cycle}" non reconnu.` });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/admin/education/cycles
const getCycles = async (req, res) => {
  try {
    const cycles = await Education.distinct('cycle');
    return res.status(200).json({ status: 'success', cycles });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// GET /api/admin/education/subjects?cycle=Lycee&level=3&specialty=
const getSubjects = async (req, res) => {
  try {
    const { cycle, level, specialty } = req.query;
    if (!cycle || !level) return res.status(400).json({ message: 'cycle et level obligatoires.' });

    const query = { cycle, level: Number(level) };
    if (specialty) query.specialty = specialty;

    const education = await Education.findOne(query);
    if (!education) return res.status(404).json({ message: 'Niveau non trouvé.' });

    return res.status(200).json({
      status: 'success',
      levelName: education.levelName,
      specialty: education.specialty,
      subjects: education.subjects
    });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

// POST /api/admin/education/add-subject
const addSubject = async (req, res) => {
  try {
    const { subject, cycle, level, specialty } = req.body;

    if (!subject || !cycle || !level) {
      return res.status(400).json({ message: 'subject, cycle et level sont obligatoires.' });
    }

    const needsSpecialty = cycle === 'Lycee' || cycle === 'ESI';
    if (needsSpecialty && !specialty) {
      return res.status(400).json({ message: 'specialty est obligatoire pour Lycee et ESI.' });
    }

    // Build query to find the right document
    const query = { cycle, level: Number(level) };
    if (needsSpecialty) query.specialty = specialty;

    let education = await Education.findOne(query);

    if (!education) {
      return res.status(409).json({ message: `introuvable niveau.` });    
    }

    // Check duplicate
    if (education.subjects.includes(subject)) {
      return res.status(409).json({ message: `"${subject}" existe déjà dans ce niveau.` });
    }

    education.subjects.push(subject);
    await education.save();

    return res.status(200).json({
      status: 'success',
      message: `"${subject}" ajouté à ${education.levelName} (${education.specialty || education.cycle}).`,
      data: education
    });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const removeSubject = async (req, res) => {
  try {
    const { subject, cycle, level, specialty } = req.body;

    // Validate required fields
    if (!subject || !cycle || !level) {
      return res.status(400).json({ message: 'subject, cycle et level sont obligatoires.' });
    }

    const needsSpecialty = cycle === 'Lycee' || cycle === 'ESI';
    if (needsSpecialty && !specialty) {
      return res.status(400).json({ message: 'specialty est obligatoire pour Lycee et ESI.' });
    }

    // Find the right document
    const query = { cycle, level: Number(level) };
    if (needsSpecialty) query.specialty = specialty;

    const education = await Education.findOne(query);
    if (!education) {
      return res.status(404).json({ message: 'Niveau non trouvé.' });
    }

    if (!education.subjects.includes(subject)) {
      return res.status(404).json({ message: `"${subject}" n'existe pas dans ce niveau.` });
    }

    education.subjects = education.subjects.filter(s => s !== subject);
    await education.save();

    return res.status(200).json({
      status: 'success',
      message: `"${subject}" supprimé de ${education.levelName}.`,
      data: education
    });

  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};

const getAllLevels = async (req, res) => {
  try {
    const levels = await Education.find().sort({ cycle: 1, level: 1 });
    return res.status(200).json({ status: 'success', data: levels });
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
};


module.exports = { addSubject, removeSubject, getAllLevels , getOptions , getSubjects , getCycles};
