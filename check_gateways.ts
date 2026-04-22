import { supabase } from './src/lib/supabase';

async function checkGateways() {
  const { data, error } = await supabase.from('payment_gateways').select('*');
  if (error) {
    console.error('Error fetching gateways:', error);
  } else {
    console.log('Payment Gateways:', JSON.stringify(data, null, 2));
  }
}

checkGateways();
