import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'store_settings' });
  if (error) {
    console.error('Error fetching policies via RPC:', error);
    // Try querying information_schema if RPC fails
    const { data: schemaData, error: schemaError } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'store_settings');
    
    if (schemaError) {
      console.error('Error fetching policies via pg_policies:', schemaError);
    } else {
      console.log('Policies for store_settings:', schemaData);
    }
  } else {
    console.log('Policies for store_settings:', data);
  }
}

checkPolicies();
