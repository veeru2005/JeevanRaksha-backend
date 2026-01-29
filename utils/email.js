const nodemailer = require('nodemailer');

// Use environment variables for credentials. Example env vars:
// EMAIL_HOST=smtp.gmail.com
// EMAIL_PORT=465
// EMAIL_SECURE=true
// EMAIL_USER=jeevanraksha2026@gmail.com
// EMAIL_PASS=<app password>

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
  const mailOptions = {
    from: from || process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject,
    text,
    html
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendEmail, transporter };