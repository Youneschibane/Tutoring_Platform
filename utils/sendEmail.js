const nodemailer = require('nodemailer');

async function sendEmail({ email, subject, message }) {
  const user = process.env.SMTP_USER; // Ton email complet
  const pass = process.env.SMTP_PASS; // TON MOT DE PASSE D'APPLICATION (16 caractères)

  if (!user || !pass) {
    console.log(`[DEV MODE] Mail vers: ${email} | Sujet: ${subject}`);
    return;
  }

  // "service: 'gmail'" configure automatiquement host: smtp.gmail.com et port: 465
  const transporter = nodemailer.createTransport({
    service: 'gmail', 
    auth: { user, pass }
  });

  try {
    await transporter.sendMail({
      from: `"Mon App" <${user}>`,
      to: email,
      subject: subject,
      text: message,
      // Support HTML automatique si le message contient des balises
      html: message.includes('<') ? message : undefined 
    });
    console.log(`✅ Mail envoyé à ${email}`);
  } catch (error) {
    console.error('❌ Erreur SMTP:', error.message);
    
    if (error.message.includes('Invalid login')) {
      console.error("👉 Vérifie que tu utilises un 'Mot de passe d'application' et non ton mot de passe habituel.");
    }
  }
}

module.exports = { sendEmail };