-- Garantir que a tabela products tenha todas as colunas necessárias
DO $$ 
BEGIN 
    -- Adicionar cost_price se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='cost_price') THEN
        ALTER TABLE public.products ADD COLUMN cost_price DECIMAL(10,2);
    END IF;

    -- Adicionar composition se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='composition') THEN
        ALTER TABLE public.products ADD COLUMN composition TEXT;
    END IF;

    -- Adicionar affiliate_commission se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='affiliate_commission') THEN
        ALTER TABLE public.products ADD COLUMN affiliate_commission DECIMAL(10,2) DEFAULT 0;
    END IF;

    -- Adicionar discount_price se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_price') THEN
        ALTER TABLE public.products ADD COLUMN discount_price DECIMAL(10,2);
    END IF;

    -- Adicionar stock se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock') THEN
        ALTER TABLE public.products ADD COLUMN stock INTEGER DEFAULT 0;
    END IF;

    -- Adicionar active se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='active') THEN
        ALTER TABLE public.products ADD COLUMN active BOOLEAN DEFAULT true;
    END IF;

    -- Criar tabela categories se não existir
    CREATE TABLE IF NOT EXISTS public.categories (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Criar tabela product_tiers se não existir
    CREATE TABLE IF NOT EXISTS public.product_tiers (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        discount_percentage DECIMAL(5,2) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT now()
    );

    -- Habilitar RLS para product_tiers
    ALTER TABLE public.product_tiers ENABLE ROW LEVEL SECURITY;

    -- Políticas para product_tiers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_tiers' AND policyname = 'Tiers públicos') THEN
        CREATE POLICY "Tiers públicos" ON public.product_tiers FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'product_tiers' AND policyname = 'Admin gerencia tiers') THEN
        CREATE POLICY "Admin gerencia tiers" ON public.product_tiers FOR ALL USING (
            EXISTS (
                SELECT 1 FROM public.profiles
                WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
            )
        );
    END IF;
    -- Adicionar slug se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='slug') THEN
        ALTER TABLE public.products ADD COLUMN slug TEXT UNIQUE;
    END IF;

    -- Adicionar position se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='position') THEN
        ALTER TABLE public.products ADD COLUMN position INTEGER DEFAULT 0;
    END IF;

    -- Adicionar created_at se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='created_at') THEN
        ALTER TABLE public.products ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
    END IF;

    -- Garantir coluna active na api_keys
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='api_keys') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='active') THEN
            ALTER TABLE public.api_keys ADD COLUMN active BOOLEAN DEFAULT true;
        END IF;
    END IF;
END $$;
