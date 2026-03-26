import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProducts() {
  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, weight, height, width, length')
    .limit(10);
  
  if (error) {
    console.error('Error fetching products:', error);
  } else {
    console.log('Products:', JSON.stringify(products, null, 2));
  }
}

checkProducts();
