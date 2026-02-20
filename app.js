const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const authRoutes = require('./routes/authRoutes');
const deviceRoutes = require('./routes/deviceRoutes');

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

// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

module.exports = app;