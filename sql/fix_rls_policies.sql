-- 1. Allow public inserts for guest checkout
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.orders;
CREATE POLICY "Enable insert for all" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.order_items;
CREATE POLICY "Enable insert for all" ON public.order_items FOR INSERT WITH CHECK (true);

-- 2. Allow public read for orders if we want to show success page without login (using ID)
DROP POLICY IF EXISTS "Enable read for users based on user_id" ON public.orders;
CREATE POLICY "Enable read for all" ON public.orders FOR SELECT USING (true);

-- 3. Abandoned Carts policies
DROP POLICY IF EXISTS "Enable all for admins" ON public.abandoned_carts;
CREATE POLICY "Enable all for all" ON public.abandoned_carts FOR ALL USING (true);

-- 4. Affiliates read access
DROP POLICY IF EXISTS "Enable read for all" ON public.affiliates;
CREATE POLICY "Enable read for all" ON public.affiliates FOR SELECT USING (true);

-- 5. Shipping Carriers read access for checkout
DROP POLICY IF EXISTS "Enable read for all" ON public.shipping_carriers;
CREATE POLICY "Enable read for all" ON public.shipping_carriers FOR SELECT USING (true);

-- 6. Store Settings read access for checkout
DROP POLICY IF EXISTS "Enable read for all" ON public.store_settings;
CREATE POLICY "Enable read for all" ON public.store_settings FOR SELECT USING (true);
