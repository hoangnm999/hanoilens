// api/reviews.js
// GET   /api/reviews?listing_id=xxx → review đã duyệt
// POST  /api/reviews                → gửi review (sau khi thuê xong)
// PATCH /api/reviews                → admin duyệt/ẩn

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);

  // GET
  if (req.method === 'GET') {
    let q = sb.from('reviews')
      .select('id,listing_id,rating,content,reviewer_display,created_at,status')
      .order('created_at', { ascending: false });

    if (!user || !isAdmin(user)) q = q.eq('status', 'approved');
    if (req.query.listing_id) q = q.eq('listing_id', req.query.listing_id);

    const { data, error } = await q;
    if (error) return err(res, error.message, 500);

    const avg = data?.length
      ? (data.reduce((s,r) => s + r.rating, 0) / data.length).toFixed(1) : null;
    return ok(res, { reviews: data||[], averageRating: avg, total: data?.length||0 });
  }

  // POST — gửi review
  if (req.method === 'POST') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    const { listing_id, rating, content } = req.body;
    if (!listing_id) return err(res, 'Thiếu listing_id');
    if (!rating || rating < 1 || rating > 5) return err(res, 'Rating từ 1–5');
    if (!content || content.trim().length < 10) return err(res, 'Nội dung quá ngắn');

    // Kiểm tra đã thuê chưa
    const { data: bk } = await sb.from('bookings')
      .select('id').eq('listing_id', listing_id)
      .eq('renter_id', user.sub).eq('status', 'completed').limit(1);
    if (!bk?.length) return err(res, 'Chỉ review sau khi hoàn thành thuê', 422);

    // Kiểm tra đã review chưa
    const { data: ex } = await sb.from('reviews')
      .select('id').eq('listing_id', listing_id).eq('reviewer_id', user.sub).limit(1);
    if (ex?.length) return err(res, 'Bạn đã review rồi', 422);

    // Tạo tên ẩn danh
    const name   = user.user_metadata?.full_name || user.email.split('@')[0];
    const parts  = name.split(' ');
    const display = parts.length > 1
      ? `${parts[0].charAt(0)}*** ${parts[parts.length-1].charAt(0)}***`
      : `${name.substring(0,2)}***`;

    const { data, error } = await sb.from('reviews').insert({
      listing_id,
      reviewer_id:      user.sub,
      reviewer_display: display,
      rating,
      content: content.trim(),
      status: 'pending',
    }).select().single();
    if (error) return err(res, error.message, 500);
    return ok(res, { review: data }, 201);
  }

  // PATCH — admin duyệt
  if (req.method === 'PATCH') {
    if (!user) return err(res, 'Chưa đăng nhập', 401);
    if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const { id, action } = req.body;
    if (!id || !['approve','reject'].includes(action)) return err(res, 'Thiếu id hoặc action');
    const { error } = await sb.from('reviews')
      .update({ status: action === 'approve' ? 'approved' : 'rejected' }).eq('id', id);
    if (error) return err(res, error.message, 500);
    return ok(res, { id, status: action === 'approve' ? 'approved' : 'rejected' });
  }

  return err(res, 'Method không hỗ trợ', 405);
};
