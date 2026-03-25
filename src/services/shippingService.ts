import { supabase } from '../lib/supabase';
export type { ShippingPackage, ShippingQuote, ShippingProvider } from './providers/shipping/types';
import { ShippingPackage, ShippingQuote, ShippingProvider } from './providers/shipping/types';
import { logApiCall } from '../lib/monitoring';

const melhorenvioProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    if (!config?.api_key) return [];
    
    const startTime = Date.now();
    try {
      const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/calculate', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.api_key}`,
          'User-Agent': 'Magnifique4Life (contato@magnifique4life.com.br)'
        },
        body: JSON.stringify({
          from: { postal_code: config.origin_zip },
          to: { postal_code: destZipCode.replace(/\D/g, '') },
          products: packages.map((p, i) => ({
            id: `p${i}`,
            width: p.width,
            height: p.height,
            length: p.length,
            weight: p.weight,
            insurance_value: 100,
            quantity: 1
          }))
        })
      });

      const duration = Date.now() - startTime;
      if (response.ok) {
        const data = await response.json();
        await logApiCall('melhorenvio', '/shipment/calculate', duration, true);
        return data
          .filter((quote: any) => !quote.error)
          .map((quote: any) => ({
            id: quote.id.toString(),
            name: quote.name,
            price: parseFloat(quote.price),
            deadline: `${quote.delivery_range.min} a ${quote.delivery_range.max} dias úteis`,
            provider: 'melhorenvio',
            carrierName: config.carrier_name || 'Melhor Envio'
          }));
      }
      await logApiCall('melhorenvio', '/shipment/calculate', duration, false, `Status: ${response.status}`);
      return [];
    } catch (err: any) {
      await logApiCall('melhorenvio', '/shipment/calculate', Date.now() - startTime, false, err.message);
      console.error('Melhor Envio API Error:', err);
      return [];
    }
  },
  async generateLabel(orderId: string, config: any) {
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase() };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  }
};

const providers: Record<string, ShippingProvider> = {
  'melhorenvio': melhorenvioProvider,
  'melhorenvio2': melhorenvioProvider
};

export const shippingService = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], carrierId?: string): Promise<ShippingQuote[]> {
    try {
      let query = supabase.from('shipping_carriers').select('*').eq('active', true);
      if (carrierId) {
        query = query.eq('id', carrierId);
      } else {
        query = query.limit(1);
      }
      const { data: carrier } = await query.maybeSingle();

      const { data: settings } = await supabase
        .from('store_settings')
        .select('origin_zip_code')
        .limit(1)
        .maybeSingle();

      if (!carrier || !settings?.origin_zip_code) {
        console.warn('Shipping carrier or origin ZIP code not configured.');
        return [];
      }

      const provider = providers[carrier.provider];
      if (!provider) return [];

      return provider.calculateShipping(destZipCode, packages, {
        ...carrier.config,
        carrier_name: carrier.name,
        origin_zip: settings.origin_zip_code.replace(/\D/g, '')
      });
    } catch (error) {
      console.error('Error calculating shipping:', error);
      return [];
    }
  },

  async generateLabel(orderId: string) {
    const { data: order } = await supabase.from('orders').select('carrier_id').eq('id', orderId).single();
    if (!order) return { success: false, error: 'Order not found' };
    
    const { data: carrier } = await supabase.from('shipping_carriers').select('*').eq('id', order.carrier_id).single();
    if (!carrier) return { success: false, error: 'Carrier not found' };

    const provider = providers[carrier.provider];
    if (!provider) return { success: false, error: 'Provider not found' };

    return provider.generateLabel(orderId, carrier.config);
  },

  async cancelLabel(orderId: string) {
    const { data: order } = await supabase.from('orders').select('carrier_id').eq('id', orderId).single();
    if (!order) return { success: false, error: 'Order not found' };
    
    const { data: carrier } = await supabase.from('shipping_carriers').select('*').eq('id', order.carrier_id).single();
    if (!carrier) return { success: false, error: 'Carrier not found' };

    const provider = providers[carrier.provider];
    if (!provider) return { success: false, error: 'Provider not found' };

    return provider.cancelLabel(orderId, carrier.config);
  }
};
