const nodemailer = require('nodemailer');

async function sendEmail({ email, subject, message }) {
  // If SMTP config is not provided, fall back to console logging (dev)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[sendEmail] To:${email} Subject:${subject} Message:${message}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port: port ? Number(port) : 587,
    secure: false,
    auth: { user, pass }
  });

  await transporter.sendMail({
    from: user,
    to: email,
    subject,
    text: message
  });
}

module.exports = { sendEmail };
