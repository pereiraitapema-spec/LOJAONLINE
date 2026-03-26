import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkCarriers() {
  const { data: carriers, error: carriersError } = await supabase
    .from('shipping_carriers')
    .select('*');
  
  console.log('Shipping Carriers:', JSON.stringify(carriers, null, 2));
}

checkCarriers();
