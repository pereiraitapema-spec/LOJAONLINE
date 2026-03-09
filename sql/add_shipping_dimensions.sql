-- Add dimensions to products table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0.5; -- kg
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS height numeric DEFAULT 10; -- cm
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS width numeric DEFAULT 10; -- cm
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS length numeric DEFAULT 10; -- cm

-- Add origin_zip_code to store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS origin_zip_code text;
