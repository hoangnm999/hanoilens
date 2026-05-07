// api/send-email.js — Vercel Serverless Function
// Gửi email qua Resend.com API
// Cấu hình: thêm RESEND_API_KEY vào Vercel Environment Variables

export default async function handler(req, res) {
  // Chỉ nhận POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  // Nếu chưa cấu hình key → bỏ qua (không gây lỗi)
  if (!RESEND_API_KEY) {
    console.log('[send-email] RESEND_API_KEY chưa cấu hình — bỏ qua');
    return res.status(200).json({ ok: true, skipped: true });
  }

  const { to, subject, html } = req.body || {};

  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Thiếu to, subject hoặc html' });
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + RESEND_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'HanoiLens <noreply@hanoilens.com>',  // Thay bằng domain đã verify trên Resend
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[send-email] Resend error:', data);
      return res.status(200).json({ ok: false, error: data }); // 200 để FE không crash
    }

    console.log('[send-email] Sent to:', to, '| id:', data.id);
    return res.status(200).json({ ok: true, id: data.id });

  } catch (err) {
    console.error('[send-email] Exception:', err.message);
    return res.status(200).json({ ok: false, error: err.message }); // 200 để FE không crash
  }
}
