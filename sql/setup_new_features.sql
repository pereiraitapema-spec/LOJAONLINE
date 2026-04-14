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

-- 9. Criar tabela de mensagens do chat
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references auth.users(id) not null,
  receiver_id uuid references auth.users(id) not null,
  message text not null,
  is_read boolean default false,
  source text default 'vendas', -- 'vendas' ou 'afiliados'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. Criar tabela de conteúdo do site
create table if not exists public.site_content (
  id uuid default gen_random_uuid() primary key,
  key text unique not null,
  value text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. Criar tabela de sessões de chat
create table if not exists public.chat_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) not null,
  mode text default 'ai' check (mode in ('ai', 'human')),
  last_message_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.chat_messages enable row level security;
alter table public.site_content enable row level security;
alter table public.chat_sessions enable row level security;

drop policy if exists "Enable read for all" on public.site_content;
create policy "Enable read for all" on public.site_content for select using (true);

drop policy if exists "Enable all for admin" on public.site_content;
create policy "Enable read for all" on public.site_content for select using (true);
create policy "Enable all for admin" on public.site_content for all using (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

create policy "Users can read their own sessions" on public.chat_sessions for select using (auth.uid() = user_id);
create policy "Admin can read all sessions" on public.chat_sessions for select using (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');
create policy "Admin can update all sessions" on public.chat_sessions for update using (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

drop policy if exists "Users can read their own messages" on public.chat_messages;
create policy "Users can read their own messages" on public.chat_messages for select using (auth.uid() = sender_id or auth.uid() = receiver_id);

drop policy if exists "Admin can read all messages" on public.chat_messages;
create policy "Admin can read all messages" on public.chat_messages for select using (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

drop policy if exists "Users can insert their own messages" on public.chat_messages;
create policy "Users can insert their own messages" on public.chat_messages for insert with check (auth.uid() = sender_id);
