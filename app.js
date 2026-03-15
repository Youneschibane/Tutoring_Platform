const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');
const teacherRoutes = require('./routes/searchRoutes');

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


// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

module.exports = app;