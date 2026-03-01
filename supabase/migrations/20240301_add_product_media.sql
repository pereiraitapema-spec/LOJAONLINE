-- 1. Tabela de Mídia de Produtos
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('image', 'video')),
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Habilitar RLS
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Acesso
DROP POLICY IF EXISTS "Media pública" ON public.product_media;
CREATE POLICY "Media pública" ON public.product_media FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin gerencia media" ON public.product_media;
CREATE POLICY "Admin gerencia media" ON public.product_media FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  )
);

-- 4. Migrar imagem atual para a tabela de mídia (opcional, mas bom para consistência)
INSERT INTO public.product_media (product_id, url, type, position)
SELECT id, image_url, 'image', 0
FROM public.products
WHERE image_url IS NOT NULL AND image_url != ''
ON CONFLICT DO NOTHING;
