const express = require('express');
const mongoose = require('mongoose');

// 1. Charge les variables du fichier .env
require('dotenv').config(); 

const app = express();

app.use(express.json());

const reviewRoutes = require('./src/routes/reviewRoutes');
console.log('reviewRoutes chargé:', reviewRoutes);
const reportRoutes = require('./src/routes/reportRoutes');

// 2. Utilise la variable d'environnement MONGO_URI
mongoose.connect(process.env.MONGO_URI)
.then(() => {
    console.log(" Connecté à la base de données MongoDB !");
}).catch((err) => {
    console.error("Erreur de connexion à MongoDB :", err);
});

app.use('/api', reviewRoutes);
app.use('/api', reportRoutes);

// 3. Utilise le PORT défini dans le .env
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(` Serveur démarré avec succès sur le port ${PORT}`);
});