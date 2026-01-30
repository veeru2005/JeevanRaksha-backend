const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Check if Resend API key is available
const useResend = !!process.env.RESEND_API_KEY;

// Resend client (HTTP-based, works even if SMTP is blocked)
let resendClient;
if (useResend) {
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

// Fallback to SMTP (Gmail) if Resend is not configured
const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
const port = process.env.EMAIL_PORT ? Number(process.env.EMAIL_PORT) : 465;
const secure = process.env.EMAIL_SECURE ? process.env.EMAIL_SECURE === 'true' : true;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendEmail({ to, subject, html, text, from }) {
  try {
    // Try Resend first (works with blocked SMTP ports)
    if (useResend && resendClient) {
      console.log('📧 Sending email via Resend (HTTP API)...');
      const result = await resendClient.emails.send({
        from: from || process.env.EMAIL_FROM || 'JeevanRaksha <onboarding@resend.dev>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html: html || text,
      });
      console.log('✅ Email sent successfully via Resend:', result);
      return result;
    }

    // Fallback to SMTP (may fail if college WiFi blocks it)
    console.log('📧 Sending email via SMTP...');
    const mailOptions = {
      from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully via SMTP:', info);
    return info;
  } catch (error) {
    console.error('❌ Email sending failed:', error.message);
    throw error;
  }
}

module.exports = { sendEmail, transporter };