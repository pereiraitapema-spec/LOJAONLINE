import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSettings() {
  const { data: settings, error: settingsError } = await supabase
    .from('store_settings')
    .select('*');
  
  console.log('Store Settings Rows:', settings);
  if (settingsError) console.error('Settings Error:', settingsError);
}

checkSettings();
