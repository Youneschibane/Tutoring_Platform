// utils/sendEmail.js
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail({ email, subject, message }) {
  // Fallback dev mode si pas de clé
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV MODE] Mail vers: ${email} | Sujet: ${subject}`);
    console.log(message);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: `Mon App <${process.env.EMAIL_FROM}>`,
    to: email,
    subject,
    text: message,
    ...(message.includes('<') && { html: message })
  });

  if (error) {
    console.error('❌ Resend error:', error);
    throw new Error(error.message); // ← propagation de l'erreur
  }

  console.log(`✅ Mail envoyé à ${email} (id: ${data.id})`);
}

module.exports = { sendEmail };