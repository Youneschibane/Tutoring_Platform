const sgMail = require('@sendgrid/mail');
const dotenv = require('dotenv');

// ── Constantes globales ──────────────────────────────────────────────────────
const PLATFORM_NAME = process.env.SENDER_NAME  || 'Tutoring Platform';
const SENDER_EMAIL  = process.env.SENDER_EMAIL || 'tutex.dz@gmail.com';
const REPLY_TO      = process.env.REPLY_TO_EMAIL || SENDER_EMAIL;

const COLORS = {
  primary     : '#5A67D8',
  primaryDark : '#434190',
  text        : '#2D3748',
  textLight   : '#718096',
  border      : '#E2E8F0',
  background  : '#F7FAFC',
  white       : '#FFFFFF',
};

// ── Vérification des variables d'environnement ───────────────────────────────
const REQUIRED_ENV = ['SENDGRID_API_KEY', 'SENDER_EMAIL', 'SENDER_NAME'];
const missingEnv   = REQUIRED_ENV.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`⚠️  FATAL [${PLATFORM_NAME}]: Variables manquantes → ${missingEnv.join(', ')}`);
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log(`✅ SendGrid initialisé — expéditeur : ${SENDER_EMAIL}`);
}

// ── Template HTML ────────────────────────────────────────────────────────────
const generateEmailTemplate = (title, message, actionUrl = null, actionText = null) => {
  const year = new Date().getFullYear();
  const date = new Date().toLocaleString('fr-FR', {
    dateStyle : 'long',
    timeStyle : 'short'
  });

  const buttonBlock = actionUrl && actionText
    ? `
      <tr>
        <td align="center" style="padding: 28px 0 8px 0;">
          <table cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td bgcolor="${COLORS.primary}" style="background-color:${COLORS.primary};">
                <a href="${actionUrl}"
                   target="_blank"
                   style="display: inline-block;
                          padding: 13px 32px;
                          font-family: Arial, sans-serif;
                          font-size: 14px;
                          font-weight: bold;
                          color: ${COLORS.white};
                          text-decoration: none;
                          letter-spacing: 0.5px;">
                  ${actionText}
                </a>
              </td>
            </tr>
          </table>
          <p style="margin: 10px 0 0 0;
                    font-family: Arial, sans-serif;
                    font-size: 12px;
                    color: ${COLORS.textLight};">
            Ou copiez ce lien :
            <a href="${actionUrl}"
               style="color: ${COLORS.primary}; word-break: break-all;">
              ${actionUrl}
            </a>
          </p>
        </td>
      </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
</head>
<body style="margin:0; padding:0; background-color:${COLORS.background};">

  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         bgcolor="${COLORS.background}"
         style="background-color:${COLORS.background};">
    <tr>
      <td align="center" style="padding: 32px 16px;">

        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px; width:100%;">

          <!-- ── HEADER ─────────────────────────────────────────────────── -->
          <tr>
            <td bgcolor="${COLORS.primaryDark}"
                style="background-color:${COLORS.primaryDark};
                       padding: 32px 24px;
                       text-align: center;">
              <p style="margin: 0;
                        font-family: Arial, sans-serif;
                        font-size: 11px;
                        font-weight: bold;
                        color: rgba(255,255,255,0.7);
                        letter-spacing: 2px;
                        text-transform: uppercase;">
                ${PLATFORM_NAME}
              </p>
              <h1 style="margin: 8px 0 0 0;
                         font-family: Arial, sans-serif;
                         font-size: 22px;
                         font-weight: bold;
                         color: ${COLORS.white};">
                ${title}
              </h1>
            </td>
          </tr>

          <!-- ── BANDE DÉCORATIVE ────────────────────────────────────────── -->
          <tr>
            <td bgcolor="${COLORS.primary}"
                height="4"
                style="background-color:${COLORS.primary}; font-size:0; line-height:0;">
              &nbsp;
            </td>
          </tr>

          <!-- ── CONTENU ─────────────────────────────────────────────────── -->
          <tr>
            <td bgcolor="${COLORS.white}"
                style="background-color:${COLORS.white}; padding: 36px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Message -->
                <tr>
                  <td style="font-family: Arial, sans-serif;
                             font-size: 15px;
                             line-height: 1.7;
                             color: ${COLORS.text};">
                    ${message}
                  </td>
                </tr>

                <!-- Bouton (optionnel) -->
                ${buttonBlock}

                <!-- Séparateur -->
                <tr>
                  <td style="padding-top: 28px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td bgcolor="${COLORS.border}"
                            height="1"
                            style="background-color:${COLORS.border};
                                   font-size:0; line-height:0;">
                          &nbsp;
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Méta-infos -->
                <tr>
                  <td style="padding-top: 20px;
                             font-family: Arial, sans-serif;
                             font-size: 12px;
                             line-height: 1.7;
                             color: ${COLORS.textLight};">
                    <strong style="color:${COLORS.text};">Envoyé par :</strong>
                    ${PLATFORM_NAME}<br>
                    <strong style="color:${COLORS.text};">Date :</strong>
                    ${date}<br><br>
                    Si vous n'avez pas initié cette action, ignorez simplement cet email.
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- ── FOOTER ──────────────────────────────────────────────────── -->
          <tr>
            <td bgcolor="${COLORS.background}"
                style="background-color:${COLORS.background};
                       padding: 20px 32px;
                       text-align: center;
                       font-family: Arial, sans-serif;
                       font-size: 12px;
                       color: ${COLORS.textLight};">
              <p style="margin: 0 0 6px 0;">
                © ${year} ${PLATFORM_NAME} · Tous droits réservés
              </p>
              <p style="margin: 0;">
                <a href="https://tutoring-platform.com/privacy"
                   style="color:${COLORS.primary}; text-decoration:none;">
                  Politique de confidentialité
                </a>
                &nbsp;·&nbsp;
                <a href="https://tutoring-platform.com/unsubscribe"
                   style="color:${COLORS.primary}; text-decoration:none;">
                  Se désabonner
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
};

// ── Envoi d'email ────────────────────────────────────────────────────────────
async function sendEmail({ email, subject, message, actionUrl = null, actionText = null }) {
  if (!process.env.SENDGRID_API_KEY) {
    throw new Error(`[${PLATFORM_NAME}] SENDGRID_API_KEY manquante — email non envoyé`);
  }

  try {
    const msg = {
      to      : email,
      from    : { email: SENDER_EMAIL, name: PLATFORM_NAME },
      replyTo : REPLY_TO,
      subject,
      text    : message,
      html    : generateEmailTemplate(subject, message, actionUrl, actionText),

      headers: {
        'X-Priority'       : '3',
        'X-Mailer'         : `${PLATFORM_NAME}-Mailer/1.0`,
        'X-MSMail-Priority': 'Normal',
        'Importance'       : 'Normal',
        'List-Unsubscribe' : '<https://tutoring-platform.com/unsubscribe>'
      },

      categories: ['transactional'],

      trackingSettings: {
        clickTracking       : { enable: true },
        openTracking        : { enable: true },
        subscriptionTracking: { enable: false }
      }
    };

    console.log(`📧 [${PLATFORM_NAME}] Envoi → ${email} | Sujet : "${subject}"`);

    const response = await Promise.race([
      sgMail.send(msg),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SendGrid timeout (15s)')), 15_000)
      )
    ]);

    console.log(`✅ [${PLATFORM_NAME}] Email envoyé → ${email}`);
    return response;

  } catch (error) {
    const detail = error?.response?.body?.errors
      ?? error?.response?.body
      ?? error.message;

    console.error(`❌ [${PLATFORM_NAME}] Erreur SendGrid:`, JSON.stringify(detail, null, 2));
    throw error;
  }
}

module.exports = { sendEmail };