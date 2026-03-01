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
