const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

// =====================
// ROUTES IMPORTS
// =====================
const authRoutes            = require('./routes/authRoutes');            // signin, signup, logout
const teacherSearchRoutes   = require('./routes/searchRoutes');          // recherche enseignants
const reservationRoutes     = require('./routes/reserveSession');        // réservation de sessions
const devisRouter           = require('./routes/devisRoutes');           // demandes de devis
const specialtyRouter       = require('./routes/specialityRouter');      // spécialités / matières
const locationRoutes        = require('./routes/locationRoutes');        // géolocalisation
const serviceRoutes         = require('./routes/serviceRoutes');         // services proposés
const documentRoutes        = require('./routes/documentRoutes');        // upload / gestion documents
const packProfilRoutes      = require('./routes/packProfilRoutes');      // profil, mot de passe, suppression compte
const adminDeletionRoutes   = require('./routes/adminDeletionRoutes');   // suppression & archivage admin
const adminTeacherRoutes    = require('./routes/adminTeacherRoutes');    // validation enseignants admin
const teacherStatusRoutes   = require('./routes/teacherStatusRoutes');   // statut validation enseignant

const adminServiceRoutes  = require('./routes/adminServiceRoutes');

const enfantRoutes = require('./routes/enfantRoutes');
// =====================
// SWAGGER DOCS
// =====================
const swaggerUi       = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');

const app = express();

// =====================
// GLOBAL MIDDLEWARES
// =====================
app.use(express.json());        // parse les requêtes JSON
app.use(cookieParser());        // parse les cookies
app.use(morgan('dev'));         // logs des requêtes HTTP en console

// =====================
// ROUTES
// =====================


// app.js
app.use('/api/admin/services', adminServiceRoutes);

// app.js

app.use('/api/enfants', enfantRoutes);

// Auth — inscription, connexion
app.use('/api/auth', authRoutes);

// Recherche — liste et filtre des enseignants
app.use('/api/search', teacherSearchRoutes);

// Sessions — réservation de cours par les élèves
app.use('/api/session', reservationRoutes);

// Devis — demande de devis élève → enseignant
app.use('/api/devis', devisRouter);

// Spécialités — matières et niveaux scolaires
app.use('/api/specialties', specialtyRouter);

// Localisation — recherche géographique
app.use('/api/location', locationRoutes);

// Services 
app.use('/api/service', serviceRoutes);

// Documents — upload et gestion des fichiers
app.use('/api/documents', documentRoutes);

// Pack profil — mise à jour profil, changement mot de passe, suppression compte, deconnection
app.use('/api/pack-profil', packProfilRoutes);

// Admin — suppression et archivage des comptes
app.use('/api/admin/deletion', adminDeletionRoutes);

// Admin — validation des enseignants
app.use('/api/admin/teachers', adminTeacherRoutes);

// Teacher — consultation statut de validation
app.use('/api/teacher', teacherStatusRoutes);

// Documentation API — accessible sur http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));










// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;