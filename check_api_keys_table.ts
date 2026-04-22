import { supabase } from './src/lib/supabase';

async function checkApiKeysTable() {
  const { data, error } = await supabase.from('api_keys').select('*');
  if (error) {
    console.error('Error fetching API keys:', error);
  } else {
    console.log('API Keys Table:', JSON.stringify(data, null, 2));
  }
}

checkApiKeysTable();
