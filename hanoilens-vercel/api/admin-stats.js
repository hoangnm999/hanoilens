// api/admin-stats.js
// GET /api/admin-stats → thống kê tổng quan (admin only)

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return err(res, 'Method không hỗ trợ', 405);

  const user = verifyUser(req);
  if (!user) return err(res, 'Chưa đăng nhập', 401);
  if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);

  const [pts, lst, bkn, rev, mem] = await Promise.all([
    sb.from('points_requests').select('id,status,points_requested,user_email'),
    sb.from('listings').select('id,status'),
    sb.from('bookings').select('id,status,total_price,commission,created_at'),
    sb.from('reviews').select('id,status'),
    sb.from('members').select('id'),
  ]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const doneThisMonth = (bkn.data||[]).filter(b =>
    b.status === 'completed' && b.created_at?.startsWith(thisMonth)
  );

  return ok(res, {
    stats: {
      members:   { total: (mem.data||[]).length },
      points:    {
        pending:  (pts.data||[]).filter(r => r.status==='pending').length,
        approved: (pts.data||[]).filter(r => r.status==='approved').length,
      },
      listings:  {
        total:   (lst.data||[]).length,
        active:  (lst.data||[]).filter(l => l.status==='active').length,
        pending: (lst.data||[]).filter(l => l.status==='pending').length,
      },
      bookings:  {
        total:     (bkn.data||[]).length,
        pending:   (bkn.data||[]).filter(b => b.status==='pending').length,
        confirmed: (bkn.data||[]).filter(b => b.status==='confirmed').length,
        completed: (bkn.data||[]).filter(b => b.status==='completed').length,
      },
      reviews:   { pending: (rev.data||[]).filter(r => r.status==='pending').length },
      revenue:   {
        thisMonth:          doneThisMonth.reduce((s,b) => s+(b.total_price||0), 0),
        commissionThisMonth: doneThisMonth.reduce((s,b) => s+(b.commission||0), 0),
      },
    },
  });
};
