
const nodemailer = require('nodemailer');

async function sendEmail({ email, subject, message }) {

  const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

  const mailOptions = {
    from: `"Mon App" <${process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: message,
    ...(message.includes('<') && { html: message })
  };

  try {

    await transporter.verify();
    console.log("✅ SMTP connecté");

    const info = await transporter.sendMail(mailOptions);

    console.log(`✅ Email envoyé : ${info.messageId}`);

    return info;

  } catch (error) {

    console.error("❌ SMTP ERROR :", error);

    throw error;
  }
}

module.exports = { sendEmail };