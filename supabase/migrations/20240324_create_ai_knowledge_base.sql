-- Tabela para armazenar o conhecimento "aprendido" pela IA
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    topic text UNIQUE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Conhecimento público" ON public.ai_knowledge_base;
CREATE POLICY "Conhecimento público" ON public.ai_knowledge_base FOR SELECT USING (true);

DROP POLICY IF EXISTS "Qualquer um pode inserir conhecimento" ON public.ai_knowledge_base;
CREATE POLICY "Qualquer um pode inserir conhecimento" ON public.ai_knowledge_base FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Qualquer um pode atualizar conhecimento" ON public.ai_knowledge_base;
CREATE POLICY "Qualquer um pode atualizar conhecimento" ON public.ai_knowledge_base FOR UPDATE USING (true);
