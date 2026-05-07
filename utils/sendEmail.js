const sgMail = require('@sendgrid/mail');

// 1. Set the API Key and warn if it's missing from the environment (e.g., Render)
if (!process.env.SENDGRID_API_KEY) {
  console.error("⚠️ FATAL: SENDGRID_API_KEY is missing from environment variables.");
} else {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendEmail({ email, subject, message }) {
  try {
    const msg = {
      to: email,
      from: {
        email: 'tutex.dz@gmail.com', // Must exactly match your Verified Sender
        name: 'My Tutoring Platform'
      },
      subject: subject,
      text: message,
      html: `<p>${message}</p>`
    };

    // 2. ⏱ Force timeout protection (10 seconds) so the server doesn't hang
    const response = await Promise.race([
      sgMail.send(msg),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("SendGrid timeout")), 10000)
      )
    ]);

    console.log(`📩 Email sent successfully to: ${email}`);
    
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