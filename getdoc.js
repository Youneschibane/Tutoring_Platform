require('dotenv').config(); // <-- Ajoutez cette ligne tout en haut !
const mongoose = require('mongoose');
const Document = require('./models/documentModel');

// Maintenant process.env fonctionnera
const MONGO_URI = process.env.MONGO_URI;

const getAllDocuments = async () => {
  try {
    // 2. Connexion à la base de données
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connexion à MongoDB réussie.");

    // 3. Récupération des données
    const documents = await Document.find().populate('seance');
    
    // Affichage des résultats
    console.log(`✅ ${documents.length} document(s) récupéré(s) avec succès :`);
    console.log(JSON.stringify(documents, null, 2)); // Affichage formaté pour mieux lire dans la console

  } catch (error) {
    console.error("❌ Erreur lors de la récupération des documents :", error);
  } finally {
    // 4. Déconnexion de la base de données
    // Obligatoire, sinon le terminal restera bloqué sur ce script
    await mongoose.connection.close();
    console.log("🔌 Connexion à MongoDB fermée.");
  }
};

// 5. L'appel réel de la fonction (les parenthèses sont obligatoires)
getAllDocuments();