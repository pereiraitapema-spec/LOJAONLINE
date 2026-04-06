-- Criar tabela de logs de envio
create table if not exists public.shipping_logs (
  id uuid default gen_random_uuid(),
  order_id text,
  status text,
  error text,
  payload jsonb,
  response jsonb,
  created_at timestamp default now(),
  primary key (id)
);
