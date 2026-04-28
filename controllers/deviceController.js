const Device = require('../models/deviceModel');

const revokeOtherDevices = async (req, res) => {
  try {
    // For native apps, expect current device token in header or body
    const currentDeviceToken = req.headers['x-device-token'] || req.body?.deviceToken;

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
  const { deviceToken } = req.body;

  await Device.findOneAndUpdate(
    { 
      $or: [
        { deviceToken: deviceToken },
        { userId: req.user._id, deviceToken: /^pending_/ } // ← remplace le pending
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
};


module.exports = {
  revokeOtherDevices,
  deviceToken
};