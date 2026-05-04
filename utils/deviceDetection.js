const Device = require('../models/deviceModel');
const { v4: uuidv4 } = require('uuid');
const { sendEmail } = require('./sendEmail');
const sendSms = require('./sendSMS');
const UAParser = require('ua-parser-js');
const geoip = require('geoip-lite');

const handleDeviceDetection = async ({ user, req }) => {
  try {
    const { email: contactEmail, phone: contactPhone } = req.body || {};

    // 
    const currentIP =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket?.remoteAddress ||
      req.ip;

    const userAgent = req.headers['user-agent'] || '';

    // 
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name  ||'Unknown Browser';
    const os = parser.getOS().name || 'Unknown OS';
    const deviceName = `${browser} on ${os}`;

    const geo = geoip.lookup(currentIP);
    const location = geo?.country || 'Unknown';

    let deviceToken = req.headers['x-device-token'];
    let device = null;
    let isNewDevice = false;

    // ─────────────────────────────
    // FIND DEVICE
    // ─────────────────────────────
    if (deviceToken) {
      device = await Device.findOne({
        userId: user._id,
        deviceToken
      });
    }

    // ─────────────────────────────
    // REACTIVATE OLD DEVICE
    // ─────────────────────────────
    if (device && !device.isActive) {
      device.isActive = true;
    }

    // ─────────────────────────────
    // CREATE NEW DEVICE
    // ─────────────────────────────
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
        isActive: true,
        lastUsed: new Date()
      });

      const contact = contactEmail || contactPhone || user.email;
      const message = 
`Nouvelle connexion détectée :

📱 Appareil : ${deviceName}
🌍 Localisation : ${location}
🌐 IP : ${currentIP}
      ;`

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
      } catch (e) {
        console.error('Notification error:', e);
      }
    }

    // ─────────────────────────────
    // UPDATE EXISTING DEVICE
    // ─────────────────────────────
    else {
      device.lastUsed = new Date();
      device.ipAddress = currentIP;
      device.userAgent = userAgent;
      device.deviceName = deviceName;
      device.location = location;

      await device.save();
    }

    //  return token so frontend can reuse it
    return {
      device,
      isNewDevice,
      deviceToken
    };

  } catch (error) {
    console.error('Device detection error:', error);
    return null;
  }
};

module.exports = handleDeviceDetection;