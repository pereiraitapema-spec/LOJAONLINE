-- Garantir colunas na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_value numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_document text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total numeric NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric NOT NULL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;

-- Garantir colunas na tabela order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price numeric NOT NULL;

-- Garantir que a tabela inventory_logs existe
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id),
    change_amount integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS e Políticas
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para orders
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
CREATE POLICY "Anyone can insert orders" ON public.orders FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);

-- Políticas para order_items
DROP POLICY IF EXISTS "Anyone can insert order_items" ON public.order_items;
CREATE POLICY "Anyone can insert order_items" ON public.order_items FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own order_items" ON public.order_items;
CREATE POLICY "Users can view their own order_items" ON public.order_items FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
    )
);

-- Políticas para inventory_logs
DROP POLICY IF EXISTS "Anyone can insert inventory_logs" ON public.inventory_logs;
CREATE POLICY "Anyone can insert inventory_logs" ON public.inventory_logs FOR INSERT WITH CHECK (true);
