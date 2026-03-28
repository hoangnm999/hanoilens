// api/bookings.js
// GET   /api/bookings         → xem booking của mình
// POST  /api/bookings         → tạo booking mới
// PATCH /api/bookings         → xác nhận/từ chối/hoàn thành

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');
const email = require('./_lib/email');

const COMMISSION = 0.1;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);
  if (!user) return err(res, 'Chưa đăng nhập', 401);

  // GET
  if (req.method === 'GET') {
    let q = sb.from('bookings')
      .select('*,listings(equipment_name,category,price_per_day,owner_id,owner_email)')
      .order('created_at', { ascending: false });

    if (!isAdmin(user)) q = q.eq('renter_id', user.sub);
    const { data, error } = await q;
    if (error) return err(res, error.message, 500);

    // Ẩn thông tin owner
    const masked = (data||[]).map(b => ({
      ...b,
      listings: b.listings ? { ...b.listings, owner_id: undefined, owner_email: undefined } : null,
    }));
    return ok(res, { bookings: masked });
  }

  // POST — tạo booking
  if (req.method === 'POST') {
    const { listing_id, start_date, days, note } = req.body;
    if (!listing_id) return err(res, 'Thiếu listing_id');
    if (!days || days < 1) return err(res, 'Số ngày không hợp lệ');
    if (!start_date) return err(res, 'Vui lòng chọn ngày bắt đầu');

    const { data: listing } = await sb.from('listings').select('*')
      .eq('id', listing_id).eq('status', 'active').single();
    if (!listing) return err(res, 'Thiết bị không còn sẵn', 404);
    if (listing.owner_id === user.sub) return err(res, 'Không thể tự thuê thiết bị của mình', 422);

    const total      = listing.price_per_day * days;
    const commission = Math.round(total * COMMISSION);
    const ownerRecv  = total - commission;

    const { data, error } = await sb.from('bookings').insert({
      listing_id,
      renter_id:     user.sub,
      renter_email:  user.email,
      renter_name:   user.user_metadata?.full_name || user.email.split('@')[0],
      start_date,
      days,
      total_price:   total,
      commission,
      owner_receives: ownerRecv,
      note: note || null,
      status: 'pending',
    }).select().single();
    if (error) return err(res, error.message, 500);

    // Email chủ thiết bị
    if (listing.owner_email) {
      await email.newBookingToOwner({
        ownerEmail: listing.owner_email,
        equipment:  listing.equipment_name,
        days, startDate: start_date,
      });
    }
    return ok(res, { booking: data, total, commission, ownerReceives: ownerRecv }, 201);
  }

  // PATCH — cập nhật trạng thái
  if (req.method === 'PATCH') {
    const { id, action, reason } = req.body;
    if (!id) return err(res, 'Thiếu id');

    const { data: booking } = await sb.from('bookings')
      .select('*,listings(owner_id,owner_email,equipment_name)')
      .eq('id', id).single();
    if (!booking) return err(res, 'Không tìm thấy booking', 404);

    const isOwner  = booking.listings?.owner_id === user.sub;
    const isRenter = booking.renter_id === user.sub;
    const admin    = isAdmin(user);

    const allowed = {
      confirm:  admin || isOwner,
      reject:   admin || isOwner,
      complete: admin,
      cancel:   admin || isRenter,
    };
    if (!allowed[action]) return err(res, 'Không có quyền', 403);

    const statusMap = { confirm:'confirmed', reject:'rejected', complete:'completed', cancel:'cancelled' };
    const { error } = await sb.from('bookings').update({ status: statusMap[action] }).eq('id', id);
    if (error) return err(res, error.message, 500);

    // Email thông báo
    if (action === 'confirm') {
      await email.bookingConfirmed({
        to: booking.renter_email, name: booking.renter_name,
        equipment: booking.listings?.equipment_name,
        startDate: booking.start_date, days: booking.days, totalPrice: booking.total_price,
      });
    }
    if (action === 'reject') {
      await email.bookingRejected({
        to: booking.renter_email, name: booking.renter_name,
        equipment: booking.listings?.equipment_name, reason,
      });
    }
    return ok(res, { id, status: statusMap[action] });
  }

  return err(res, 'Method không hỗ trợ', 405);
};
