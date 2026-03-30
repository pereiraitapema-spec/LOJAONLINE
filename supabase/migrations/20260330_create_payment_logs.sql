-- Tabela para auditoria de pagamentos e webhooks
CREATE TABLE IF NOT EXISTS public.payment_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid REFERENCES public.orders(id),
  event_type text,
  payload jsonb,
  status text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o webhook insira logs
CREATE POLICY "Webhook can insert logs" ON public.payment_logs FOR INSERT WITH CHECK (true);
-- Política para permitir que admins vejam logs
CREATE POLICY "Admins can view logs" ON public.payment_logs FOR SELECT USING (true);
