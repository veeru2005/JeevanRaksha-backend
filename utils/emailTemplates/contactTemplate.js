function contactTemplate({ name, email, subject, message, submittedAt }) {
    const submitted = submittedAt ? new Date(submittedAt).toLocaleString() : new Date().toLocaleString();
    return `
 <!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>New Contact Message</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; background:#f6f9fc; margin:0; padding:30px; }
    .card { max-width:700px; margin:0 auto; background:white; border-radius:12px; box-shadow:0 6px 24px rgba(18,38,63,0.08); overflow:hidden; border: 4px solid #367c69; }
    .header { background: #367c69; padding:22px 28px; color:white; }
    .header h1 { margin:0; font-size:20px }
    .body { padding:24px 28px; color:#111827 }
    .meta { font-size:13px; color:#6b7280; margin-bottom:12px }
    .section { margin-bottom:18px }
    .label { display:block; font-size:13px; color:#374151; margin-bottom:6px; font-weight:600 }
    .value { background:#f3f4f6; padding:12px; border-radius:8px; color:#111827 }
    .cta { display:inline-block; margin-top:14px; padding:10px 16px; background:#10b981; color:white; border-radius:8px; text-decoration:none; font-weight:600 }
    .footer { padding:18px 28px; font-size:12px; color:#9ca3af; background:#f8fafc; text-align: center; }
    pre { white-space:pre-wrap; word-wrap:break-word }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>New Contact Message — JeevanRaksha</h1>
    </div>
    <div class="body">
      <div class="meta">Received: ${submitted}</div>

      <div class="section">
        <span class="label">From</span>
        <div class="value">${escapeHtml(name)}</div>
      </div>

      <div class="section">
        <span class="label">Email</span>
        <div class="value">${escapeHtml(email)}</div>
      </div>

      <div class="section">
        <span class="label">Subject</span>
        <div class="value">${escapeHtml(subject || 'No subject')}</div>
      </div>

      <div class="section">
        <span class="label">Message</span>
        <div class="value"><pre>${escapeHtml(message)}</pre></div>
      </div>
    </div>
    <div class="footer">
      © 2026 JeevanRaksha. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = { contactTemplate };
