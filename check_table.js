import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // Try to insert a dummy row to see if table exists
  const { error } = await supabase.from('abandoned_carts').select('id').limit(1);
  if (error && error.code === '42P01') {
    console.log('Table does not exist. Please run the SQL migration manually in Supabase SQL Editor.');
    console.log(`
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

ALTER TABLE abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable insert for anonymous users" ON abandoned_carts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for anonymous users" ON abandoned_carts FOR UPDATE USING (true);
CREATE POLICY "Enable read for authenticated users" ON abandoned_carts FOR SELECT TO authenticated USING (true);
    `);
  } else {
    console.log('Table exists or other error:', error);
  }
}

run();
