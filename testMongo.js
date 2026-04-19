const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const Service = require('./models/serviceModel');
    const services = await Service.find().limit(5);
    const out = services.map(s => ({
      nom_service: s.nom_service,
      prix: s.prix,
      typeof_prix: typeof s.prix,
      niveau_concerne: s.niveau_concerne,
      matiere: s.matiere,
      type_service: s.type_service
    }));
    fs.writeFileSync('test.json', JSON.stringify(out, null, 2));
    process.exit(0);
  })
  .catch(err => console.error(err));
