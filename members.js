// api/members.js
// GET   /api/members          → danh sách thành viên (admin)
// POST  /api/members          → upsert member khi đăng nhập
// PATCH /api/members          → admin set role / ban / unban

const { sb, ok, err, verifyUser, isAdmin } = require('./_lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const user = verifyUser(req);
  if (!user) return err(res, 'Chưa đăng nhập', 401);

  // GET — admin xem danh sách
  if (req.method === 'GET') {
    if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const [memRes, ptsRes, bannedRes] = await Promise.all([
      sb.from('members').select('*').order('created_at', { ascending: false }),
      sb.from('points_requests').select('user_email,points_requested,status'),
      sb.from('banned_members').select('user_email,reason,banned_at'),
    ]);

    const ptsMap = {};
    (ptsRes.data||[]).forEach(r => {
      if (!ptsMap[r.user_email]) ptsMap[r.user_email] = { approved: 0, count: 0 };
      ptsMap[r.user_email].count++;
      if (r.status === 'approved') ptsMap[r.user_email].approved += r.points_requested;
    });
    const bannedSet = new Set((bannedRes.data||[]).map(b => b.user_email));

    const members = (memRes.data||[]).map(m => ({
      ...m,
      points: ptsMap[m.email]?.approved || 0,
      rentalCount: ptsMap[m.email]?.count || 0,
      isBanned: bannedSet.has(m.email),
    }));
    return ok(res, { members });
  }

  // POST — upsert khi đăng nhập
  if (req.method === 'POST') {
    const { email: userEmail, full_name } = req.body;
    const { error } = await sb.from('members').upsert({
      user_id:    user.sub,
      email:      userEmail || user.email,
      full_name:  full_name || userEmail?.split('@')[0] || '',
      last_login: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) return err(res, error.message, 500);
    return ok(res, { synced: true });
  }

  // PATCH — set role / ban / unban
  if (req.method === 'PATCH') {
    if (!isAdmin(user)) return err(res, 'Chỉ admin', 403);
    const { action, user_id, user_email, is_admin: makeAdmin, reason } = req.body;

    if (action === 'set_role') {
      if (!user_id) return err(res, 'Thiếu user_id');
      // Không cho tự bỏ quyền mình
      if (user_id === user.sub && !makeAdmin)
        return err(res, 'Không thể tự bỏ quyền Admin', 422);
      const { error } = await sb.from('members').update({ is_admin: makeAdmin }).eq('user_id', user_id);
      if (error) return err(res, error.message, 500);
      return ok(res, { user_id, is_admin: makeAdmin });
    }

    if (action === 'ban') {
      if (!user_email) return err(res, 'Thiếu user_email');
      const { error } = await sb.from('banned_members').upsert({
        user_email, reason: reason || 'Vi phạm điều khoản',
        banned_at: new Date().toISOString(),
        banned_by: user.email,
      });
      if (error) return err(res, error.message, 500);
      return ok(res, { banned: user_email });
    }

    if (action === 'unban') {
      if (!user_email) return err(res, 'Thiếu user_email');
      const { error } = await sb.from('banned_members').delete().eq('user_email', user_email);
      if (error) return err(res, error.message, 500);
      return ok(res, { unbanned: user_email });
    }

    return err(res, 'action không hợp lệ');
  }

  return err(res, 'Method không hỗ trợ', 405);
};
