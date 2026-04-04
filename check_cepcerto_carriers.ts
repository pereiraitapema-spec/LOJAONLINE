
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCarriers() {
  const { data, error } = await supabase
    .from('shipping_carriers')
    .select('*')
    .eq('provider', 'cepcerto');

  if (error) {
    console.error('Error fetching carriers:', error);
    return;
  }

  console.log('CepCerto Carriers:', JSON.stringify(data, null, 2));
}

checkCarriers();
