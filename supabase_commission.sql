
-- Add affiliate_commission to products table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'affiliate_commission') THEN
        ALTER TABLE products ADD COLUMN affiliate_commission NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add commission_value to orders table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'commission_value') THEN
        ALTER TABLE orders ADD COLUMN commission_value NUMERIC DEFAULT 0;
    END IF;
END $$;
