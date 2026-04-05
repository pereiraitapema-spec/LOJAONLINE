-- 1. Criar campos necessários no Supabase
alter table public.orders 
add column if not exists etiqueta_manual boolean default false;

alter table public.orders 
add column if not exists payment_status text;

alter table public.orders 
add column if not exists webhook_id uuid;
