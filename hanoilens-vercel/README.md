# HanoiLens Backend — Hướng dẫn deploy

## Cấu trúc project
```
hanoilens/
├── index.html                  ← Frontend
├── vercel.json                 ← Config Vercel
├── package.json                ← Dependencies
├── migration.sql               ← Chạy trên Supabase
└── api/
    ├── _lib/
    │   ├── supabase.js         ← Supabase helper + JWT verify
    │   └── email.js            ← Email templates (Resend)
    ├── points-request.js       ← API điểm thưởng
    ├── listings.js             ← API listing hợp tác
    ├── bookings.js             ← API booking
    ├── reviews.js              ← API review
    ├── checklist.js            ← API checklist bàn giao
    ├── equipment-points.js     ← API quản lý thiết bị + điểm
    ├── admin-stats.js          ← API thống kê admin
    ├── members.js              ← API quản lý thành viên
    └── export.js               ← API xuất .xlsx
```

## Bước 1 — Chạy SQL trên Supabase
Supabase → SQL Editor → New query → dán nội dung `migration.sql` → Run

## Bước 2 — Tạo tài khoản Resend (email miễn phí)
- Vào `resend.com` → Sign up → API Keys → Create Key → copy

## Bước 3 — Thêm Environment Variables trên Vercel
Vercel → Project → Settings → Environment Variables → thêm:

| Key | Value |
|-----|-------|
| SUPABASE_URL | https://lezgeeyahigblgciqrlw.supabase.co |
| SUPABASE_SERVICE_KEY | [service_role key từ Supabase → Settings → API] |
| RESEND_API_KEY | [key từ resend.com] |
| ADMIN_EMAIL | email nhận thông báo admin |

## Bước 4 — Deploy lên Vercel
1. Push toàn bộ folder lên GitHub
2. Vercel → Import repo → chọn Other framework
3. Output Directory: `.`
4. Deploy

## API Endpoints
```
GET  /api/equipment-points           → Danh sách thiết bị
POST /api/equipment-points           → Thêm thiết bị (admin)
PATCH /api/equipment-points          → Sửa điểm (admin)

GET  /api/points-request?email=xxx   → Lịch sử điểm
POST /api/points-request             → Gửi yêu cầu cộng điểm
PATCH /api/points-request            → Duyệt/từ chối (admin)

GET  /api/listings                   → Danh sách listing
POST /api/listings                   → Đăng listing mới
PATCH /api/listings                  → Duyệt listing (admin)

GET  /api/bookings                   → Xem booking
POST /api/bookings                   → Tạo booking
PATCH /api/bookings                  → Xác nhận/từ chối

GET  /api/reviews?listing_id=xxx     → Review của listing
POST /api/reviews                    → Gửi review
PATCH /api/reviews                   → Duyệt review (admin)

GET  /api/checklist?booking_id=xxx   → Xem checklist
POST /api/checklist                  → Tạo checklist (owner/admin)

GET  /api/admin-stats                → Thống kê (admin)

GET  /api/members                    → Danh sách thành viên (admin)
POST /api/members                    → Sync member khi login
PATCH /api/members                   → Set role / ban / unban (admin)

GET  /api/export?type=points         → Xuất điểm .xlsx
GET  /api/export?type=bookings       → Xuất booking .xlsx (admin)
GET  /api/export?type=customers      → Xuất thành viên .xlsx (admin)
```
