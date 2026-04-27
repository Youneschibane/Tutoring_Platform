// =====================
// CORE IMPORTS
// =====================
const express = require('express');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const xss = require('xss'); 
require('dotenv').config();

// =====================
// SECURITY IMPORTS
// =====================
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');

// =====================
// ROUTES IMPORTS
// =====================
const authRoutes = require('./routes/authRoutes');
const teacherSearchRoutes = require('./routes/searchRoutes');
const reservationRoutes = require('./routes/reserveSession');
const devisRouter = require('./routes/devisRoutes');
const specialtyRouter = require('./routes/specialityRouter');
const locationRoutes = require('./routes/locationRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const documentRoutes = require('./routes/documentRoutes');
const packProfilRoutes = require('./routes/packProfilRoutes');
const adminDeletionRoutes = require('./routes/adminDeletionRoutes');
const adminTeacherRoutes = require('./routes/adminTeacherRoutes');
const teacherStatusRoutes = require('./routes/teacherStatusRoutes');
const adminServiceRoutes = require('./routes/adminServiceRoutes');
const enfantRoutes = require('./routes/enfantRoutes');
const teacherDocumentRoutes = require('./routes/teacherDocumentRoutes');

// =====================
// SWAGGER
// =====================
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger-output.json');

const app = express();

// =====================
// TRUST PROXY
// =====================
app.set('trust proxy', 1);

// =====================
// SECURITY HEADERS & CORS
// =====================
app.use(helmet());
app.disable('x-powered-by');
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// =====================
// BODY PARSING
// =====================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// =====================
// SAFE SANITIZATION MIDDLEWARE (FIX)
// =====================
app.use((req, res, next) => {
  const clean = (val) => {
    if (typeof val === 'string') {
      // 1. Basic Mongo Sanitize (remove $ and .)
      let s = val.replace(/[$.]/g, '');
      // 2. XSS Sanitize
      return xss(s);
    }
    if (Array.isArray(val)) return val.map(clean);
    if (val !== null && typeof val === 'object') {
      const newObj = {};
      for (const key in val) {
        newObj[key] = clean(val[key]);
      }
      return newObj;
    }
    return val;
  };

  // Sanitize Body (Writables)
  if (req.body) req.body = clean(req.body);

  // Sanitize Query & Params (Property-only update to avoid Getter error)
  if (req.query) {
    const cleanedQuery = clean(req.query);
    // Delete existing keys and re-assign inside the object 
    // This avoids "req.query = ..." which causes the crash
    Object.keys(req.query).forEach(key => delete req.query[key]);
    Object.assign(req.query, cleanedQuery);
  }
  
  if (req.params) {
    const cleanedParams = clean(req.params);
    Object.assign(req.params, cleanedParams);
  }

  next();
});

app.use(hpp());

// =====================
// LOGGING
// =====================
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// =====================
// RATE LIMITING
// =====================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Trop de requêtes.' }
});

app.use('/api', globalLimiter);

// =====================
// ROUTES
// =====================
app.use('/api/auth', authRoutes);
app.use('/api/search', teacherSearchRoutes);
app.use('/api/session', reservationRoutes);
app.use('/api/devis', devisRouter);
app.use('/api/specialties', specialtyRouter);
app.use('/api/location', locationRoutes);
app.use('/api/service', serviceRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/pack-profil', packProfilRoutes);
app.use('/api/enfants', enfantRoutes);
app.use('/api/teacher/diplomes', teacherDocumentRoutes);
app.use('/api/teacher', teacherStatusRoutes);
app.use('/api/admin/teachers', adminTeacherRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/admin/deletion', adminDeletionRoutes);

// =====================
// SWAGGER
// =====================
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// =====================
// 404 & ERROR HANDLING
// =====================
app.use((req, res) => {
  res.status(404).json({ status: 'fail', message: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`);

  // Mongoose Validation Error
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      status: 'fail',
      message: Object.values(err.errors).map(e => e.message).join(', ')
    });
  }

  // Duplicate Key Error
  if (err.code === 11000) {
    return res.status(400).json({
      status: 'fail',
      message: `${Object.keys(err.keyValue)[0]} déjà utilisé`
    });
  }

  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message
  });
});

module.exports = app;