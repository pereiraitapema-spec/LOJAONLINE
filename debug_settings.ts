import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSettings() {
  const { data, error } = await supabase.rpc('get_policies', { table_name: 'store_settings' });
  console.log('Policies:', data);
  if (error) console.error('Error fetching policies:', error);
  
  // Try a direct update with a specific ID
  const id = '6a02a85c-7abf-4398-b55d-3d69cca62cf3';
  console.log(`Trying to update row ${id}...`);
  const { data: updateData, error: updateError } = await supabase
    .from('store_settings')
    .update({ origin_zip_code: '88240000' })
    .eq('id', id)
    .select();
  
  console.log('Update Result:', updateData);
  if (updateError) console.error('Update Error:', updateError);
}

debugSettings();
