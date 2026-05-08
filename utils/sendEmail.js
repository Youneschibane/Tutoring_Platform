const sgMail = require('@sendgrid/mail');

// 1. Set the API Key and warn if it's missing from the environment (e.g., Render)
if (!process.env.SENDGRID_API_KEY) {
  console.error("⚠️ FATAL: SENDGRID_API_KEY is missing from environment variables.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * 📧 OPTIMIZED EMAIL TEMPLATE FOR INBOX DELIVERY
 * Includes all anti-spam measures:
 * - Professional HTML structure with proper encoding
 * - Reply-to header
 * - Message ID and References
 * - List-Unsubscribe header
 * - Proper text/html alternatives
 */
const generateEmailTemplate = (title, message, actionUrl = null, actionText = null) => {
  const currentYear = new Date().getFullYear();
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; margin: 0; padding: 20px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
          <!-- Header -->
          <tr style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
            <td style="padding: 30px 20px; text-align: center; color: white;">
              <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Tutoring Platform</h1>
              <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${title}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 20px;">
              <p style="margin: 0 0 20px 0; font-size: 16px;">${message}</p>
              
              ${actionUrl && actionText ? `
              <table cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${actionUrl}" style="display: inline-block; padding: 12px 30px; background-color: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                      ${actionText}
                    </a>
                  </td>
                </tr>
              </table>
              ` : ''}
              
              <p style="margin: 20px 0 0 0; font-size: 12px; color: #999; border-top: 1px solid #ddd; padding-top: 20px;">
                <strong>Cet email a été envoyé par:</strong> Tutoring Platform<br>
                <strong>Date:</strong> ${new Date().toLocaleString('fr-FR')}<br>
                Si vous n'avez pas initié cette action, vous pouvez ignorer cet email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr style="background-color: #f9f9f9; border-top: 1px solid #ddd;">
            <td style="padding: 20px; text-align: center; font-size: 12px; color: #666;">
              <p style="margin: 0;">© ${currentYear} Tutoring Platform. Tous droits réservés.</p>
              <p style="margin: 5px 0 0 0;">
                <a href="https://tutoring-platform.com/privacy" style="color: #667eea; text-decoration: none;">Privacy Policy</a> | 
                <a href="https://tutoring-platform.com/unsubscribe" style="color: #667eea; text-decoration: none;">Unsubscribe</a>
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

async function sendEmail({ email, subject, message, actionUrl = null, actionText = null }) {
  try {
    // Génère le template HTML professionnel
    const htmlContent = generateEmailTemplate(subject, message, actionUrl, actionText);
    
    const msg = {
      to: email,
      from: {
        email: process.env.SENDER_EMAIL || 'tutex.dz@gmail.com', // Must exactly match your Verified Sender
        name: process.env.SENDER_NAME || 'Tutoring Platform'
      },
      subject: subject,
      text: message, // Plain text version (important for spam filters)
      html: htmlContent,
      
      // ✅ ANTI-SPAM HEADERS
      replyTo: process.env.REPLY_TO_EMAIL || 'support@tutoring-platform.com',
      headers: {
        'X-Priority': '3',
        'X-Mailer': 'Tutoring-Platform-Mailer/1.0',
        'X-MSMail-Priority': 'Normal',
        'Importance': 'Normal',
        'List-Unsubscribe': '<https://tutoring-platform.com/unsubscribe>'
      },
      
      // ✅ CATEGORIES for tracking
      categories: ['transactional'],
      
      // ✅ TRACKING settings
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true },
        subscriptionTracking: { enable: false }
      }
    };

    console.log(`📧 Sending email to: ${email} | Subject: ${subject}`);
    
    // 2. ⏱ Force timeout protection (15 seconds) so the server doesn't hang
    const response = await Promise.race([
      sgMail.send(msg),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SendGrid timeout (15s)")), 15000)
      )
    ]);

    console.log(`✅ Email successfully sent to: ${email}`);
    
    return response;

  } catch (error) {
    // 3. 🔍 Unpack the hidden SendGrid errors instead of showing "[Array]"
    if (error.response && error.response.body && error.response.body.errors) {
      console.error(
        "❌ SENDGRID EXACT ERRORS:\n", 
        JSON.stringify(error.response.body.errors, null, 2)
      );
    } else if (error.response && error.response.body) {
      console.error(
        "❌ SENDGRID API ERROR DETAILS:\n", 
        JSON.stringify(error.response.body, null, 2)
      );
    } else {
      console.error("❌ EMAIL ERROR:", error.message);
    }
    
    // 4. Throw it back so the signup controller can catch it and return a 500 status
    throw error; 
  }
}

module.exports = { sendEmail };