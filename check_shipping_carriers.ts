import { supabase } from './src/lib/supabase';

async function checkShippingCarriers() {
  const { data, error } = await supabase.from('shipping_carriers').select('*');
  if (error) {
    console.error('Error fetching carriers:', error);
  } else {
    console.log('Shipping Carriers:', JSON.stringify(data, null, 2));
  }
}

checkShippingCarriers();
