-- Script para corrigir erros ao salvar produtos e garantir tabelas necessárias

-- 1. Garantir que a tabela profiles existe
CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email text,
    full_name text,
    phone text,
    role text DEFAULT 'customer',
    marketing_opt_in boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Função para verificar se o usuário é admin sem causar recursão infinita
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS para profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles
DROP POLICY IF EXISTS "Perfis são visíveis pelos próprios usuários" ON public.profiles;
CREATE POLICY "Perfis são visíveis pelos próprios usuários" ON public.profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
CREATE POLICY "Usuários podem atualizar seus próprios perfis" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON public.profiles FOR ALL USING (
    auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
    OR public.is_admin()
);

-- 2. Garantir que a tabela categories existe
CREATE TABLE IF NOT EXISTS public.categories (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    slug text UNIQUE,
    icon text,
    image_url text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Políticas para categories
DROP POLICY IF EXISTS "Categorias públicas" ON public.categories;
CREATE POLICY "Categorias públicas" ON public.categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia categorias" ON public.categories;
CREATE POLICY "Admin gerencia categorias" ON public.categories FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

-- 3. Garantir que a tabela products existe e tem todas as colunas
CREATE TABLE IF NOT EXISTS public.products (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    sku text,
    description text,
    composition text,
    price numeric NOT NULL DEFAULT 0,
    cost_price numeric DEFAULT 0,
    tax_percentage numeric DEFAULT 0,
    shipping_cost numeric DEFAULT 0,
    operational_cost numeric DEFAULT 0,
    marketing_cost numeric DEFAULT 0,
    discount_price numeric,
    affiliate_commission numeric DEFAULT 0,
    stock integer DEFAULT 0,
    min_installment_value numeric DEFAULT 50,
    image_url text,
    active boolean DEFAULT true,
    weight numeric DEFAULT 0.5,
    height numeric DEFAULT 10,
    width numeric DEFAULT 10,
    length numeric DEFAULT 10,
    category_id uuid REFERENCES public.categories(id),
    slug text UNIQUE,
    position integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Adicionar colunas faltantes caso a tabela já exista
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS composition text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_percentage numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS shipping_cost numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS operational_cost numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS marketing_cost numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS discount_price numeric;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS affiliate_commission numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock integer DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_installment_value numeric DEFAULT 50;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0.5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height numeric DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width numeric DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length numeric DEFAULT 10;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id);

-- Habilitar RLS para products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Políticas para products
DROP POLICY IF EXISTS "Produtos públicos" ON public.products;
CREATE POLICY "Produtos públicos" ON public.products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia produtos" ON public.products;
CREATE POLICY "Admin gerencia produtos" ON public.products FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

-- 4. Garantir que a tabela product_tiers existe
CREATE TABLE IF NOT EXISTS public.product_tiers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    quantity integer NOT NULL,
    discount_percentage numeric NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para product_tiers
ALTER TABLE public.product_tiers ENABLE ROW LEVEL SECURITY;

-- Políticas para product_tiers
DROP POLICY IF EXISTS "Tiers públicos" ON public.product_tiers;
CREATE POLICY "Tiers públicos" ON public.product_tiers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia tiers" ON public.product_tiers;
CREATE POLICY "Admin gerencia tiers" ON public.product_tiers FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

-- 5. Garantir que a tabela product_media existe
CREATE TABLE IF NOT EXISTS public.product_media (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
    url text NOT NULL,
    type text NOT NULL CHECK (type IN ('image', 'video')),
    position integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para product_media
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- Políticas para product_media
DROP POLICY IF EXISTS "Media pública" ON public.product_media;
CREATE POLICY "Media pública" ON public.product_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia media" ON public.product_media;
CREATE POLICY "Admin gerencia media" ON public.product_media FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

-- 6. Garantir colunas na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS operational_cost numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS marketing_cost numeric DEFAULT 0;

-- 7. Garantir que a tabela inventory_logs existe
CREATE TABLE IF NOT EXISTS public.inventory_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES public.products(id),
    change_amount integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS para inventory_logs
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para inventory_logs
DROP POLICY IF EXISTS "Admin vê logs de estoque" ON public.inventory_logs;
CREATE POLICY "Admin vê logs de estoque" ON public.inventory_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
    OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);
