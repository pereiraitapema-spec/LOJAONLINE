
-- Add new columns to campaigns table to support advanced rules and discounts
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS discount_value NUMERIC,
ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'percentage',
ADD COLUMN IF NOT EXISTS trigger_type TEXT DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS trigger_value NUMERIC,
ADD COLUMN IF NOT EXISTS coupon_code TEXT,
ADD COLUMN IF NOT EXISTS badge_text TEXT,
ADD COLUMN IF NOT EXISTS button_text TEXT,
ADD COLUMN IF NOT EXISTS background_color TEXT,
ADD COLUMN IF NOT EXISTS text_color TEXT;

-- Add comment to explain columns
COMMENT ON COLUMN campaigns.discount_type IS 'Type of discount: percentage or fixed';
COMMENT ON COLUMN campaigns.trigger_type IS 'Type of trigger: automatic, coupon, min_value, first_purchase';
