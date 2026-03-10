-- Create abandoned carts table if it doesn't exist
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'recovered')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist (for existing tables)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='abandoned_carts' AND column_name='cart_items') THEN
        ALTER TABLE abandoned_carts ADD COLUMN cart_items JSONB NOT NULL DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Add commission_rate to affiliates
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='affiliates' AND column_name='commission_rate') THEN
        ALTER TABLE affiliates ADD COLUMN commission_rate DECIMAL(5,2) DEFAULT 10.00;
    END IF;
END $$;

-- Add phone to profiles
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create policies idempotently
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandoned_carts' AND policyname = 'Enable insert for anonymous users') THEN
        CREATE POLICY "Enable insert for anonymous users" ON abandoned_carts FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandoned_carts' AND policyname = 'Enable update for anonymous users') THEN
        CREATE POLICY "Enable update for anonymous users" ON abandoned_carts FOR UPDATE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'abandoned_carts' AND policyname = 'Enable read for authenticated users') THEN
        CREATE POLICY "Enable read for authenticated users" ON abandoned_carts FOR SELECT TO authenticated USING (true);
    END IF;
END $$;
