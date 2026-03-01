-- Adicionar coluna cost_price na tabela products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
