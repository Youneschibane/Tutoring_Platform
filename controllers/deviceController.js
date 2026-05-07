const Device = require('../models/deviceModel');

const revokeOtherDevices = async (req, res) => {
  try {
    // For native apps, expect current device token in header or body
    const currentDeviceToken = req.headers['x-device-token']  || req.body?.deviceToken;

    if (!currentDeviceToken) {
      return res.status(400).json({ message: 'Current device token required in x-device-token header or deviceToken body.' });
    }

    await Device.deleteMany({ userId: req.user._id, deviceToken: { $ne: currentDeviceToken } });

    return res.status(200).json({
      message: 'All other devices revoked successfully.'
    });

  } catch (error) {
    console.error('Revoke error:', error);
    return res.status(500).json({
      message: 'Server error while revoking devices.'
    });
  }
};

const deviceToken = async (req, res) => {
  try {
    const { deviceToken } = req.body;

    if (!deviceToken) {
      return res.status(400).json({ message: 'deviceToken est requis.' });
    }

    await Device.findOneAndUpdate(
      { 
        $or: [
          { deviceToken: deviceToken },
          { userId: req.user._id, deviceToken: /^pending_/ }
        ]
      },
      {
        userId: req.user._id,
        deviceToken,
        isActive: true,
        lastUsed: new Date(),
        userAgent: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown',
      },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: 'Push token registered.' });

  } catch (error) {
    console.error('deviceToken error:', error.message); // ✅ tu verras l'erreur exacte
    res.status(500).json({ message: error.message });
  }
};

const toggleNotifications = async (req, res) => {
  try {
    const userId  = req.user._id;
    const { enabled } = req.body; // true or false

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        status:  'fail',
        message: "Le champ 'enabled' doit être un booléen (true ou false)."
      });
    }

    const result = await Device.updateMany(
      { userId, isActive: true },
      { notificationsEnabled: enabled }
    );

    return res.status(200).json({
      status:  'success',
      message: enabled
        ? 'Notifications activées avec succès.'
        : 'Notifications désactivées avec succès.',
      devicesUpdated: result.modifiedCount
    });

  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};

module.exports = {
  revokeOtherDevices,
  deviceToken,
  toggleNotifications
};