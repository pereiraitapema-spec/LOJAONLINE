
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

async function checkDB() {
  console.log('Checking Products...');
  const { data: products, error: pError } = await supabase.from('products').select('id, name, active');
  if (pError) console.error('Products Error:', pError);
  else console.log('Products Count:', products?.length, 'Active:', products?.filter(p => p.active).length);

  console.log('Checking Profiles...');
  const { data: profiles, error: prError } = await supabase.from('profiles').select('id, email, role').limit(5);
  if (prError) console.error('Profiles Error:', prError);
  else console.log('Profiles Sample:', profiles);

  console.log('Checking Banners...');
  const { data: banners, error: bError } = await supabase.from('banners').select('id, active');
  if (bError) console.error('Banners Error:', bError);
  else console.log('Banners Count:', banners?.length, 'Active:', banners?.filter(b => b.active).length);
}

checkDB();
