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
const statistic = require('./routes/profRoutes')

//const conversation = require('./routes/conversations');
//const mail = require('./routes/mails');
//const message = require('./routes/messages');
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

const app = express();


//app.use('/api/conversations' , conversation);
//app.use('/api/mails', mail);
//app.use('/api/messages' , message);

// need to remove it 
app.use(express.static(__dirname));

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
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning'] 
}));

// TRACKER: Log toutes les requêtes entrantes avant tout middleware
app.use((req, res, next) => {
  console.log(`\x1b[36m[INCOMING] ${req.method} ${req.url}\x1b[0m`);
  next();
});

// =====================
// BODY PARSING
// =====================
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// =====================
// SAFE SANITIZATION MIDDLEWARE
// =====================
app.use((req, res, next) => {
  const clean = (val) => {
    if (typeof val === 'string') {
      let s = val.replace(/\$/g, '');
      return xss(s);
    }
    if (Array.isArray(val)) return val.map(clean);
    if (val !== null && typeof val === 'object') {
      const newObj = {};
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          newObj[key] = clean(val[key]);
        }
      }
      return newObj;
    }
    return val;
  };

  if (req.body) req.body = clean(req.body);
  if (req.query) Object.assign(req.query, clean(req.query));
  if (req.params) {
    // TRACKER: Voir si Express a bien identifié l'ID
    console.log('[DEBUG] Params reçus avant clean:', req.params);
    Object.assign(req.params, clean(req.params));
  }

  next();
});

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

// TRACKER: Log avant d'entrer dans les routes admin
app.use('/api/admin/teachers', (req, res, next) => {
    console.log(`[ADMIN-ROUTE] Accès à /api/admin/teachers avec méthode ${req.method}`);
    next();
}, adminTeacherRoutes);

app.use('/api/admin/diplomes', adminDiplomeRoutes);
app.use('/api/admin/services', adminServiceRoutes);
app.use('/api/admin/deletion', adminDeletionRoutes);


//router pour l admin
app.use('/api/admin', adminRoutes);

//router pour les statistic de prof
app.use('/api/prof', statistic);


//app.use('api/report' , reportRoutes);

//app.use('api/review' , reviewsRoutes);

app.use('/api/report', reportRoutes);
app.use('/api/review', reviewsRoutes);

//module.exports = app;
module.exports = app;
module.exports.setupRoutes = (io) => {
  const conversation = require('./routes/conversations');
  const mail = require('./routes/mails');
  const message = require('./routes/messages');
  app.use('/api/conversations', conversation);
  app.use('/api/mails', mail(io));
  app.use('/api/messages', message(io));

app.setupRoutes = (io) => {
  app.set('io', io);
};
}

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
  // TRACKER: Route non trouvée
  console.log(`\x1b[31m[404 NOT FOUND] ${req.method} ${req.url}\x1b[0m`);
  res.status(404).json({ status: 'fail', message: 'Route introuvable' });
});

app.use((err, req, res, next) => {
  // TRACKER: Erreur critique
  console.error(`\x1b[31m[CRITICAL ERROR]\x1b[0m`, err);

  res.status(err.status || 500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Erreur serveur' : err.message
  });
});

module.exports = app;
