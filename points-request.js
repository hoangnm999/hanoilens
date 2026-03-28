// api/points-request.js
// GET  /api/points-request?email=xxx  → lịch sử điểm
// POST /api/points-request             → gửi yêu cầu mới
// PATCH /api/points-request            → admin duyệt/từ chối

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');
const email = require('./_lib/email');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);

  // GET — lịch sử điểm
  if (req.method === 'GET') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    const userEmail = req.query.email;
    if (!userEmail) return err(res, 'Thiếu email');
    if (!isAdmin(user) && user.email !== userEmail) return err(res, 'Không có quyền', 403);

    let q = sb.from('points_requests').select('*').order('created_at', { ascending: false });
    if (!isAdmin(user)) q = q.eq('user_email', userEmail);
    const { data, error } = await q;
    if (error) return err(res, error.message, 500);

    const total = (data||[]).filter(r => r.status === 'approved')
      .reduce((s, r) => s + r.points_requested, 0);
    return ok(res, { requests: data, totalPoints: total });
  }

  // POST — gửi yêu cầu mới
  if (req.method === 'POST') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    const { equipment_name, days, rental_date, order_code, note } = req.body;
    if (!equipment_name) return err(res, 'Thiếu tên thiết bị');
    if (!days || days < 1) return err(res, 'Số ngày không hợp lệ');

    const { data: eq } = await sb.from('equipment_points')
      .select('points_per_day').eq('name', equipment_name).eq('status', 'active').single();
    const pts = (eq?.points_per_day || 0) * days;

    const { data, error } = await sb.from('points_requests').insert({
      user_id: user.sub,
      user_email: user.email,
      user_name: user.user_metadata?.full_name || user.email.split('@')[0],
      equipment_name, days,
      points_requested: pts,
      rental_date: rental_date || null,
      order_code: order_code || null,
      note: note || null,
      status: 'pending',
    }).select().single();
    if (error) return err(res, error.message, 500);

    // Thông báo admin
    if (process.env.ADMIN_EMAIL) {
      await email.adminNewRequest({
        adminEmail: process.env.ADMIN_EMAIL,
        type: 'yêu cầu cộng điểm',
        detail: `${user.email} yêu cầu +${pts} điểm cho ${equipment_name} (${days} ngày)`,
      });
    }
    return ok(res, { request: data, pointsEstimated: pts }, 201);
  }

  // PATCH — admin duyệt/từ chối
  if (req.method === 'PATCH') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    if (!isAdmin(user)) return err(res, 'Chỉ admin mới có quyền', 403);
    const { id, action, reason } = req.body;
    if (!id) return err(res, 'Thiếu id');
    if (!['approve','reject'].includes(action)) return err(res, 'action không hợp lệ');

    const { data: req2 } = await sb.from('points_requests').select('*').eq('id', id).single();
    if (!req2) return err(res, 'Không tìm thấy yêu cầu', 404);

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const { error } = await sb.from('points_requests')
      .update({ status: newStatus, admin_note: reason || null }).eq('id', id);
    if (error) return err(res, error.message, 500);

    // Email thông báo user
    if (action === 'approve') {
      const { data: all } = await sb.from('points_requests')
        .select('points_requested').eq('user_email', req2.user_email).eq('status', 'approved');
      const total = (all||[]).reduce((s,r) => s + r.points_requested, 0);
      await email.pointsApproved({
        to: req2.user_email, name: req2.user_name,
        equipment: req2.equipment_name, points: req2.points_requested, totalPoints: total,
      });
    } else {
      await email.pointsRejected({
        to: req2.user_email, name: req2.user_name,
        equipment: req2.equipment_name, reason,
      });
    }
    return ok(res, { id, status: newStatus });
  }

  return err(res, 'Method không hỗ trợ', 405);
};
