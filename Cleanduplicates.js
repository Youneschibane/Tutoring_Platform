/**
 * cleanDuplicates.js
 * 
 * Script pour supprimer tous les doublons dans :
 *   - users        (champ: email, numberphone)
 *   - students     (champ: email, numberphone)
 *   - teachers     (champ: email, numberphone)
 * 
 * Usage :
 *   node cleanDuplicates.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI
// ─── Connexion ───────────────────────────────────────────────────────────────

async function connect() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connecté à MongoDB :', MONGO_URI);
}

// ─── Fonction principale de nettoyage ────────────────────────────────────────

/**
 * Supprime les doublons d'une collection sur un champ donné.
 * Garde le document le plus ANCIEN (premier créé), supprime les suivants.
 *
 * @param {string} collectionName  - nom de la collection MongoDB
 * @param {string} field           - champ sur lequel chercher les doublons
 */
async function cleanDuplicates(collectionName, field) {
  const collection = mongoose.connection.collection(collectionName);

  console.log(`\n🔎 Analyse : collection="${collectionName}" | champ="${field}"`);

  // Trouver tous les groupes ayant plus d'un document pour ce champ
  const duplicates = await collection.aggregate([
    {
      $match: {
        [field]: { $exists: true, $ne: null, $ne: '' }
      }
    },
    {
      $group: {
        _id: `$${field}`,
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        dates: { $push: '$createdAt' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    }
  ]).toArray();

  if (duplicates.length === 0) {
    console.log(`   ✅ Aucun doublon trouvé pour "${field}"`);
    return;
  }

  console.log(`   ⚠️  ${duplicates.length} valeur(s) en doublon trouvée(s) pour "${field}"`);

  let totalDeleted = 0;

  for (const group of duplicates) {
    const value = group._id;
    const ids = group.ids;

    // Récupère les docs triés par date croissante (le plus ancien en premier)
    const docs = await collection
      .find({ [field]: value })
      .sort({ createdAt: 1 })
      .toArray();

    // Garde le premier (plus ancien), supprime les autres
    const [keep, ...toDelete] = docs.map(d => d._id);

    console.log(`   📌 "${field}" = ${value}`);
    console.log(`      → Garde   : ${keep}`);
    console.log(`      → Supprime: ${toDelete.join(', ')}`);

    await collection.deleteMany({ _id: { $in: toDelete } });
    totalDeleted += toDelete.length;
  }

  console.log(`   🗑️  Total supprimé dans "${collectionName}" pour "${field}" : ${totalDeleted}`);
}

// ─── Lancement ───────────────────────────────────────────────────────────────

async function run() {
  try {
    await connect();

    // ── Users ──
    await cleanDuplicates('users', 'email');
    await cleanDuplicates('users', 'numberphone');

    // ── Students ──
    await cleanDuplicates('students', 'email');
    await cleanDuplicates('students', 'numberphone');

    // ── Teachers ──
    await cleanDuplicates('teachers', 'email');
    await cleanDuplicates('teachers', 'numberphone');

    console.log('\n✅ Nettoyage terminé avec succès !');

  } catch (err) {
    console.error('\n❌ Erreur pendant le nettoyage :', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Déconnecté de MongoDB');
  }
}

run();