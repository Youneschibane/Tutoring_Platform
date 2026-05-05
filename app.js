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
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes');
const reportRoutes = require('./routes/reportRoutes.js');
const reviewsRoutes = require('./routes/reviewRoutes');
const statistic = require('./routes/profRoutes');
const packProfilRoutes = require('./routes/packProfilRoutes');
const adminDeletionRoutes = require('./routes/adminDeletionRoutes');
const adminDiplomeRoutes = require('./routes/adminDiplomeRoutes');
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

// =====================
// APP INIT
// =====================
const app = express();

// =====================
// TRUST PROXY
// =====================
app.set('trust proxy', 1);

// =====================
// CORS
// =====================
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Autoriser les requêtes sans origine (Postman, apps mobiles, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqué pour l'origine : ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'],
}));

// =====================
// SECURITY HEADERS
// =====================
app.use(helmet());
app.disable('x-powered-by');

// =====================
// STATIC FILES
// =====================
app.use(express.static(__dirname));

// =====================
// REQUEST LOGGER (dev uniquement)
// =====================
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`\x1b[36m[INCOMING] ${req.method} ${req.url}\x1b[0m`);
    next();
  });
}

// =====================
// BODY PARSING
// =====================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// =====================
// SANITIZATION (XSS + NoSQL Injection)
// =====================
const sanitize = (val) => {
  if (typeof val === 'string') return xss(val.replace(/\$/g, ''));
  if (Array.isArray(val)) return val.map(sanitize);
  if (val !== null && typeof val === 'object') {
    return Object.fromEntries(
      Object.entries(val).map(([k, v]) => [k, sanitize(v)])
    );
  }
  return val;
};

app.use((req, res, next) => {
  if (req.body)   req.body   = sanitize(req.body);
  if (req.query)  Object.assign(req.query,  sanitize(req.query));
  if (req.params) Object.assign(req.params, sanitize(req.params));
  next();
});

// =====================
// HPP (HTTP Parameter Pollution)
// =====================
app.use(hpp());

// =====================
// LOGGING
// =====================
app.use(morgan('dev'));

// =====================
// RATE LIMITING
// =====================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'fail', message: 'Trop de requêtes, réessayez plus tard.' },
});

app.use('/api', globalLimiter);

// =====================
// ROUTES
// =====================
app.use('/api/auth',             authRoutes);
app.use('/api/search',           teacherSearchRoutes);
app.use('/api/session',          reservationRoutes);
app.use('/api/devis',            devisRouter);
app.use('/api/specialties',      specialtyRouter);
app.use('/api/location',         locationRoutes);
app.use('/api/service',          serviceRoutes);
app.use('/api/documents',        documentRoutes);
app.use('/api/pack-profil',      packProfilRoutes);
app.use('/api/enfants',          enfantRoutes);
app.use('/api/teacher/diplomes', teacherDocumentRoutes);
app.use('/api/teacher',          teacherStatusRoutes);
app.use('/api/report',           reportRoutes);
app.use('/api/review',           reviewsRoutes);
app.use('/api/prof',             statistic);

// --- Routes Admin ---
app.use('/api/admin/teachers', (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[ADMIN-ROUTE] ${req.method} /api/admin/teachers`);
  }
  next();
}, adminTeacherRoutes);

app.use('/api/admin/diplomes',  adminDiplomeRoutes);
app.use('/api/admin/services',  adminServiceRoutes);
app.use('/api/admin/deletion',  adminDeletionRoutes);
app.use('/api/admin',           adminRoutes);

// =====================
// SWAGGER (dev uniquement)
// =====================
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// =====================
// 404 HANDLER
// =====================
app.use((req, res) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\x1b[31m[404] ${req.method} ${req.url}\x1b[0m`);
  }
  res.status(404).json({ status: 'fail', message: 'Route introuvable.' });
});

// =====================
// GLOBAL ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
  console.error(`\x1b[31m[ERREUR]\x1b[0m`, err);
  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur.' : err.message,
  });
});

// =====================
// EXPORT
// =====================
module.exports = app;

module.exports.setupRoutes = (io) => {
  const conversation = require('./routes/conversations');
  const mail = require('./routes/mails');
  const message = require('./routes/messages');

  app.set('io', io);
  app.use('/api/conversations', conversation);
  app.use('/api/mails',         mail(io));
  app.use('/api/messages',      message(io));
};