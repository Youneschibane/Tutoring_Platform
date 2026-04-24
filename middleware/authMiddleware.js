const jwt     = require('jsonwebtoken');
const User    = require('../models/userModel');
const Teacher = require('../models/teacherModel');
const Device  = require('../models/deviceModel');

const protect = async (req, res, next) => {
  try {
    // 1. Extract token
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'fail', message: "Non authentifié. Token manquant." });
    }

    // 2. Verify token signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check user exists
    const user = await User.findById(decoded.id)
      .select('+passwordChangedAt +isActive');
    if (!user) {
      return res.status(401).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    // 4. Invalidate tokens issued before password change (disconnects all other devices)
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ status: 'fail', message: "Session expirée suite à un changement de mot de passe. Reconnectez-vous." });
    }

 

    // 6. Verify token is still active for this specific device
    const activeDevice = await Device.findOne({
      userId: user._id,
      jwtToken: token,  // exact match — only the current active token is valid
      isActive: true
    }).select('deviceToken deviceName');

    if (!activeDevice) {
      return res.status(401).json({ status: 'fail', message: "Session invalide ou expirée. Reconnectez-vous." });
    }

    // 7. Check teacher approval (only for teachers) — with bypass for status check
    if (user.role === 'teacher' && !req.skipAcceptedCheck) {
      const teacher = await Teacher.findOne({ id_enseignant: user.idmembre }).select('accepted');
      if (!teacher || !teacher.accepted) {
        return res.status(403).json({ status: 'fail', message: "Compte en attente d'approbation par l'administrateur." });
      }
    }

    req.user   = user;
    req.device = activeDevice; // available in all controllers
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'fail', message: "Token invalide." });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'fail', message: "Token expiré. Reconnectez-vous." });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
};




















const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ status: 'fail', message: "Vous n'avez pas la permission d'effectuer cette action." });
    }
    next();
  };
};

/**
 * skipAcceptedCheck: Middleware optionnel pour bypasser la vérification d'acceptation
 * S'utilise AVANT protect() pour permettre aux enseignants non acceptés de consulter leur statut
 * Exemple: router.get('/me/status', skipAcceptedCheck, protect, getMyStatus);
 */
const skipAcceptedCheck = (req, res, next) => {
  req.skipAcceptedCheck = true;
  next();
};






const protectReactivate = async (req, res, next) => {
  try {
    // 1. Extract token
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ status: 'fail', message: "Non authentifié. Token manquant." });
    }

    // 2. Verify token signature
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check user exists
    const user = await User.findById(decoded.id)
      .select('+passwordChangedAt +isActive');
    if (!user) {
      return res.status(401).json({ status: 'fail', message: "Utilisateur introuvable." });
    }

    // 4. Invalidate tokens issued before password change (disconnects all other devices)
    if (user.passwordChangedAt && decoded.iat * 1000 < user.passwordChangedAt.getTime()) {
      return res.status(401).json({ status: 'fail', message: "Session expirée suite à un changement de mot de passe. Reconnectez-vous." });
    }



    // 6. Verify token is still active for this specific device
    const activeDevice = await Device.findOne({
      userId: user._id,
      jwtToken: token,  // exact match — only the current active token is valid
      isActive: true
    }).select('deviceToken deviceName');

    if (!activeDevice) {
      return res.status(401).json({ status: 'fail', message: "Session invalide ou expirée. Reconnectez-vous." });
    }

  

    req.user   = user;
    req.device = activeDevice; // available in all controllers
    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ status: 'fail', message: "Token invalide." });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ status: 'fail', message: "Token expiré. Reconnectez-vous." });
    }
    return res.status(500).json({ status: 'error', message: error.message });
  }
};











module.exports = { protect, restrictTo, skipAcceptedCheck ,protectReactivate };