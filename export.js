// api/export.js
// GET /api/export?type=points|bookings|customers → xuất file .xlsx

const { sb, err, verifyUser, isAdmin } = require('./_lib/supabase');
const XLSX = require('xlsx');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return err(res, 'GET only', 405);

  const user = verifyUser(req);
  if (!user) return err(res, 'Chưa đăng nhập', 401);

  const type  = req.query.type || 'points';
  const today = new Date().toISOString().split('T')[0];
  const wb    = XLSX.utils.book_new();

  const sLabel = s => s==='approved'?'Đã duyệt':s==='rejected'?'Từ chối':'Chờ duyệt';
  const bLabel = s => ({pending:'Chờ xác nhận',confirmed:'Đã xác nhận',completed:'Hoàn thành',rejected:'Từ chối',cancelled:'Huỷ'}[s]||s);

  try {
    if (type === 'points') {
      const qEmail = req.query.email || user.email;
      if (!isAdmin(user) && user.email !== qEmail) return err(res, 'Không có quyền', 403);

      let q = sb.from('points_requests').select('*').order('created_at',{ascending:false});
      if (!isAdmin(user)) q = q.eq('user_email', qEmail);
      const { data } = await q;

      const rows = (data||[]).map(r => ({
        'Ngày gửi':   new Date(r.created_at).toLocaleDateString('vi-VN'),
        'Tên khách':  r.user_name||'',
        'Email':      r.user_email,
        'Thiết bị':   r.equipment_name,
        'Số ngày':    r.days,
        'Điểm':       r.points_requested,
        'Mã đơn':     r.order_code||'',
        'Ghi chú':    r.note||'',
        'Trạng thái': sLabel(r.status),
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{'Thông báo':'Chưa có dữ liệu'}]);
      ws['!cols'] = [14,20,26,22,10,10,14,22,14].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử điểm');

      const total = (data||[]).filter(r=>r.status==='approved').reduce((s,r)=>s+r.points_requested,0);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Tổng điểm đã duyệt', total],
        ['Tổng yêu cầu', (data||[]).length],
        ['Xuất lúc', new Date().toLocaleString('vi-VN')],
      ]), 'Tổng kết');

      const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="HanoiLens_Diem_${today}.xlsx"`);
      return res.send(buf);
    }

    if (type === 'bookings') {
      if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);
      const { data } = await sb.from('bookings')
        .select('*,listings(equipment_name,category)').order('created_at',{ascending:false});

      const rows = (data||[]).map(b => ({
        'Khách thuê':    b.renter_name||'',
        'Email':         b.renter_email,
        'Thiết bị':      b.listings?.equipment_name||'',
        'Danh mục':      b.listings?.category||'',
        'Ngày bắt đầu': b.start_date||'',
        'Số ngày':       b.days,
        'Tổng tiền(đ)':  b.total_price||0,
        'Phí HL(đ)':     b.commission||0,
        'Owner nhận(đ)': b.owner_receives||0,
        'Trạng thái':    bLabel(b.status),
        'Ngày tạo':      new Date(b.created_at).toLocaleDateString('vi-VN'),
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{'Thông báo':'Chưa có dữ liệu'}]);
      ws['!cols'] = [18,26,22,14,14,10,14,14,14,14,14].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws, 'Booking');

      const done = (data||[]).filter(b=>b.status==='completed');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ['Hoàn thành', done.length],
        ['Doanh thu(đ)', done.reduce((s,b)=>s+(b.total_price||0),0)],
        ['Phí HL(đ)',   done.reduce((s,b)=>s+(b.commission||0),0)],
        ['Xuất lúc',    new Date().toLocaleString('vi-VN')],
      ]), 'Doanh thu');

      const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="HanoiLens_Booking_${today}.xlsx"`);
      return res.send(buf);
    }

    if (type === 'customers') {
      if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);
      const [memRes, ptsRes] = await Promise.all([
        sb.from('members').select('*').order('created_at',{ascending:false}),
        sb.from('points_requests').select('user_email,points_requested,status'),
      ]);
      const ptsMap = {};
      (ptsRes.data||[]).forEach(r => {
        if (!ptsMap[r.user_email]) ptsMap[r.user_email]={approved:0,count:0};
        ptsMap[r.user_email].count++;
        if (r.status==='approved') ptsMap[r.user_email].approved+=r.points_requested;
      });

      const rows = (memRes.data||[]).map(m => ({
        'Họ tên':        m.full_name||'',
        'Email':         m.email,
        'Điểm':          ptsMap[m.email]?.approved||0,
        'Số lần thuê':   ptsMap[m.email]?.count||0,
        'Role':          m.is_admin?'Admin':'Thành viên',
        'Đăng nhập gần': m.last_login?new Date(m.last_login).toLocaleDateString('vi-VN'):'',
        'Ngày tham gia': m.created_at?new Date(m.created_at).toLocaleDateString('vi-VN'):'',
      }));

      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{'Thông báo':'Chưa có dữ liệu'}]);
      ws['!cols'] = [22,28,10,12,12,16,16].map(w=>({wch:w}));
      XLSX.utils.book_append_sheet(wb, ws, 'Thành viên');

      const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
      res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="HanoiLens_KhachHang_${today}.xlsx"`);
      return res.send(buf);
    }

    return err(res, 'type không hợp lệ. Dùng: points, bookings, customers');

  } catch(e) {
    console.error('Export error:', e);
    return err(res, e.message, 500);
  }
};
