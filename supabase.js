// api/_lib/supabase.js — Helper dùng chung cho tất cả API functions

const { createClient } = require('@supabase/supabase-js');

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // service_role — bypass RLS
);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

const ok = (res, data, status = 200) =>
  res.status(status).setHeader('Content-Type','application/json')
    .setHeader('Access-Control-Allow-Origin','*')
    .json({ success: true, data });

const err = (res, message, status = 400) =>
  res.status(status).setHeader('Content-Type','application/json')
    .setHeader('Access-Control-Allow-Origin','*')
    .json({ success: false, error: message });

// Xác thực JWT từ Netlify Identity
const verifyUser = (req) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.split(' ')[1];
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    return payload;
  } catch {
    return null;
  }
};

const isAdmin = (user) => {
  if (!user) return false;
  const roles = user?.app_metadata?.roles || user?.roles || [];
  return Array.isArray(roles) ? roles.includes('admin') : roles === 'admin';
};

module.exports = { sb, cors, ok, err, verifyUser, isAdmin };
