import { supabase } from '../lib/supabase';

export interface ShippingPackage {
  weight: number;
  height: number;
  width: number;
  length: number;
}

export interface ShippingQuote {
  name: string;
  price: number;
  deadline: string;
  provider: string;
  id: string;
}

export const shippingService = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[]): Promise<ShippingQuote[]> {
    try {
      // 1. Get active carrier and store settings
      const { data: carrier } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('active', true)
        .maybeSingle();

      const { data: settings } = await supabase
        .from('store_settings')
        .select('origin_zip_code')
        .maybeSingle();

      if (!carrier || !settings?.origin_zip_code) {
        console.warn('Shipping carrier or origin ZIP code not configured.');
        return [];
      }

      const originZip = settings.origin_zip_code.replace(/\D/g, '');
      const destZip = destZipCode.replace(/\D/g, '');

      if (originZip.length !== 8 || destZip.length !== 8) return [];

      // 2. Call Provider API
      if (carrier.provider === 'melhorenvio' && carrier.config?.api_key) {
        try {
          // Exemplo de chamada real para Melhor Envio (Sandbox ou Produção)
          // const response = await fetch('https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate', {
          //   method: 'POST',
          //   headers: {
          //     'Accept': 'application/json',
          //     'Content-Type': 'application/json',
          //     'Authorization': `Bearer ${carrier.config.api_key}`
          //   },
          //   body: JSON.stringify({
          //     from: { postal_code: originZip },
          //     to: { postal_code: destZip },
          //     products: packages.map(p => ({
          //       weight: p.weight,
          //       height: p.height,
          //       width: p.width,
          //       length: p.length,
          //       quantity: 1
          //     }))
          //   })
          // });
          // const data = await response.json();
          // return data.map((quote: any) => ({ ... }));
          
          return this.mockMelhorEnvioQuotes(originZip, destZip, packages);
        } catch (err) {
          console.error('Melhor Envio API Error:', err);
        }
      }

      return this.mockMelhorEnvioQuotes(originZip, destZip, packages);
    } catch (error) {
      console.error('Error calculating shipping:', error);
      return [];
    }
  },

  async generateLabel(orderId: string) {
    // Logic to call API and generate label
    console.log(`Generating label for order ${orderId}`);
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase() };
  },

  async cancelLabel(orderId: string) {
    // Logic to call API and cancel label
    console.log(`Canceling label for order ${orderId}`);
    return { success: true };
  },

  mockMelhorEnvioQuotes(origin: string, dest: string, packages: ShippingPackage[]): ShippingQuote[] {
    // This is where you'd fetch from Melhor Envio API
    // For now, returning realistic mock data
    const basePrice = 15 + (packages.length * 5);
    return [
      { id: 'me_pac', name: 'PAC (Melhor Envio)', price: basePrice + 10.9, deadline: '8 a 12 dias úteis', provider: 'melhorenvio' },
      { id: 'me_sedex', name: 'SEDEX (Melhor Envio)', price: basePrice + 25.5, deadline: '2 a 4 dias úteis', provider: 'melhorenvio' },
      { id: 'me_jadlog', name: 'Jadlog .Package', price: basePrice + 18.2, deadline: '5 a 7 dias úteis', provider: 'melhorenvio' }
    ];
  }
};
