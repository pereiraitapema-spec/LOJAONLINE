-- Adicionar coluna de cápsulas à tabela de produtos
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS capsules integer DEFAULT 60;
