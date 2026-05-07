const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail({ email, subject, message }) {
  try {
    const msg = {
      to: email,
      from: {
        email: 'tutex.dz@gmail.com',
        name: 'My Tutoring Platform'
      },
      subject,
      text: message,
      html: `<p>${message}</p>`
    };

    // ⏱ important: force timeout protection
    const response = await Promise.race([
      sgMail.send(msg),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SendGrid timeout")), 10000)
      )
    ]);

    console.log("📩 Email sent");

    return response;

  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.message);
    throw error;
  }
}

module.exports = { sendEmail };