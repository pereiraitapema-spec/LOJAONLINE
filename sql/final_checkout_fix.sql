-- 1. Tabela de Transportadoras
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL,
    active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Gateways de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL,
    active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Integrações
CREATE TABLE IF NOT EXISTS public.integrations (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'disconnected',
    config jsonb DEFAULT '{}'::jsonb,
    last_sync timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Garantir colunas na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_value numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_document text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS subtotal numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;

-- 5. Garantir colunas na tabela order_items
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS price numeric DEFAULT 0;

-- 6. Garantir colunas na tabela affiliates
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS total_paid numeric DEFAULT 0;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 10;

-- 7. Tabela de Cupons de Afiliados
CREATE TABLE IF NOT EXISTS public.affiliate_coupons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id uuid REFERENCES public.affiliates(id),
    code text NOT NULL UNIQUE,
    discount_percentage numeric NOT NULL,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Tabela de Pagamentos de Afiliados
CREATE TABLE IF NOT EXISTS public.affiliate_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id uuid REFERENCES public.affiliates(id),
    amount numeric NOT NULL,
    status text DEFAULT 'pending',
    pix_key text,
    receipt_url text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Habilitar RLS em todas as tabelas novas
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payments ENABLE ROW LEVEL SECURITY;

-- 10. Políticas RLS (Simplificadas para garantir funcionamento)
DO $$ 
BEGIN 
    -- shipping_carriers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shipping_carriers' AND policyname = 'Public read') THEN
        CREATE POLICY "Public read" ON public.shipping_carriers FOR SELECT USING (true);
    END IF;
    
    -- payment_gateways
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_gateways' AND policyname = 'Public read') THEN
        CREATE POLICY "Public read" ON public.payment_gateways FOR SELECT USING (true);
    END IF;
    
    -- affiliate_coupons
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'affiliate_coupons' AND policyname = 'Public read') THEN
        CREATE POLICY "Public read" ON public.affiliate_coupons FOR SELECT USING (true);
    END IF;

    -- orders (Insert para todos no checkout)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Anyone can insert') THEN
        CREATE POLICY "Anyone can insert" ON public.orders FOR INSERT WITH CHECK (true);
    END IF;
    
    -- order_items (Insert para todos no checkout)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Anyone can insert') THEN
        CREATE POLICY "Anyone can insert" ON public.order_items FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 11. Dados iniciais
INSERT INTO public.shipping_carriers (name, provider, active, config)
SELECT 'Melhor Envio (Simulação)', 'melhorenvio', true, '{"api_key": "test", "label_generation": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_carriers);

INSERT INTO public.payment_gateways (name, provider, active, config)
SELECT 'Mercado Pago (Simulado)', 'mercadopago', true, '{"public_key": "test", "access_token": "test"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_gateways);

-- Garantir origin_zip_code em store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS origin_zip_code text;
UPDATE public.store_settings SET origin_zip_code = '88371-790' WHERE origin_zip_code IS NULL;
