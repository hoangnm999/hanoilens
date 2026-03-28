// api/equipment-points.js
// GET   /api/equipment-points        → danh sách thiết bị + điểm (public)
// POST  /api/equipment-points        → admin thêm thiết bị
// PATCH /api/equipment-points        → admin cập nhật

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);

  if (req.method === 'GET') {
    const { data, error } = await sb.from('equipment_points')
      .select('*').eq('status','active').order('name');
    if (error) return err(res, error.message, 500);
    return ok(res, { equipment: data||[] });
  }

  if (req.method === 'POST') {
    if (!user || !isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const { name, category, points_per_day, points_to_redeem, image_url } = req.body;
    if (!name) return err(res, 'Thiếu tên thiết bị');
    const { data, error } = await sb.from('equipment_points').insert({
      name, category: category||'Máy quay',
      points_per_day: points_per_day||0,
      points_to_redeem: points_to_redeem||1000,
      image_url: image_url||null,
      status: 'active',
    }).select().single();
    if (error) return err(res, error.message, 500);
    return ok(res, { equipment: data }, 201);
  }

  if (req.method === 'PATCH') {
    if (!user || !isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const { id, ...updates } = req.body;
    if (!id) return err(res, 'Thiếu id');
    const { data, error } = await sb.from('equipment_points').update(updates).eq('id',id).select().single();
    if (error) return err(res, error.message, 500);
    return ok(res, { equipment: data });
  }

  if (req.method === 'DELETE') {
    if (!user || !isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const { id } = req.body;
    if (!id) return err(res, 'Thiếu id');
    const { error } = await sb.from('equipment_points').delete().eq('id', id);
    if (error) return err(res, error.message, 500);
    return ok(res, { deleted: id });
  }

  return err(res, 'Method không hỗ trợ', 405);
};
