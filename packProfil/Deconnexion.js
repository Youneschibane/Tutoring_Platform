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


/**
 * Get all active devices for the logged-in user
 */
exports.getMyDevices = async (req, res) => {
  try {
    const userId = req.user._id;
    // We search for devices belonging to the user that are marked as active
    // and optionally have a jwtToken (meaning they are logged in)
    const devices = await Device.find({ 
      userId, 
      isActive: true,
      jwtToken: { $ne: null } 
    }).sort({ lastUsed: -1 });

    // Enhance the response to tell the frontend which device is the current one
    const currentDeviceToken = req.headers['x-device-token'] || req.body?.deviceToken;

    const formattedDevices = devices.map(device => ({
      id: device._id,
      deviceName: device.deviceName,
      location: device.location,
      ipAddress: device.ipAddress,
      lastUsed: device.lastUsed,
      createdAt: device.createdAt,
      isCurrentDevice: device.deviceToken === currentDeviceToken,
      notificationsEnabled: device.notificationsEnabled
    }));

    return res.status(200).json({
      status: 'success',
      results: formattedDevices.length,
      data: {
        devices: formattedDevices
      }
    });

  } catch (error) {
    console.error('Get devices error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Erreur lors de la récupération des appareils.' 
    });
  }
};

