-- 1. Criar campos necessários no Supabase
alter table orders 
add column if not exists tracking_code text;

alter table orders 
add column if not exists shipping_label_url text;

alter table orders 
add column if not exists shipping_declaration_url text;

alter table orders 
add column if not exists shipping_receipt text;

alter table orders 
add column if not exists erro_etiqueta text;

alter table orders 
add column if not exists shipping_status text;

alter table orders 
add column if not exists etiqueta_gerada boolean default false;

-- 2. Corrigir status permitidos
alter table orders drop constraint if exists orders_status_check;

alter table orders 
add constraint orders_status_check 
check (
status in (
'pending',
'paid',
'processing',
'shipped',
'delivered',
'cancelled',
'failed'
)
);
