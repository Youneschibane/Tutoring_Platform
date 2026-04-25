const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const teacherRoutes = require('./routes/searchRoutes');
const reservationRoutes=require('./routes/reserveSession')
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');
const devisRouter = require('./routes/devisRoutes');
const specialtyRouter = require('./routes/specialityRouter');
const locationRoutes = require('./routes/locationRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes');
const statistic = require('./routes/profRoutes')
const app = express();

// =====================
// GLOBAL MIDDLEWARES
// =====================
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev')); // logs requests in console

// =====================
// ROUTES
// =====================
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/search', teacherRoutes);
//reserve session for student 
app.use('/api/session',reservationRoutes);

//demander in devis
app.use('/api/devis', devisRouter);

app.use('/api/specialties', specialtyRouter);

// La page de doc sera disponible sur http://localhost:3000/api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use('/api/location' , locationRoutes);

// router pour les services
app.use('/api/service' , serviceRoutes);


//router pour les documents
app.use('/api/documents', documentRoutes); 

//router pour l admin
app.use('/api/admin', adminRoutes);

//router pour les statistic de prof
app.use('/api/prof', statistic)
// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

module.exports = app;