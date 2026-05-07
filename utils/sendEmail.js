const nodemailer = require('nodemailer');

async function sendEmail({ email, subject, message }) {
  // Configuration du transporteur en utilisant les variables d'environnement
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,    // smtp.gmail.com
    port: process.env.SMTP_PORT,    // 587
    secure: true,                  // false pour le port 587 (STARTTLS)éétrue pour le port 465 (SSL/TLS)
    auth: {
      user: process.env.SMTP_USER,  // Votre adresse Gmail
      pass: process.env.SMTP_PASS   // Votre mot de passe d'application (16 caractères)
    }
  });

  const mailOptions = {
    from: `"Mon App" <${process.env.SMTP_USER}>`,
    to: email,
    subject: subject,
    text: message,
    // Permet d'envoyer du HTML si le message contient des balises
    ...(message.includes('<') && { html: message })
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email envoyé à ${email} | ID: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi via Nodemailer :', error);
    throw error;
  }
}

module.exports = { sendEmail };