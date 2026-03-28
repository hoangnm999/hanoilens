// api/checklist.js
// GET  /api/checklist?booking_id=xxx → xem checklist
// POST /api/checklist                → tạo checklist (owner/admin)

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');
const email = require('./_lib/email');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);
  if (!user) return err(res, 'Chưa đăng nhập', 401);

  // GET
  if (req.method === 'GET') {
    const booking_id = req.query.booking_id;
    if (!booking_id) return err(res, 'Thiếu booking_id');
    const { data, error } = await sb.from('checklists')
      .select('*').eq('booking_id', booking_id).order('created_at');
    if (error) return err(res, error.message, 500);
    return ok(res, { checklists: data||[] });
  }

  // POST — tạo checklist
  if (req.method === 'POST') {
    const { booking_id, phase, items, note } = req.body;
    if (!booking_id) return err(res, 'Thiếu booking_id');
    if (!['before','after'].includes(phase)) return err(res, 'phase phải là before hoặc after');

    // Kiểm tra quyền — chỉ owner hoặc admin
    const { data: booking } = await sb.from('bookings')
      .select('*,listings(owner_id,equipment_name)').eq('id', booking_id).single();
    if (!booking) return err(res, 'Không tìm thấy booking', 404);

    const isOwner = booking.listings?.owner_id === user.sub;
    if (!isOwner && !isAdmin(user)) return err(res, 'Chỉ chủ thiết bị hoặc admin', 403);

    const { data, error } = await sb.from('checklists').insert({
      booking_id, phase,
      items: JSON.stringify(items || []),
      note: note || null,
      created_by: user.email,
      equipment_name: booking.listings?.equipment_name || '',
    }).select().single();
    if (error) return err(res, error.message, 500);

    // Nếu là checklist sau thuê — kiểm tra hỏng hóc
    if (phase === 'after' && items) {
      const damaged = (Array.isArray(items) ? items : []).filter(i => !i.checked);
      if (damaged.length > 0) {
        await sb.from('bookings').update({
          has_damage_report: true,
          damage_items: JSON.stringify(damaged.map(i => i.label)),
        }).eq('id', booking_id);

        if (process.env.ADMIN_EMAIL) {
          await email.damageReport({
            adminEmail: process.env.ADMIN_EMAIL,
            equipment:  booking.listings?.equipment_name || '',
            bookingId:  booking_id,
            damagedItems: damaged.map(i => i.label),
          });
        }
        return ok(res, {
          checklist: data,
          warning: `Phát hiện ${damaged.length} mục có vấn đề`,
          damagedItems: damaged,
        });
      }
    }
    return ok(res, { checklist: data }, 201);
  }

  return err(res, 'Method không hỗ trợ', 405);
};
