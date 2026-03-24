-- Run this in your Supabase SQL Editor to update the campaigns table

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS badge_text text,
ADD COLUMN IF NOT EXISTS button_text text DEFAULT 'VER AGORA',
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#000000',
ADD COLUMN IF NOT EXISTS text_color text DEFAULT '#ffffff';

-- Update existing campaigns to have default values if needed
UPDATE campaigns SET button_text = 'VER AGORA' WHERE button_text IS NULL;
UPDATE campaigns SET background_color = '#000000' WHERE background_color IS NULL;
UPDATE campaigns SET text_color = '#ffffff' WHERE text_color IS NULL;

-- Create payment_gateways table
CREATE TABLE IF NOT EXISTS payment_gateways (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  api_key text,
  config jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Ensure config column exists if table was already created
ALTER TABLE payment_gateways ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Create shipping_carriers table
CREATE TABLE IF NOT EXISTS shipping_carriers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  provider text NOT NULL,
  api_key text,
  config jsonb DEFAULT '{}'::jsonb,
  active boolean DEFAULT true,
  label_generation boolean DEFAULT false,
  tracking_notifications boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Ensure config column exists if table was already created
ALTER TABLE shipping_carriers ADD COLUMN IF NOT EXISTS config jsonb DEFAULT '{}'::jsonb;

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  status text DEFAULT 'disconnected',
  config jsonb DEFAULT '{}'::jsonb,
  last_sync timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Insert default integrations if they don't exist
INSERT INTO integrations (id, name, type)
VALUES 
  ('bling', 'Bling ERP', 'erp'),
  ('bitrix24', 'Bitrix24 CRM', 'crm'),
  ('tray', 'Tray E-commerce', 'marketplace')
ON CONFLICT (id) DO NOTHING;

-- Add tracking_pixels to store_settings
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS tracking_pixels jsonb DEFAULT '[]'::jsonb;

-- Inventory Logs Policies
DROP POLICY IF EXISTS "Enable all for authenticated" ON public.inventory_logs;
CREATE POLICY "Enable all for authenticated" ON public.inventory_logs FOR ALL USING (auth.role() = 'authenticated');
