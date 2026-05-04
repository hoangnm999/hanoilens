-- ══════════════════════════════════════════════════════════
-- HanoiLens — Migration SQL (Supabase mới)
-- Project: qfurlsarqaenpzbgkfyk.supabase.co
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ══════════════════════════════════════════════════════════

-- ── 1. equipment_points ──────────────────────────────────
create table if not exists equipment_points (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text not null default 'Máy quay',
  image_url     text,
  points_per_day integer not null default 10,
  free_days     integer not null default 0,
  points_to_free integer not null default 1000,
  description   text,
  status        text not null default 'available',
  created_at    timestamptz default now()
);
alter table equipment_points disable row level security;

-- ── 2. points_requests ───────────────────────────────────
create table if not exists points_requests (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,
  user_email      text not null,
  user_name       text,
  equipment_id    uuid references equipment_points(id) on delete set null,
  equipment_name  text,
  rental_days     integer not null default 1,
  points_requested integer not null default 0,
  status          text not null default 'pending',
  note            text,
  admin_note      text,
  reviewed_by     text,
  reviewed_at     timestamptz,
  created_at      timestamptz default now()
);
alter table points_requests disable row level security;

-- ── 3. listings ──────────────────────────────────────────
create table if not exists listings (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid,
  owner_email   text not null,
  owner_name    text,
  title         text not null,
  description   text,
  category      text not null default 'Máy quay',
  price_per_day integer not null default 0,
  location      text,
  image_url     text,
  status        text not null default 'pending',
  admin_note    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table listings disable row level security;

-- ── 4. bookings ──────────────────────────────────────────
create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid references listings(id) on delete set null,
  renter_id     uuid,
  renter_email  text not null,
  renter_name   text,
  owner_id      uuid,
  owner_email   text,
  start_date    date not null,
  end_date      date not null,
  total_days    integer not null default 1,
  total_price   integer not null default 0,
  status        text not null default 'pending',
  note          text,
  admin_note    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table bookings disable row level security;

-- ── 5. reviews ───────────────────────────────────────────
create table if not exists reviews (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings(id) on delete set null,
  listing_id    uuid references listings(id) on delete set null,
  reviewer_id   uuid,
  reviewer_email text not null,
  reviewer_name text,
  rating        integer not null default 5 check (rating between 1 and 5),
  comment       text,
  status        text not null default 'pending',
  admin_note    text,
  created_at    timestamptz default now()
);
alter table reviews disable row level security;

-- ── 6. checklists ────────────────────────────────────────
create table if not exists checklists (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid references bookings(id) on delete cascade,
  phase         text not null check (phase in ('before', 'after')),
  items         jsonb not null default '[]',
  has_damage    boolean default false,
  damage_note   text,
  signed_by     text,
  signed_at     timestamptz,
  created_at    timestamptz default now()
);
alter table checklists disable row level security;

-- ── 7. members ───────────────────────────────────────────
create table if not exists members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid unique,
  email         text not null unique,
  full_name     text,
  is_admin      boolean not null default false,
  last_login    timestamptz,
  created_at    timestamptz default now()
);
alter table members disable row level security;

-- ── 8. banned_members ────────────────────────────────────
create table if not exists banned_members (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid,
  email         text not null,
  reason        text,
  banned_by     text,
  banned_at     timestamptz default now()
);
alter table banned_members disable row level security;

-- ══════════════════════════════════════════════════════════
-- Seed: Admin placeholder (cập nhật user_id sau khi đăng ký)
-- Sau khi đăng ký tài khoản hoangnm999@gmail.com, chạy:
--   update members set is_admin = true where email = 'hoangnm999@gmail.com';
-- ══════════════════════════════════════════════════════════

-- Seed dữ liệu thiết bị mẫu
insert into equipment_points (name, category, points_per_day, points_to_free, description, status) values
  ('Sony FX3',       'Máy quay',  50, 1000, 'Full-frame cinema camera, 4K 120fps', 'available'),
  ('Sony A7 IV',     'Máy quay',  30,  600, 'Mirrorless 33MP, 4K 60fps',           'available'),
  ('DJI RS3 Pro',    'Phụ kiện',  15,  300, 'Gimbal 3 trục chuyên nghiệp',         'available'),
  ('Rode NTG5',      'Âm thanh',  10,  200, 'Shotgun mic chất lượng cao',          'available'),
  ('Aputure 300X',   'Lighting',  20,  400, 'LED 300W bi-color, CRI 95+',          'available'),
  ('DJI Mavic 3 Pro','Drone',     40,  800, 'Drone 4/3 CMOS Hasselblad',           'available')
on conflict do nothing;
