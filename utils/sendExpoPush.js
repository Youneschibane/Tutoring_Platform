const { Expo } = require('expo-server-sdk');
const expo     = new Expo();
const Device   = require('../models/deviceModel');

const sendExpoPush = async (expoPushToken, { title, body, url = '/', extra = {} }) => {
  console.log('sendExpoPush appelé avec token:', expoPushToken);

  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error('Token invalide:', expoPushToken);
    return;
  }

  const device = await Device.findOne({ deviceToken: expoPushToken, isActive: true });
  if (!device) {
    console.log('Device not found or inactive — push not sent');
    return;
  }

  if (device.notificationsEnabled === false) {
    console.log('Notifications disabled for this device — push not sent');
    return;
  }

  try {
    const tickets = await expo.sendPushNotificationsAsync([{
      to:    expoPushToken,
      sound: 'default',
      title,
      body,
      data:  { url, ...extra },
    }]);
    console.log('Tickets reçus:', JSON.stringify(tickets));
  } catch (error) {
    console.error('Erreur envoi:', error);
  }
};

module.exports = sendExpoPush;