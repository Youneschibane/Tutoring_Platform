require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const { initializeCronJobs, stopCronJobs } = require('./utils/cronService');

const mongoURI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// 1. Démarrer le serveur IMMÉDIATEMENT
// Cela évite que Render ne "timeout" en attendant la base de données
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    
    // 2. Connexion à MongoDB après le démarrage du serveur
    console.log('Connecting to MongoDB...');
    mongoose.connect(mongoURI)
        .then(() => {
            console.log('✓ MongoDB connected');
            
            // 3. Initialiser les tâches de fond une fois la DB connectée
            console.log('Initializing background jobs...');
            try {
                initializeCronJobs();
                console.log('✓ Background jobs initialized successfully\n');
            } catch (error) {
                console.error('⚠️ Failed to initialize background jobs:', error.message);
            }
        })
        .catch(err => {
            console.error('❌ MongoDB connection error:', err);
            // On ne coupe pas forcément le serveur ici, 
            // pour permettre à l'admin de voir les logs.
        });
});

// --- Gestion propre de la fermeture (Graceful Shutdown) ---
const handleShutdown = (signal) => {
    console.log(`\n📍 ${signal} received, shutting down gracefully...`);
    stopCronJobs();
    server.close(() => {
        console.log('✓ Server closed');
        mongoose.connection.close(false, () => {
            console.log('✓ MongoDB connection closed');
            process.exit(0);
        });
    });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));