// api/listings.js
// GET   /api/listings              → danh sách listing active
// POST  /api/listings              → owner đăng listing mới
// PATCH /api/listings              → admin duyệt/từ chối

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');
const email = require('./_lib/email');

const FLOOR_PRICE = 200000;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);

  // GET
  if (req.method === 'GET') {
    let q = sb.from('listings')
      .select('id,equipment_name,category,price_per_day,quantity,description,status,created_at,owner_id,image_url')
      .order('created_at', { ascending: false });

    if (!user || !isAdmin(user)) q = q.eq('status', 'active');
    if (req.query.category) q = q.eq('category', req.query.category);
    if (req.query.search)   q = q.ilike('equipment_name', `%${req.query.search}%`);

    const { data, error } = await q;
    if (error) return err(res, error.message, 500);

    const masked = (data||[]).map(item => ({
      ...item,
      owner_display: item.owner_id ? item.owner_id.substring(0,3).toUpperCase() + '***' : 'Ẩn danh',
      owner_id: undefined,
    }));
    return ok(res, { listings: masked });
  }

  // POST
  if (req.method === 'POST') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    const { equipment_name, category, price_per_day, quantity, description, image_url } = req.body;
    if (!equipment_name) return err(res, 'Thiếu tên thiết bị');
    if (!price_per_day || price_per_day < FLOOR_PRICE)
      return err(res, `Giá tối thiểu ${FLOOR_PRICE.toLocaleString()}đ/ngày`, 422);

    const { data, error } = await sb.from('listings').insert({
      owner_id: user.sub,
      owner_email: user.email,
      equipment_name, category: category || 'Khác',
      price_per_day, quantity: quantity || 1,
      description: description || '',
      image_url: image_url || null,
      status: 'pending',
    }).select().single();
    if (error) return err(res, error.message, 500);

    if (process.env.ADMIN_EMAIL) {
      await email.adminNewRequest({
        adminEmail: process.env.ADMIN_EMAIL,
        type: 'listing thiết bị',
        detail: `${user.email} đăng listing: ${equipment_name} — ${price_per_day.toLocaleString()}đ/ngày`,
      });
    }
    return ok(res, { listing: data }, 201);
  }

  // PATCH — admin duyệt
  if (req.method === 'PATCH') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    if (!isAdmin(user)) return err(res, 'Chỉ admin mới có quyền', 403);
    const { id, action } = req.body;
    if (!id) return err(res, 'Thiếu id');
    const statusMap = { approve: 'active', reject: 'rejected', suspend: 'suspended' };
    if (!statusMap[action]) return err(res, 'action không hợp lệ');

    const { error } = await sb.from('listings').update({ status: statusMap[action] }).eq('id', id);
    if (error) return err(res, error.message, 500);
    return ok(res, { id, status: statusMap[action] });
  }

  return err(res, 'Method không hỗ trợ', 405);
};
