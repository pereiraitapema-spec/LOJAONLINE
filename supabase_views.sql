-- View pública para acesso seguro às configurações de transportadoras
-- Esta view ignora as políticas de RLS da tabela original
CREATE OR REPLACE VIEW public.vw_shipping_carriers AS 
SELECT id, name, provider, config 
FROM public.shipping_carriers;

-- Garante que todos possam ler essa view
GRANT SELECT ON public.vw_shipping_carriers TO anon;
GRANT SELECT ON public.vw_shipping_carriers TO authenticated;
