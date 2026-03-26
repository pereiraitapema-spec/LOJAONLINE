-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Configurações da Loja (Ajustar se já existir)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    top_bar_text text DEFAULT 'Envio Brasil! 7 dias devolução, 10x sem juros, WhatsApp',
    tagline text DEFAULT 'Suplementos Naturais para Vida Saudável',
    free_shipping_threshold numeric DEFAULT 299.90,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas faltantes na store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_name TEXT DEFAULT 'Magnifique4Life';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS min_installment_value DECIMAL(10,2) DEFAULT 50.00;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS support_whatsapp TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS support_email TEXT;

-- 3. Tabela de Gateways de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'pagarme', 'mercadopago', etc.
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabela de Transportadoras
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'cepcerto', 'melhorenvio', etc.
  active BOOLEAN DEFAULT true,
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Tabela de Pedidos (Garantir colunas novas)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_document TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS affiliate_id UUID REFERENCES public.affiliates(id);
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_value DECIMAL(10,2) DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_address JSONB;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS commission_value DECIMAL(10,2) DEFAULT 0;

-- 6. Tabela de Itens do Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Tabela de Logs de Inventário
CREATE TABLE IF NOT EXISTS public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  change_amount INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Tabela de Carrinhos Abandonados
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  customer_data JSONB,
  items JSONB NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Tabela de Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  status TEXT DEFAULT 'frio',
  source TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Inserir dados iniciais de forma segura
DO $$
BEGIN
    -- Inserir configuração se não houver nenhuma
    IF NOT EXISTS (SELECT 1 FROM public.store_settings) THEN
        INSERT INTO public.store_settings (store_name, top_bar_text) 
        VALUES ('Magnifique4Life', 'Envio Brasil! 7 dias devolução, 10x sem juros, WhatsApp');
    END IF;

    -- Inserir Pagar.me se não houver
    IF NOT EXISTS (SELECT 1 FROM public.payment_gateways WHERE provider = 'pagarme') THEN
        INSERT INTO public.payment_gateways (name, provider, active, config)
        VALUES ('Pagar.me', 'pagarme', true, '{"public_key": "", "access_token": ""}'::jsonb);
    END IF;

    -- Inserir CepCerto se não houver
    IF NOT EXISTS (SELECT 1 FROM public.shipping_carriers WHERE provider = 'cepcerto') THEN
        INSERT INTO public.shipping_carriers (name, provider, active, config)
        VALUES ('CepCerto', 'cepcerto', true, '{"api_key": "", "origin_zip": "88240000", "services": {"pac": true, "sedex": true, "jadlog": true}}'::jsonb);
    END IF;
END $$;

-- 11. Habilitar RLS e Políticas (Exemplo para orders)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários podem ver seus próprios pedidos" ON public.orders;
CREATE POLICY "Usuários podem ver seus próprios pedidos" ON public.orders
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
