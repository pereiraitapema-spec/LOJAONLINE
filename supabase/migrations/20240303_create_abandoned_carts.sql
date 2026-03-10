-- Create abandoned carts table
CREATE TABLE IF NOT EXISTS abandoned_carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_email TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  cart_items JSONB NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'abandoned' CHECK (status IN ('abandoned', 'recovered')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable insert for anonymous users" ON abandoned_carts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for anonymous users" ON abandoned_carts
  FOR UPDATE USING (true);

CREATE POLICY "Enable read for authenticated users" ON abandoned_carts
  FOR SELECT TO authenticated USING (true);
