const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        message: 'Not authorized, no token.'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: 'User not found.'
      });
    }

    if (user.accepted === false) {
      return res.status(403).json({
        message: "Compte non accepté par l'administrateur."
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Not authorized.'
    });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Vous n'avez pas la permission d'effectuer cette action."
      });
    }
    next();
  };
};

module.exports = {protect, restrictTo};