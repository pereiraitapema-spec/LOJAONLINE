import { supabase } from './src/lib/supabase';

async function checkDb() {
  const { data: settings, error: settingsError } = await supabase
    .from('store_settings')
    .select('*')
    .maybeSingle();
  
  console.log('Store Settings:', settings);
  if (settingsError) console.error('Settings Error:', settingsError);

  const { data: carriers, error: carriersError } = await supabase
    .from('shipping_carriers')
    .select('*');
  
  console.log('Shipping Carriers:', carriers);
  if (carriersError) console.error('Carriers Error:', carriersError);
}

checkDb();
