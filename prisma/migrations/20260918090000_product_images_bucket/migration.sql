-- Public bucket for product photos (Kasir product cards). Anyone can read
-- (the images are shown on the cashier screen, no secrets); only an active
-- OWNER can write — enforced here in storage RLS, and again by the
-- requireRole("OWNER") server action that does the upload.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 2097152, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_pos_owner() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User"
    WHERE "authUserId" = auth.uid() AND "role" = 'OWNER' AND "isActive"
  );
$$;

REVOKE ALL ON FUNCTION public.is_pos_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_pos_owner() TO authenticated;

CREATE POLICY "product_images_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_pos_owner());

CREATE POLICY "product_images_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_pos_owner())
  WITH CHECK (bucket_id = 'product-images' AND public.is_pos_owner());

CREATE POLICY "product_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_pos_owner());

CREATE POLICY "product_images_owner_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND public.is_pos_owner());
