-- ==========================================
-- 1. CONFIGURAÇÕES GERAIS E EXTENSÕES
-- ==========================================

-- Habilitar extensão para UUIDs se não estiver habilitada
create extension if not exists "uuid-ossp";

-- ==========================================
-- 2. TABELAS DE USUÁRIOS E PERFIS
-- ==========================================

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text,
  role text default 'customer' check (role in ('admin', 'customer', 'affiliate')),
  phone text,
  document text, -- CPF/CNPJ
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Trigger para criar profile automaticamente após signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'customer');
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger se existir para recriar
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ==========================================
-- 3. CATÁLOGO DE PRODUTOS
-- ==========================================

create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique, -- slug pode ser gerado via trigger ou app
  image_url text,
  icon text, -- Adicionado para suportar ícones
  active boolean default true,
  display_order integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.products (
  id uuid default gen_random_uuid() primary key,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text unique,
  description text,
  composition text, -- Adicionado
  price numeric(10,2) not null,
  cost_price numeric(10,2), -- Adicionado
  discount_price numeric(10,2), -- Adicionado
  promotional_price numeric(10,2), -- Mantido para compatibilidade
  affiliate_commission numeric(10,2) default 0, -- Adicionado
  stock integer default 0,
  image_url text, -- Imagem principal
  images jsonb default '[]'::jsonb, -- Array de URLs (Legacy/Backup)
  specifications jsonb default '{}'::jsonb,
  active boolean default true,
  featured boolean default false,
  sku text unique,
  weight_kg numeric(10,3) default 0,
  dimensions_cm jsonb default '{"width": 0, "height": 0, "depth": 0}'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Mídia do Produto (Galeria)
create table if not exists public.product_media (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  url text not null,
  type text default 'image' check (type in ('image', 'video')),
  position integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Tiers (Atacado/Escalonamento)
create table if not exists public.product_tiers (
  id uuid default gen_random_uuid() primary key,
  product_id uuid references public.products(id) on delete cascade,
  quantity integer not null,
  discount_percentage numeric(5,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Chaves de API
create table if not exists public.api_keys (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  service text not null, -- gemini, openai, etc
  key_value text not null,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 4. PEDIDOS E CARRINHO
-- ==========================================

create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  status text default 'pending' check (status in ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  total numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  shipping_cost numeric(10,2) default 0,
  discount numeric(10,2) default 0,
  payment_method text,
  payment_id text, -- ID externo (Stripe/MP)
  shipping_address jsonb not null,
  tracking_code text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  quantity integer not null check (quantity > 0),
  price numeric(10,2) not null, -- Preço unitário no momento da compra
  product_name text not null, -- Snapshot do nome
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 5. AFILIADOS E CUPONS
-- ==========================================

create table if not exists public.affiliates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  code text unique not null,
  commission_rate numeric(5,2) default 5.00, -- Porcentagem
  balance numeric(10,2) default 0,
  pix_key text,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.coupons (
  id uuid default gen_random_uuid() primary key,
  code text unique not null,
  discount_type text default 'percentage' check (discount_type in ('percentage', 'fixed')),
  value numeric(10,2) not null,
  min_purchase numeric(10,2) default 0,
  max_uses integer,
  used_count integer default 0,
  expires_at timestamp with time zone,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 6. CONFIGURAÇÕES DA LOJA (Mantendo existente)
-- ==========================================

create table if not exists public.store_settings (
  id uuid default gen_random_uuid() primary key,
  company_name text,
  cnpj text,
  address text,
  cep text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  facebook text,
  business_hours text,
  business_hours_details text,
  payment_methods jsonb default '[]'::jsonb,
  institutional_links jsonb default '[]'::jsonb,
  affiliate_terms text,
  top_bar_text text,
  promotions_section_title text,
  promotions_section_subtitle text,
  products_section_title text,
  products_section_subtitle text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Tabela de Banners (Carrossel)
create table if not exists public.banners (
  id uuid default gen_random_uuid() primary key,
  title text,
  url text not null,
  type text default 'image' check (type in ('image', 'video')),
  duration integer default 5,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 7. CORREÇÕES E MIGRAÇÕES (Mantendo existente)
-- ==========================================

-- Adicionar colunas faltantes na tabela campaigns se necessário
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'text_color') then
        alter table public.campaigns add column text_color text default '#ffffff';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'background_color') then
        alter table public.campaigns add column background_color text default '#000000';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'badge_text') then
        alter table public.campaigns add column badge_text text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'button_text') then
        alter table public.campaigns add column button_text text;
    end if;
end $$;

-- ==========================================
-- 8. POLÍTICAS DE SEGURANÇA (RLS)
-- ==========================================

-- Habilitar RLS em todas as tabelas
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_media enable row level security;
alter table public.product_tiers enable row level security;
alter table public.api_keys enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.affiliates enable row level security;
alter table public.store_settings enable row level security;

alter table public.banners enable row level security;

-- Policies para Banners
drop policy if exists "Public read banners" on public.banners;
create policy "Public read banners" on public.banners for select using (true);

drop policy if exists "Auth all banners" on public.banners;
create policy "Auth all banners" on public.banners for all using (auth.role() = 'authenticated');

-- Policies para Profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Policies para Produtos e Categorias (Público pode ler, Apenas Admin pode escrever)
drop policy if exists "Public read products" on public.products;
create policy "Public read products" on public.products for select using (true);

drop policy if exists "Public read categories" on public.categories;
create policy "Public read categories" on public.categories for select using (true);

drop policy if exists "Public read product_media" on public.product_media;
create policy "Public read product_media" on public.product_media for select using (true);

drop policy if exists "Public read product_tiers" on public.product_tiers;
create policy "Public read product_tiers" on public.product_tiers for select using (true);

-- Policies para API Keys (Apenas autenticado)
drop policy if exists "Auth read api_keys" on public.api_keys;
create policy "Auth read api_keys" on public.api_keys for select using (auth.role() = 'authenticated');

drop policy if exists "Auth insert api_keys" on public.api_keys;
create policy "Auth insert api_keys" on public.api_keys for insert with check (auth.role() = 'authenticated');

drop policy if exists "Auth update api_keys" on public.api_keys;
create policy "Auth update api_keys" on public.api_keys for update using (auth.role() = 'authenticated');

drop policy if exists "Auth delete api_keys" on public.api_keys;
create policy "Auth delete api_keys" on public.api_keys for delete using (auth.role() = 'authenticated');

-- Policies para Escrita em Produtos (Apenas autenticado/admin)
drop policy if exists "Auth insert products" on public.products;
create policy "Auth insert products" on public.products for insert with check (auth.role() = 'authenticated');

drop policy if exists "Auth update products" on public.products;
create policy "Auth update products" on public.products for update using (auth.role() = 'authenticated');

drop policy if exists "Auth delete products" on public.products;
create policy "Auth delete products" on public.products for delete using (auth.role() = 'authenticated');

drop policy if exists "Auth insert categories" on public.categories;
create policy "Auth insert categories" on public.categories for insert with check (auth.role() = 'authenticated');

drop policy if exists "Auth update categories" on public.categories;
create policy "Auth update categories" on public.categories for update using (auth.role() = 'authenticated');

drop policy if exists "Auth delete categories" on public.categories;
create policy "Auth delete categories" on public.categories for delete using (auth.role() = 'authenticated');

drop policy if exists "Auth all product_media" on public.product_media;
create policy "Auth all product_media" on public.product_media for all using (auth.role() = 'authenticated');

drop policy if exists "Auth all product_tiers" on public.product_tiers;
create policy "Auth all product_tiers" on public.product_tiers for all using (auth.role() = 'authenticated');

-- Policies para Pedidos
drop policy if exists "Users can view own orders" on public.orders;
create policy "Users can view own orders" on public.orders for select using (auth.uid() = user_id);

drop policy if exists "Users can create orders" on public.orders;
create policy "Users can create orders" on public.orders for insert with check (auth.uid() = user_id);

-- Policies para Store Settings (Público lê, Autenticado edita - refinar para admin depois)
drop policy if exists "Public read settings" on public.store_settings;
create policy "Public read settings" on public.store_settings for select using (true);

drop policy if exists "Auth update settings" on public.store_settings;
create policy "Auth update settings" on public.store_settings for update using (auth.role() = 'authenticated');

drop policy if exists "Auth insert settings" on public.store_settings;
create policy "Auth insert settings" on public.store_settings for insert with check (auth.role() = 'authenticated');

-- ==========================================
-- 9. DADOS INICIAIS (SEED)
-- ==========================================

insert into public.store_settings (company_name)
select 'Minha Loja'
where not exists (select 1 from public.store_settings);
