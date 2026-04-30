const { Expo } = require('expo-server-sdk');
const expo = new Expo();

const sendExpoPush = async (expoPushToken, { title, body, url = '/', extra = {} }) => {
  console.log('📨 sendExpoPush appelé avec token:', expoPushToken);
  
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
    console.log('✅ Tickets reçus:', JSON.stringify(tickets));
  } catch (error) {
    console.error('❌ Erreur envoi:', error);
  }
};

module.exports = sendExpoPush;