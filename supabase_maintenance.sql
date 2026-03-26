-- 1. Garantir colunas necessárias na tabela orders para checkout e logística
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pix_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_method text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_provider text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_gateway text;

-- 2. Garantir coluna de CEP de origem nas configurações da loja
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS origin_zip_code text;

-- 3. Limpeza de duplicatas em payment_gateways (mantendo o mais recente)
DELETE FROM public.payment_gateways 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY provider ORDER BY created_at DESC) as rn
        FROM public.payment_gateways
    ) t WHERE rn = 1
);

-- 4. Limpeza de duplicatas em shipping_carriers (mantendo o mais recente)
DELETE FROM public.shipping_carriers 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY provider ORDER BY created_at DESC) as rn
        FROM public.shipping_carriers
    ) t WHERE rn = 1
);

-- 4.1 Limpeza de duplicatas em store_settings (mantendo o mais recente)
DELETE FROM public.store_settings 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
        FROM public.store_settings
    ) t WHERE rn = 1
);

-- 4.2 Garantir CEP de origem padrão se estiver nulo (Ex: São Paulo)
UPDATE public.store_settings 
SET origin_zip_code = '01001000' 
WHERE origin_zip_code IS NULL OR origin_zip_code = '';

-- 5. Garantir configuração padrão do Pagar.me se não existir
INSERT INTO public.payment_gateways (name, provider, active, config)
SELECT 'Pagar.me', 'pagarme', true, '{"public_key": "", "access_token": ""}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.payment_gateways WHERE provider = 'pagarme');

-- 6. Garantir configuração padrão do CepCerto se não existir
INSERT INTO public.shipping_carriers (name, provider, active, config)
SELECT 'CepCerto', 'cepcerto', true, '{"api_key": "", "api_key_postagem": "", "services": {"pac": true, "sedex": true, "jadlog": true}}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.shipping_carriers WHERE provider = 'cepcerto');

-- 7. Atualizar políticas de RLS para permitir visualização de gateways e carriers ativos
DROP POLICY IF EXISTS "Permitir visualização de gateways ativos" ON public.payment_gateways;
CREATE POLICY "Permitir visualização de gateways ativos" ON public.payment_gateways
    FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Permitir visualização de carriers ativos" ON public.shipping_carriers;
CREATE POLICY "Permitir visualização de carriers ativos" ON public.shipping_carriers
    FOR SELECT USING (active = true);
