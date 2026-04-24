const Device = require('../models/deviceModel');

// Logout current device only
exports.logout = async (req, res) => {
  try {
    await Device.findByIdAndUpdate(req.device._id, {
      jwtToken: null,
      isActive: false,
      lastUsed: new Date()
    });

    return res.status(200).json({
      status: 'success',
      message: "Déconnexion réussie."
    });

  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Logout ALL OTHER devices — keeps current device active
exports.logoutOtherDevices = async (req, res) => {
  try {
    // Exclude current device using req.device._id
    await Device.updateMany(
      { 
        userId: req.user.id,
        _id: { $ne: req.device._id }  // ← all devices EXCEPT current one
      },
      { jwtToken: null, isActive: false, lastUsed: new Date() }
    );

    return res.status(200).json({
      status: 'success',
      message: "Déconnecté de tous les autres appareils. Session actuelle maintenue."
    });

  } catch (error) {
    console.error('LogoutOtherDevices error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

// Logout ALL devices including current one
exports.logoutAll = async (req, res) => {
  try {
    await Device.updateMany(
      { userId: req.user.id },
      { jwtToken: null, isActive: false, lastUsed: new Date() }
    );

    return res.status(200).json({
      status: 'success',
      message: "Déconnecté de tous les appareils."
    });

  } catch (error) {
    console.error('LogoutAll error:', error);
    return res.status(500).json({ status: 'error', message: error.message });
  }
};