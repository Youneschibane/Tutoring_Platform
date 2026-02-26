const twilio = require('twilio');

const sendSms = async (options) => {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID, 
    process.env.TWILIO_AUTH_TOKEN
  );

  const messageOptions = {
    body: options.message,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: options.phone
  };

  await client.messages.create(messageOptions);
};

module.exports = sendSms;