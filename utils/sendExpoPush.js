const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendExpoPush = async (expoPushToken, { title, body, url = '/', extra = {} }) => {
  if (!Expo.isExpoPushToken(expoPushToken)) {
    console.error('❌ Token invalide:', expoPushToken);
    return;
  }

  try {
    const tickets = await expo.sendPushNotificationsAsync([{
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: { url, ...extra },
    }]);
    console.log('✅ Notification envoyée:', tickets);
  } catch (error) {
    console.error('❌ Erreur envoi:', error);
  }
};

module.exports = sendExpoPush;