-- 1. Criar tabela de transportadoras
CREATE TABLE IF NOT EXISTS public.shipping_carriers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    provider text NOT NULL, -- 'melhorenvio', 'correios', 'test'
    active boolean DEFAULT true,
    config jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Habilitar RLS
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

-- 3. Políticas RLS
DROP POLICY IF EXISTS "Transportadoras visíveis para todos" ON public.shipping_carriers;
CREATE POLICY "Transportadoras visíveis para todos" ON public.shipping_carriers
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Apenas admins podem modificar transportadoras" ON public.shipping_carriers;
CREATE POLICY "Apenas admins podem modificar transportadoras" ON public.shipping_carriers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 4. Inserir transportadora de teste se não houver nenhuma
INSERT INTO public.shipping_carriers (name, provider, active, config)
SELECT 'Melhor Envio (Simulação)', 'melhorenvio', true, '{"api_key": "test_key", "label_generation": true, "tracking_notifications": true}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_carriers);

-- 5. Garantir que store_settings tenha origin_zip_code
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS origin_zip_code text;

UPDATE public.store_settings 
SET origin_zip_code = '88371-790' 
WHERE origin_zip_code IS NULL;

-- 6. Garantir que produtos tenham dimensões
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0.5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height numeric DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width numeric DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length numeric DEFAULT 10;
