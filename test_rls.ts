import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkRls() {
  const { data, error } = await supabase.rpc('check_rls', { table_name: 'store_settings' });
  console.log('RLS Status:', data);
  if (error) console.error('Error:', error);
}

// Since I can't run rpc easily if it doesn't exist, I'll try to insert a row and see if it works.
async function testInsert() {
  const { data, error } = await supabase
    .from('store_settings')
    .insert([{ store_name: 'Test' }])
    .select();
  
  console.log('Insert Result:', data);
  if (error) console.error('Insert Error:', error);
}

testInsert();
