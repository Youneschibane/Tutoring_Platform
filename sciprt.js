require('dotenv').config();
const mongoose = require('mongoose');
const Service  = require('./models/serviceModel');
const User     = require('./models/userModel');

// Corrections de valeurs corrompues en base
const NIVEAU_CORRECTIONS = {
  'Lycée':   'Lycee',
  'Collège': 'College',
  'Primaire': 'Primaire', // ok mais on garde pour être exhaustif
};

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connecté à MongoDB\n');

  const services = await Service.find({
    id_enseignant_mongoose: { $in: [null, undefined] },
    id_enseignant: { $exists: true }
  }).lean();

  console.log(`📦 ${services.length} services à migrer...\n`);

  if (services.length === 0) {
    console.log('Rien à migrer.');
    return await mongoose.disconnect();
  }

  // Récupérer tous les enseignants concernés en une seule query
  const enseignantIds = [...new Set(services.map(s => s.id_enseignant))];
  const users = await User.find({ idmembre: { $in: enseignantIds } })
    .select('_id idmembre firstname familyname')
    .lean();

  const userMap = Object.fromEntries(users.map(u => [u.idmembre, u]));

  let ok = 0, fail = 0, corrected = 0;

  for (const service of services) {
    const user = userMap[service.id_enseignant];

    const update = { $set: {} };

    // Lier l'enseignant
    if (user) {
      update.$set.id_enseignant_mongoose = user._id;
      ok++;
    } else {
      console.warn(`  ⚠️  Enseignant introuvable — id_enseignant=${service.id_enseignant} (service #${service.id_service})`);
      fail++;
    }

    // Corriger niveau_concerne si valeur corrompue
    const niveauFixe = NIVEAU_CORRECTIONS[service.niveau_concerne];
    if (niveauFixe && niveauFixe !== service.niveau_concerne) {
      update.$set.niveau_concerne = niveauFixe;
      console.log(`  🔧 Correction niveau : "${service.niveau_concerne}" → "${niveauFixe}" (service #${service.id_service})`);
      corrected++;
    }

    if (Object.keys(update.$set).length > 0) {
      await Service.updateOne({ _id: service._id }, update);
    }
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Migration terminée
   Enseignants liés   : ${ok}
   Introuvables       : ${fail}
   Niveaux corrigés   : ${corrected}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('❌ Erreur migration :', err.message);
  process.exit(1);
});