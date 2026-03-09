-- FIX: Adicionar coluna 'config' nas tabelas de Gateways e Transportadoras
-- Execute este script no SQL Editor do seu Supabase

ALTER TABLE public.payment_gateways ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.shipping_carriers ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Garantir que as permissões RLS permitam a edição para Admins
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_carriers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem tudo em payment_gateways" ON public.payment_gateways;
CREATE POLICY "Admins podem tudo em payment_gateways" ON public.payment_gateways
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins podem tudo em shipping_carriers" ON public.shipping_carriers;
CREATE POLICY "Admins podem tudo em shipping_carriers" ON public.shipping_carriers
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Todos podem ver gateways ativos" ON public.payment_gateways;
CREATE POLICY "Todos podem ver gateways ativos" ON public.payment_gateways
FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "Todos podem ver transportadoras ativas" ON public.shipping_carriers;
CREATE POLICY "Todos podem ver transportadoras ativas" ON public.shipping_carriers
FOR SELECT USING (active = true);
