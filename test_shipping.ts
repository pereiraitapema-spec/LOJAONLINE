import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Mock fetch for shippingService
global.fetch = fetch as any;

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Import shippingService logic (simplified)
const cepcertoProvider = {
  async calculateShipping(destZipCode: string, packages: any[], config: any) {
    console.log('📦 Usando Provedor CepCerto para:', destZipCode);
    if (!config?.api_key) {
      console.warn('⚠️ CepCerto API Key missing!');
      throw new Error('Token de Consulta do CepCerto não configurado.');
    }
    
    const startTime = Date.now();
    try {
      const totalWeightInGrams = Math.max(300, Math.ceil(packages.reduce((acc, p) => acc + p.weight, 0) * 1000));
      const maxDim = packages.reduce((acc, p) => ({
        h: Math.max(acc.h, p.height, 2),
        w: Math.max(acc.w, p.width, 11),
        l: Math.max(acc.l, p.length, 16)
      }), { h: 2, w: 11, l: 16 });

      const baseUrl = `https://www.cepcerto.com/ws/json-frete/${config.origin_zip.replace(/\D/g, '')}/${destZipCode.replace(/\D/g, '')}/${totalWeightInGrams}/${maxDim.h}/${maxDim.w}/${maxDim.l}/${config.api_key}`;
      
      console.log('🔗 URL CepCerto:', baseUrl);
      const response = await fetch(baseUrl);
      
      if (response.ok) {
        const text = await response.text();
        console.log('📦 Resposta CepCerto (Raw):', text);
        const data = JSON.parse(text);
        console.log('📦 Resposta CepCerto (JSON):', data);
        return data;
      } else {
        console.error('❌ Erro na resposta do CepCerto:', response.status, response.statusText);
        return null;
      }
    } catch (err) {
      console.error('CepCerto API Error:', err);
      return null;
    }
  }
};

async function testShipping() {
  const { data: carrier } = await supabase.from('shipping_carriers').select('*').eq('provider', 'cepcerto').single();
  const { data: settings } = await supabase.from('store_settings').select('origin_zip_code').maybeSingle();

  if (!carrier || !settings?.origin_zip_code) {
    console.error('Carrier or settings missing');
    return;
  }

  const destZipCode = '88240000';
  const packages = [{ weight: 0.5, height: 10, width: 10, length: 10 }];

  const result = await cepcertoProvider.calculateShipping(destZipCode, packages, {
    ...carrier.config,
    origin_zip: settings.origin_zip_code
  });

  console.log('Final Result:', result);
}

testShipping();
