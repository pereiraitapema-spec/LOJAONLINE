import { supabase } from '../lib/supabase';
export type { ShippingPackage, ShippingQuote, ShippingProvider } from './providers/shipping/types';
import { ShippingPackage, ShippingQuote, ShippingProvider } from './providers/shipping/types';
import { logApiCall } from '../lib/monitoring';

const melhorenvioProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    if (!config?.api_key) {
      console.warn('⚠️ Melhor Envio API Key missing in carrier config!');
      return [];
    }
    
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

const mockProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    console.log('🛠️ Usando Mock Shipping Provider para:', destZipCode);
    
    // Simulação realista baseada em regiões do Brasil (Primeiro dígito do CEP)
    const firstDigit = destZipCode.charAt(0);
    let basePrice = 22.50;
    let deadlineMin = 3;
    let deadlineMax = 6;

    switch(firstDigit) {
      case '0': case '1': case '2': case '3': // Sudeste
        basePrice = 19.90; deadlineMin = 2; deadlineMax = 4; break;
      case '4': case '5': // Nordeste (Leste)
        basePrice = 29.50; deadlineMin = 5; deadlineMax = 8; break;
      case '6': // Norte/Nordeste (Oeste)
        basePrice = 38.20; deadlineMin = 7; deadlineMax = 12; break;
      case '7': // Centro-Oeste
        basePrice = 26.90; deadlineMin = 4; deadlineMax = 7; break;
      case '8': case '9': // Sul
        basePrice = 24.40; deadlineMin = 3; deadlineMax = 6; break;
    }

    return [
      {
        id: 'mock-express',
        name: 'Entrega Expressa',
        price: basePrice + 12,
        deadline: `${deadlineMin} a ${deadlineMax} dias úteis`,
        provider: 'mock',
        carrierName: config.carrier_name || 'Transportadora'
      },
      {
        id: 'mock-standard',
        name: 'Entrega Padrão',
        price: basePrice,
        deadline: `${deadlineMin + 3} a ${deadlineMax + 5} dias úteis`,
        provider: 'mock',
        carrierName: config.carrier_name || 'Transportadora'
      }
    ];
  },
  async generateLabel(orderId: string, config: any) {
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase() };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  }
};

const correiosProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    console.log('📦 Usando Provedor Correios para:', destZipCode);
    
    // Se o usuário tiver configuração de Melhor Envio no Correios, podemos usar o provedor do Melhor Envio
    if (config?.api_key && config.api_key.length > 20) {
       console.log('🔄 Redirecionando Correios para Melhor Envio (API Key detectada)');
       return melhorenvioProvider.calculateShipping(destZipCode, packages, config);
    }

    // Simulação realista baseada em regiões do Brasil
    const firstDigit = destZipCode.charAt(0);
    let basePrice = 20;
    let deadlineMin = 3;
    let deadlineMax = 5;

    switch(firstDigit) {
      case '0': case '1': case '2': case '3': // Sudeste
        basePrice = 18.90; deadlineMin = 2; deadlineMax = 4; break;
      case '4': case '5': // Nordeste (Leste)
        basePrice = 28.50; deadlineMin = 5; deadlineMax = 8; break;
      case '6': // Norte/Nordeste (Oeste)
        basePrice = 35.20; deadlineMin = 7; deadlineMax = 12; break;
      case '7': // Centro-Oeste
        basePrice = 24.90; deadlineMin = 4; deadlineMax = 7; break;
      case '8': case '9': // Sul
        basePrice = 22.40; deadlineMin = 3; deadlineMax = 6; break;
    }

    return [
      {
        id: 'correios-sedex',
        name: 'SEDEX',
        price: basePrice + 15.40,
        deadline: `${deadlineMin} a ${deadlineMax} dias úteis`,
        provider: 'correios',
        carrierName: config.carrier_name || 'Correios'
      },
      {
        id: 'correios-pac',
        name: 'PAC',
        price: basePrice,
        deadline: `${deadlineMin + 4} a ${deadlineMax + 7} dias úteis`,
        provider: 'correios',
        carrierName: config.carrier_name || 'Correios'
      }
    ];
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
  'melhorenvio2': melhorenvioProvider,
  'correios': correiosProvider,
  'mock': mockProvider
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

      const provider = providers[carrier.provider] || providers['mock'];
      if (!provider) {
        console.error(`Provider ${carrier.provider} not found for carrier ${carrier.name}`);
        return [];
      }

      console.log(`Calculating shipping with ${carrier.name} (${carrier.provider}) from ${settings.origin_zip_code} to ${destZipCode}`);
      
      const quotes = await provider.calculateShipping(destZipCode, packages, {
        ...carrier.config,
        carrier_name: carrier.name,
        origin_zip: settings.origin_zip_code.replace(/\D/g, '')
      });

      console.log(`Quotes received for ${carrier.name}:`, quotes);
      return quotes;
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
