const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../firebase-key.json'))
});

const sendPush = async (fcmToken, { title, body, url = '/', extra = {} }) => {
  await admin.messaging().send({
    token: fcmToken,
    notification: { title, body },
    data: { url, ...extra }   
  });
};

module.exports = sendPush;