require('dotenv').config();
const mongoose = require('mongoose');
const Seance   = require('./models/sessionModel');
const Teacher  = require('./models/teacherModel');
const Service  = require('./models/serviceModel');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("MongoDB connecté");

  const teacher = await Teacher.findOne({ id_enseignant: 309 });
  const service = await Service.findOne({ id_service: 12 });

  const seance = await Seance.create({
    id_seance:               101,
    enseignant:              teacher._id,
    service:                 service._id,
    date_seance:             new Date('2026-05-01'),
    heure_debut:             '09:00',
    heure_fin:               '11:00',
    nombre_max_participants: 5,
    type_seance:             'presentiel',
    statut:                  'en_attente',
    etudiants:               []
  });

  console.log("Séance créée :", seance);
  await mongoose.disconnect();
};

run();