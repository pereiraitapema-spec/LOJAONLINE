-- Adicionar campo de ícone na tabela de categorias
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS icon text;

-- Criar tabela de configurações da loja (opcional, mas recomendado para o top bar)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    top_bar_text text DEFAULT 'Envio Brasil! 7 dias devolução, 10x sem juros, WhatsApp',
    tagline text DEFAULT 'Suplementos Naturais para Vida Saudável',
    free_shipping_threshold numeric DEFAULT 299.90,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir configuração padrão se não existir
INSERT INTO public.store_settings (top_bar_text, tagline, free_shipping_threshold)
SELECT 'Envio Brasil! 7 dias devolução, 10x sem juros, WhatsApp', 'Suplementos Naturais para Vida Saudável', 299.90
WHERE NOT EXISTS (SELECT 1 FROM public.store_settings);

-- Configurar RLS para store_settings
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Configurações visíveis para todos" ON public.store_settings
    FOR SELECT USING (true);

CREATE POLICY "Apenas admins podem modificar configurações" ON public.store_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );
