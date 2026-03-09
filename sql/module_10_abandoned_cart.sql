-- Módulo 10: Recuperação de Carrinho Abandonado
-- Execute este script no SQL Editor do seu Supabase

-- 1. Criar tabela de Carrinhos Abandonados se não existir
CREATE TABLE IF NOT EXISTS public.abandoned_carts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_email text NOT NULL,
    customer_name text,
    customer_phone text,
    cart_items jsonb DEFAULT '[]'::jsonb,
    total numeric(10,2) DEFAULT 0,
    status text DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'recovered', 'notified')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Adicionar coluna de Webhook n8n em store_settings se não existir
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS n8n_webhook_url text;

-- 3. Habilitar RLS para abandoned_carts
ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

-- 4. Políticas RLS para abandoned_carts
DROP POLICY IF EXISTS "Admins podem ver todos os carrinhos abandonados" ON public.abandoned_carts;
CREATE POLICY "Admins podem ver todos os carrinhos abandonados" ON public.abandoned_carts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Permitir que o checkout insira/atualize carrinhos (público ou autenticado)
DROP POLICY IF EXISTS "Qualquer um pode criar/atualizar seu carrinho abandonado" ON public.abandoned_carts;
CREATE POLICY "Qualquer um pode criar/atualizar seu carrinho abandonado" ON public.abandoned_carts
    FOR ALL USING (true) WITH CHECK (true);

-- 5. Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS on_abandoned_carts_updated ON public.abandoned_carts;
CREATE TRIGGER on_abandoned_carts_updated
    BEFORE UPDATE ON public.abandoned_carts
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
