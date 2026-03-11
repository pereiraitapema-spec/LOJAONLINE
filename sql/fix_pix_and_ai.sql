-- Fix PIX columns in affiliates
ALTER TABLE public.affiliates 
ADD COLUMN IF NOT EXISTS pix_name text,
ADD COLUMN IF NOT EXISTS pix_cpf text,
ADD COLUMN IF NOT EXISTS pix_bank text,
ADD COLUMN IF NOT EXISTS pix_account text,
ADD COLUMN IF NOT EXISTS pix_agency text,
ADD COLUMN IF NOT EXISTS total_paid numeric(10,2) default 0;

-- Fix PIX columns in affiliate_payments
ALTER TABLE public.affiliate_payments 
ADD COLUMN IF NOT EXISTS pix_name text,
ADD COLUMN IF NOT EXISTS pix_cpf text,
ADD COLUMN IF NOT EXISTS pix_bank text,
ADD COLUMN IF NOT EXISTS pix_account text,
ADD COLUMN IF NOT EXISTS pix_agency text;

-- Add AI Chat settings to store_settings
ALTER TABLE public.store_settings 
ADD COLUMN IF NOT EXISTS ai_chat_rules text,
ADD COLUMN IF NOT EXISTS ai_chat_triggers text;
