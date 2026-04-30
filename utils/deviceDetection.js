const Device = require('../models/deviceModel');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('./sendEmail');
const sendSms = require('./sendSMS');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

const handleDeviceDetection = async ({ user, req }) => {
  try {
    // Get contact info from request
    const { email: contactEmail, phone: contactPhone } = req.body || {};

    // Device token from headers or request body
    let deviceToken = req.headers['x-device-token'] || req.body?.deviceToken;
    const currentIP = req.ip;
    const userAgent = req.headers['user-agent'];

    // Parse device name
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name  ||'Unknown Browser';
    const os = parser.getOS().name || 'Unknown OS';
    const deviceName = `${browser} on ${os}`;

    // Get location from IP
    const geo = geoip.lookup(currentIP);
    const location = geo?.country || 'Unknown location';

    let device = null;
    let isNewDevice = false;

    // Check if device exists
    if (deviceToken) {
      device = await Device.findOne({
        userId: user._id,
        deviceToken
      });
    }

    // If device is new → create
    if (!device) {
      isNewDevice = true;
      deviceToken = uuidv4();

      device = await Device.create({
        userId: user._id,
        deviceToken,
        ipAddress: currentIP,
        userAgent,
        deviceName,
        location,
        lastUsed: new Date()
      });

      // Prepare notification
      const contact = contactEmail || contactPhone || user.email;
      const message = 
`Nouvelle connexion détectée :

📱 Appareil : ${deviceName}
🌍 Localisation : ${location}
🌐 IP : ${currentIP}
      ;`

      // Send notification safely
      if (contact) {
        try {
          if (contactEmail || user.email) {
            await sendEmail({
              email: contact,
              subject: 'Nouvelle connexion détectée',
              message
            });
          } else if (contactPhone) {
            await sendSms({
              phone: contact,
              message
            });
          }
        } catch (notifyError) {
          console.error('Notification error:', notifyError);
          // Never block login
        }
      }

    } else {
      // Existing device → update info
      device.lastUsed = new Date();
      device.ipAddress = currentIP;
      device.userAgent = userAgent;
      device.deviceName = deviceName;
      device.location = location;

      await device.save();
    }

    return { device, isNewDevice };

  } catch (error) {
    console.error('Device detection error:', error);
    return null; // Never block login
  }
};

module.exports = handleDeviceDetection;