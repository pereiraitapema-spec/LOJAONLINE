-- Adicionar colunas faltantes na tabela api_keys
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS priority integer DEFAULT 0;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS last_used_at timestamp with time zone;

-- Adicionar coluna de regras na tabela categories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS rules text;
