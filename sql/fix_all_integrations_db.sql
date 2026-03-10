-- 1. Tabela de Gateways de Pagamento
CREATE TABLE IF NOT EXISTS public.payment_gateways (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL,
    active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela de Integrações
CREATE TABLE IF NOT EXISTS public.integrations (
    id text PRIMARY KEY,
    name text NOT NULL,
    type text NOT NULL,
    status text DEFAULT 'disconnected',
    config jsonb DEFAULT '{}'::jsonb,
    last_sync timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela de Transportadoras (já criada no outro script, mas garantindo aqui)
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL,
    active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Habilitar RLS
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

-- 5. Políticas RLS
DROP POLICY IF EXISTS "Public read for payment_gateways" ON public.payment_gateways;
CREATE POLICY "Public read for payment_gateways" ON public.payment_gateways FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin all for payment_gateways" ON public.payment_gateways;
CREATE POLICY "Admin all for payment_gateways" ON public.payment_gateways FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

DROP POLICY IF EXISTS "Public read for integrations" ON public.integrations;
CREATE POLICY "Public read for integrations" ON public.integrations FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin all for integrations" ON public.integrations;
CREATE POLICY "Admin all for integrations" ON public.integrations FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

DROP POLICY IF EXISTS "Public read for shipping_carriers" ON public.shipping_carriers;
CREATE POLICY "Public read for shipping_carriers" ON public.shipping_carriers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin all for shipping_carriers" ON public.shipping_carriers;
CREATE POLICY "Admin all for shipping_carriers" ON public.shipping_carriers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
);

-- 6. Inserir dados iniciais se vazio
INSERT INTO public.payment_gateways (name, provider, active, config)
SELECT 'Mercado Pago (Simulado)', 'mercadopago', true, '{"public_key": "test", "access_token": "test"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_gateways);

INSERT INTO public.shipping_carriers (name, provider, active, config)
SELECT 'Melhor Envio (Simulação)', 'melhorenvio', true, '{"api_key": "test", "label_generation": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_carriers);

INSERT INTO public.integrations (id, name, type, status)
VALUES 
('bling', 'Bling ERP', 'erp', 'disconnected'),
('bitrix24', 'Bitrix24 CRM', 'crm', 'disconnected'),
('n8n', 'n8n / Automação', 'automation', 'disconnected'),
('evolution', 'Evolution API (WhatsApp)', 'whatsapp', 'disconnected')
ON CONFLICT (id) DO NOTHING;
