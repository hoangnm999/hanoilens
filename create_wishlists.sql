-- Bảng wishlists (tùy chọn - hiện tại code dùng localStorage)
-- Chạy SQL này trong Supabase Dashboard → SQL Editor nếu muốn lưu server-side

CREATE TABLE IF NOT EXISTS public.wishlists (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL,
  listing_id  uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, listing_id)
);

-- Tắt RLS (nhất quán với các bảng khác trong project)
ALTER TABLE public.wishlists DISABLE ROW LEVEL SECURITY;

-- Index để query nhanh
CREATE INDEX IF NOT EXISTS wishlists_user_idx ON public.wishlists(user_id);
CREATE INDEX IF NOT EXISTS wishlists_listing_idx ON public.wishlists(listing_id);

-- ⚠️ GHI CHÚ: Code hiện tại dùng localStorage để lưu wishlist.
-- Nếu muốn chuyển sang DB, cần sửa _getWishlist() và toggleWishlist() trong index.html
-- để gọi sb.from('wishlists').insert/delete thay vì localStorage.
