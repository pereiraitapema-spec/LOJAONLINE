import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in process.env');
  // Log all env vars starting with VITE_ to debug
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('VITE_')) console.log(`${key}: ${process.env[key]?.substring(0, 10)}...`);
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Checking shipping_carriers table...');
  const { error: carrierError } = await supabase.from('shipping_carriers').select('id').limit(1);
  
  if (carrierError && carrierError.code === '42P01') {
    console.log('Table shipping_carriers does not exist. Creating it...');
    // We can't run DDL via the client easily unless we have a function or use a specific endpoint.
    // But I can provide the SQL.
  } else {
    console.log('Table shipping_carriers exists.');
    const { data: carriers } = await supabase.from('shipping_carriers').select('*').eq('active', true);
    if (!carriers || carriers.length === 0) {
      console.log('No active carriers found. Inserting a test carrier...');
      const { error: insertError } = await supabase.from('shipping_carriers').insert([
        {
          name: 'Melhor Envio (Simulação)',
          provider: 'melhorenvio',
          active: true,
          config: { api_key: 'test_key', label_generation: true, tracking_notifications: true }
        }
      ]);
      if (insertError) console.error('Error inserting carrier:', insertError);
      else console.log('Test carrier inserted.');
    } else {
      console.log('Active carriers found:', carriers.length);
    }
  }

  console.log('Checking store_settings origin_zip_code...');
  const { data: settings, error: settingsError } = await supabase.from('store_settings').select('origin_zip_code').limit(1).maybeSingle();
  if (settingsError) {
    console.error('Error fetching settings:', settingsError);
  } else if (!settings?.origin_zip_code) {
    console.log('Origin ZIP code not set. Setting default...');
    const { error: updateError } = await supabase.from('store_settings').update({ origin_zip_code: '88371-790' }).not('id', 'is', null);
    if (updateError) console.error('Error updating settings:', updateError);
    else console.log('Origin ZIP code updated.');
  } else {
    console.log('Origin ZIP code is set:', settings.origin_zip_code);
  }
}

run();
