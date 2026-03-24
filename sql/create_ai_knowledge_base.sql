-- Tabela para Memória/Conhecimento da IA
CREATE TABLE IF NOT EXISTS public.ai_knowledge_base (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  topic TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read knowledge" ON public.ai_knowledge_base FOR SELECT USING (true);
CREATE POLICY "Admin all knowledge" ON public.ai_knowledge_base FOR ALL USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER on_knowledge_updated
  BEFORE UPDATE ON public.ai_knowledge_base
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
