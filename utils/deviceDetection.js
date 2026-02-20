const Device = require('../models/deviceModel');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('./sendEmail');

const handleDeviceDetection = async ({ user, req, res }) => {
  try {
   
 
    let deviceToken = req.headers['x-device-token'] || req.body?.deviceToken;
    const currentIP = req.ip;
    const currentUserAgent = req.headers['user-agent'];

    let device = null;
    let isNewDevice = false;

    // Check if device exists
    if (deviceToken) {
      device = await Device.findOne({
        user: user._id,
        deviceToken
      });
    }

    // If device not found → create new one
    if (!device) {
      isNewDevice = true;
      deviceToken = uuidv4();

      device = await Device.create({
        user: user._id,
        deviceToken,
        ipAddress: currentIP,
        userAgent: currentUserAgent,
        lastUsed: new Date()
      });

      // Send email notification (wee dont block login)
      if (user.email) {
        await sendEmail({
          email: user.email,
          subject: 'Nouvelle connexion détectée',
          message: `
Nouvelle connexion détectée.

IP: ${currentIP}
Navigateur: ${currentUserAgent}

Si ce n'est pas vous, sécurisez votre compte.
          `
        });
      }


    } else {
      // Known device → update info
      device.lastUsed = new Date();
      device.ipAddress = currentIP;
      await device.save();
    }

    return { device, isNewDevice };

  } catch (error) {
    console.error('Device detection error:', error);
    return null; // Never block login
  }
};

module.exports = handleDeviceDetection;
