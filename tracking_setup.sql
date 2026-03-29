-- Adicionar colunas para rastreamento público se necessário
-- A tabela orders já possui tracking_code e status.
-- Vamos garantir que a política de RLS permita que o cliente veja seu próprio pedido.

-- Política para permitir que o cliente veja o status do seu próprio pedido
DROP POLICY IF EXISTS "Clientes podem ver seus próprios pedidos" ON public.orders;
CREATE POLICY "Clientes podem ver seus próprios pedidos" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

-- Se precisar de uma tabela separada para histórico de rastreio detalhado:
CREATE TABLE IF NOT EXISTS public.tracking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.tracking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clientes podem ver histórico de seus pedidos" ON public.tracking_history
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = tracking_history.order_id AND orders.user_id = auth.uid()));
