-- 7. Criar tabelas para Regras de Desconto, Estoque e Memória do Chat
create table if not exists public.discount_rules (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null, -- 'first_purchase', 'pix', 'coupon'
  value numeric(10,2) not null,
  active boolean default true,
  conditions jsonb default '{}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.inventory_logs (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id),
  change_amount integer not null,
  reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.chat_memory (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id),
  summary text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS
alter table public.discount_rules enable row level security;
alter table public.inventory_logs enable row level security;
alter table public.chat_memory enable row level security;

-- 8. Políticas RLS básicas
drop policy if exists "Enable read for all" on public.discount_rules;
create policy "Enable read for all" on public.discount_rules for select using (true);
drop policy if exists "Enable all for authenticated" on public.discount_rules;
create policy "Enable all for authenticated" on public.discount_rules for all using (auth.role() = 'authenticated');
