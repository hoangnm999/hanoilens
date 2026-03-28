-- ============================================================
-- HanoiLens — SQL Migration đầy đủ
-- Chạy trong Supabase → SQL Editor → New query → Run
-- ============================================================

-- 1. BẢNG EQUIPMENT_POINTS
create table if not exists equipment_points (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category text default 'Máy quay',
  points_per_day int not null default 0,
  points_to_redeem int not null default 1000,
  image_url text,
  status text default 'active',
  created_at timestamp default now()
);

-- 2. BẢNG POINTS_REQUESTS
create table if not exists points_requests (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  user_email text not null,
  user_name text,
  equipment_name text not null,
  days int not null default 1,
  points_requested int not null,
  rental_date date,
  order_code text,
  note text,
  admin_note text,
  status text default 'pending',
  created_at timestamp default now()
);

-- 3. BẢNG LISTINGS
create table if not exists listings (
  id uuid default gen_random_uuid() primary key,
  owner_id text not null,
  owner_email text,
  equipment_name text not null,
  category text,
  price_per_day int not null,
  quantity int default 1,
  description text,
  image_url text,
  status text default 'pending',
  created_at timestamp default now()
);

-- 4. BẢNG BOOKINGS
create table if not exists bookings (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references listings(id),
  renter_id text not null,
  renter_email text not null,
  renter_name text,
  start_date date,
  days int default 1,
  total_price int,
  commission int default 0,
  owner_receives int default 0,
  note text,
  status text default 'pending',
  has_damage_report boolean default false,
  damage_items text,
  created_at timestamp default now()
);

-- 5. BẢNG REVIEWS
create table if not exists reviews (
  id uuid default gen_random_uuid() primary key,
  listing_id uuid references listings(id),
  reviewer_id text not null,
  reviewer_display text,
  rating int check (rating between 1 and 5),
  content text,
  status text default 'pending',
  created_at timestamp default now()
);

-- 6. BẢNG CHECKLISTS
create table if not exists checklists (
  id uuid default gen_random_uuid() primary key,
  booking_id uuid references bookings(id) on delete cascade,
  equipment_name text,
  phase text check (phase in ('before','after')),
  items text,
  note text,
  created_by text,
  created_at timestamp default now()
);

-- 7. BẢNG MEMBERS
create table if not exists members (
  id uuid default gen_random_uuid() primary key,
  user_id text unique,
  email text unique not null,
  full_name text,
  username text,
  is_admin boolean default false,
  last_login timestamp,
  created_at timestamp default now()
);

-- 8. BẢNG BANNED_MEMBERS
create table if not exists banned_members (
  id uuid default gen_random_uuid() primary key,
  user_email text unique not null,
  reason text,
  banned_at timestamp default now(),
  banned_by text
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_pts_email  on points_requests(user_email);
create index if not exists idx_pts_status on points_requests(status);
create index if not exists idx_lst_status on listings(status);
create index if not exists idx_lst_owner  on listings(owner_id);
create index if not exists idx_bkn_renter on bookings(renter_id);
create index if not exists idx_bkn_listing on bookings(listing_id);
create index if not exists idx_bkn_status on bookings(status);
create index if not exists idx_rev_listing on reviews(listing_id);
create index if not exists idx_rev_status  on reviews(status);
create index if not exists idx_chk_booking on checklists(booking_id);

-- ============================================================
-- TẮT RLS (backend dùng service_role key nên bypass được)
-- ============================================================
alter table equipment_points  disable row level security;
alter table points_requests   disable row level security;
alter table listings          disable row level security;
alter table bookings          disable row level security;
alter table reviews           disable row level security;
alter table checklists        disable row level security;
alter table members           disable row level security;
alter table banned_members    disable row level security;

-- ============================================================
-- STORAGE BUCKET cho ảnh thiết bị
-- ============================================================
insert into storage.buckets (id, name, public)
values ('hanoilens-images', 'hanoilens-images', true)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
drop policy if exists "auth upload images" on storage.objects;

create policy "public read images"
  on storage.objects for select to anon
  using (bucket_id = 'hanoilens-images');

create policy "auth upload images"
  on storage.objects for insert to anon
  with check (bucket_id = 'hanoilens-images');
