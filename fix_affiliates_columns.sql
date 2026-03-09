-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE
-- Isso adiciona as colunas necessárias para salvar Nome, Email e WhatsApp dos afiliados

ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS whatsapp text;

-- Remove a restrição de "Não Nulo" da coluna código, pois ela é gerada na aprovação
ALTER TABLE public.affiliates ALTER COLUMN code DROP NOT NULL;

-- Garante que o cache do esquema seja atualizado
NOTIFY pgrst, 'reload schema';
