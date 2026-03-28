// api/_lib/email.js — Gửi email qua Resend (resend.com - 3000 email/tháng free)

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'HanoiLens <noreply@hanoilens.com>';

const send = async (to, subject, html) => {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email disabled] To:', to, 'Subject:', subject);
    return;
  }
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (e) {
    console.error('Email error:', e.message);
  }
};

// ── Templates ─────────────────────────────────────────────────────────────
const base = (content) => `
<div style="font-family:sans-serif;max-width:480px;margin:auto;background:#0a0a0a;color:#f0ece4;padding:32px;border-radius:12px">
  <h1 style="font-size:24px;color:#c9a84c;margin:0 0 4px;letter-spacing:3px">HANOILENS</h1>
  <p style="color:#888;margin:0 0 24px;font-size:13px">hanoilens.com · Cho thuê thiết bị quay phim</p>
  ${content}
  <p style="margin-top:32px;color:#555;font-size:11px">© 2025 HanoiLens</p>
</div>`;

const box = (rows) => `
<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px;margin:16px 0">
  ${rows.map(([k,v]) => `
    <p style="margin:0 0 8px;color:#888;font-size:12px">${k}</p>
    <p style="margin:0 0 12px;font-size:15px;font-weight:600">${v}</p>
  `).join('')}
</div>`;

const btn = (text, url) =>
  `<a href="${url}" style="display:inline-block;background:#c9a84c;color:#0a0a0a;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px">${text}</a>`;

// Emails cụ thể
module.exports = {

  pointsApproved: async ({ to, name, equipment, points, totalPoints }) =>
    send(to, `✅ Cộng ${points} điểm — ${equipment}`, base(`
      <h2>Chào ${name}! 👋</h2>
      <p>Yêu cầu cộng điểm đã được <strong style="color:#4caf7d">phê duyệt</strong>.</p>
      ${box([['THIẾT BỊ', equipment], ['ĐIỂM ĐƯỢC CỘNG', `+${points}`], ['TỔNG ĐIỂM HIỆN TẠI', totalPoints]])}
    `)),

  pointsRejected: async ({ to, name, equipment, reason }) =>
    send(to, `❌ Yêu cầu điểm chưa được duyệt — ${equipment}`, base(`
      <h2>Chào ${name}!</h2>
      <p>Yêu cầu cộng điểm cho <strong>${equipment}</strong> chưa được duyệt.</p>
      ${reason ? box([['LÝ DO', reason]]) : ''}
      <p style="color:#888;font-size:13px">Vui lòng liên hệ HanoiLens nếu có thắc mắc.</p>
    `)),

  bookingConfirmed: async ({ to, name, equipment, startDate, days, totalPrice }) =>
    send(to, `📦 Booking xác nhận — ${equipment}`, base(`
      <h2>Booking đã được xác nhận! 🎉</h2>
      <p>Chào ${name}, chủ thiết bị đã xác nhận đơn thuê của bạn.</p>
      ${box([
        ['THIẾT BỊ', equipment],
        ['NGÀY BẮT ĐẦU', startDate || 'Sẽ xác nhận sau'],
        ['SỐ NGÀY', `${days} ngày`],
        ['TỔNG TIỀN', `${Number(totalPrice).toLocaleString('vi-VN')}đ`],
      ])}
      <p style="color:#888;font-size:13px">HanoiLens sẽ liên hệ bạn để sắp xếp giao nhận.</p>
    `)),

  bookingRejected: async ({ to, name, equipment, reason }) =>
    send(to, `❌ Booking bị từ chối — ${equipment}`, base(`
      <h2>Chào ${name}!</h2>
      <p>Rất tiếc, yêu cầu thuê <strong>${equipment}</strong> đã bị từ chối.</p>
      ${reason ? box([['LÝ DO', reason]]) : ''}
      <p style="color:#888;font-size:13px">Bạn có thể tìm thiết bị khác trên HanoiLens.</p>
      ${btn('Xem thiết bị khác', 'https://hanoilens.com')}
    `)),

  newBookingToOwner: async ({ ownerEmail, equipment, days, startDate }) =>
    send(ownerEmail, `🔔 Có request thuê mới — ${equipment}`, base(`
      <h2>Thiết bị của bạn có request mới! 🔔</h2>
      ${box([
        ['THIẾT BỊ', equipment],
        ['NGÀY MUỐN THUÊ', startDate || 'Chưa xác định'],
        ['SỐ NGÀY', `${days} ngày`],
      ])}
      <p style="color:#888;font-size:13px">Vui lòng đăng nhập để xác nhận hoặc từ chối. Thông tin khách thuê được bảo mật.</p>
      ${btn('Xem và xác nhận →', 'https://hanoilens.com')}
    `)),

  adminNewRequest: async ({ adminEmail, type, detail }) =>
    send(adminEmail, `[Admin] ${type} mới cần xét duyệt`, base(`
      <h2>Có ${type} mới cần xét duyệt</h2>
      <p>${detail}</p>
      ${btn('Vào Admin Panel →', 'https://hanoilens.com')}
    `)),

  damageReport: async ({ adminEmail, equipment, bookingId, damagedItems }) =>
    send(adminEmail, `⚠️ Báo cáo hỏng hóc — ${equipment}`, base(`
      <h2>⚠️ Phát hiện vấn đề khi nhận lại thiết bị</h2>
      ${box([
        ['THIẾT BỊ', equipment],
        ['BOOKING ID', bookingId],
        ['CÁC MỤC CÓ VẤN ĐỀ', damagedItems.join(', ')],
      ])}
      <p style="color:#888;font-size:13px">Vui lòng kiểm tra và xử lý theo quy trình.</p>
      ${btn('Xem chi tiết →', 'https://hanoilens.com')}
    `)),
};
