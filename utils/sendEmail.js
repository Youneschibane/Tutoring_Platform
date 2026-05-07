

const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendEmail({ email, subject, message }) {
  try {
    const msg = {
      to: email,
      from: {
        email: 'tutex.dz@gmail.com', // Rappel : l'authentification domaine reste cruciale pour le spam
        name: 'My Tutoring Platform'
      },
      replyTo: 'tutex.dz@gmail.com',
      subject: subject || 'Votre code Tutex',
      text: `Votre code de vérification : ${message}`, // Version texte brut pour les montres connectées/notifs
      html: `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          /* Styles spécifiques pour mobile */
          @media only screen and (max-width: 480px) {
            .container { width: 100% !important; border-radius: 0 !important; margin: 0 !important; }
            .otp-box { font-size: 32px !important; letter-spacing: 4px !important; padding: 20px 10px !important; }
            .content { padding: 20px !important; }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7fa; -webkit-text-size-adjust: 100%;">
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              
              <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="450" class="container" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e1e8ed;">
                
                <tr>
                  <td align="center" style="padding: 30px 20px; background-color: #4f46e5;">
                    <span style="color: #ffffff; font-family: sans-serif; font-size: 24px; font-weight: bold; letter-spacing: 1px;">
                      Tutex
                    </span>
                  </td>
                </tr>

                <tr>
                  <td class="content" style="padding: 40px 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
                    <h2 style="color: #1a202c; font-size: 20px; font-weight: 700; margin: 0 0 15px 0; text-align: center;">
                      Code de vérification
                    </h2>
                    
                    <p style="color: #4a5568; font-size: 15px; line-height: 1.5; text-align: center; margin-bottom: 30px;">
                      Utilisez le code ci-dessous pour sécuriser votre accès.
                    </p>

                    <div style="text-align: center; margin-bottom: 30px;">
                      <div class="otp-box" style="
                        display: inline-block;
                        padding: 15px 25px;
                        background-color: #f8fafc;
                        border: 2px solid #4f46e5;
                        border-radius: 8px;
                        color: #1a202c;
                        font-family: 'Courier New', monospace;
                        font-size: 36px;
                        font-weight: bold;
                        letter-spacing: 5px;
                      ">
                        ${message}
                      </div>
                    </div>

                    <p style="color: #e53e3e; font-size: 13px; text-align: center; font-weight: 500;">
                      ⏳ Expire dans 5 minutes
                    </p>

                    <div style="border-top: 1px solid #edf2f7; margin-top: 30px; padding-top: 20px;">
                      <p style="color: #a0aec0; font-size: 12px; text-align: center; line-height: 1.4;">
                        Si vous n'avez pas demandé ce code, ignorez simplement cet e-mail.
                      </p>
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 20px; background-color: #f7fafc; text-align: center;">
                    <p style="color: #718096; font-size: 11px; margin: 0;">
                      © ${new Date().getFullYear()} Tutex Inc.
                    </p>
                  </td>
                </tr>
                
              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
      `
    };

    const response = await sgMail.send(msg);
    console.log("📩 Email mobile-ready envoyé à :", email);
    return response;
  } catch (error) {
    console.error("❌ SendGrid ERROR:", error.response?.body || error.message);
    throw error;
  }
}

module.exports = { sendEmail };