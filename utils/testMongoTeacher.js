const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Teacher = require('../models/teacherModel');
    const teachers = await Teacher.find().limit(5);
    const out = teachers.map(t => ({
      id_enseignant: t.id_enseignant,
      rating: t.rating,
      reviewsCount: t.reviewsCount
    }));
    fs.writeFileSync('test_teachers.json', JSON.stringify(out, null, 2));
    process.exit(0);
  })
  .catch(err => console.error(err));
