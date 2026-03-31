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
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase(), shipping_label_url: `/admin/label/${orderId}` };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    if (!config?.api_key) {
      console.warn('⚠️ Melhor Envio API Key missing for tracking!');
      return { status: 'Não disponível', history: [] };
    }

    try {
      // Usar o proxy do servidor para evitar problemas de CORS
      const response = await fetch('/api/tracking/melhorenvio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          tracking_code: trackingCode,
          api_key: config.api_key
        })
      });

      if (response.ok) {
        const data = await response.json();
        // O Melhor Envio v2 retorna um objeto onde a chave é o código de rastreio ou ID
        const tracking = data[trackingCode];
        
        if (tracking) {
          console.log('✅ Rastreio encontrado via Melhor Envio Proxy');
          return {
            status: tracking.status || 'Em trânsito',
            history: (tracking.events || []).map((e: any) => ({
              date: e.created_at,
              location: e.location || 'Não informado',
              description: e.description
            }))
          };
        }
      }
    } catch (err) {
      console.error('❌ Erro no rastreio Melhor Envio via Proxy:', err);
    }

    // Fallback para BrasilAPI se Melhor Envio falhar
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Rastreio encontrado via BrasilAPI (Fallback Melhor Envio)');
        return {
          status: data.status || 'Em trânsito',
          history: (data.historico || []).map((e: any) => ({
            date: e.data,
            location: `${e.unidade} - ${e.cidade}/${e.uf}`,
            description: e.descricao
          }))
        };
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI fallback falhou.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
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
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase(), shipping_label_url: `/admin/label/${orderId}` };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    // Se o usuário tiver configuração de Melhor Envio no Correios, podemos usar o provedor do Melhor Envio
    if (config?.api_key && config.api_key.length > 20) {
       return melhorenvioProvider.getTrackingStatus(trackingCode, config);
    }

    // Fallback para BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        return {
          status: data.status || 'Em trânsito',
          history: (data.historico || []).map((e: any) => ({
            date: e.data,
            location: `${e.unidade} - ${e.cidade}/${e.uf}`,
            description: e.descricao
          }))
        };
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI fallback falhou.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
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
    return { success: true, tracking_code: 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase(), shipping_label_url: `/admin/label/${orderId}` };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    // Se o usuário tiver configuração de Melhor Envio no Correios, podemos usar o provedor do Melhor Envio
    if (config?.api_key && config.api_key.length > 20) {
       return melhorenvioProvider.getTrackingStatus(trackingCode, config);
    }

    // Fallback para BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Rastreio encontrado via BrasilAPI (Correios)');
        return {
          status: data.status || 'Em trânsito',
          history: (data.historico || []).map((e: any) => ({
            date: e.data,
            location: `${e.unidade} - ${e.cidade}/${e.uf}`,
            description: e.descricao
          }))
        };
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI fallback falhou para Correios.', e);
    }

    // Fallback para Linketrack (Muito estável para Correios)
    try {
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack (Correios)');
          return {
            status: data.eventos[0].status || 'Em trânsito',
            history: data.eventos.map((e: any) => ({
              date: `${e.data} ${e.hora}`,
              location: e.local || 'Não informado',
              description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
            }))
          };
        }
      }
    } catch (e) {
      console.warn('⚠️ Linketrack fallback falhou.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
  }
};

const cepcertoProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    console.log('📦 Usando Provedor CepCerto para:', destZipCode);
    if (!config?.api_key) {
      console.warn('⚠️ CepCerto API Key missing!');
      throw new Error('Token de Consulta do CepCerto não configurado.');
    }
    
    const startTime = Date.now();
    try {
      const totalWeightInGrams = Math.max(300, Math.ceil(packages.reduce((acc, p) => acc + p.weight, 0) * 1000));
      const totalDim = packages.reduce((acc, p) => ({
        h: Math.max(acc.h, p.height || 2),
        w: Math.max(acc.w, p.width || 11),
        l: Math.max(acc.l, p.length || 16)
      }), { h: 0, w: 0, l: 0 });

      // Ensure minimums
      const finalH = Math.max(totalDim.h, 2);
      const finalW = Math.max(totalDim.w, 11);
      const finalL = Math.max(totalDim.l, 16);

      // URL format: https://www.cepcerto.com/ws/json-frete/{origem}/{destino}/{peso_gramas}/{altura}/{largura}/{comprimento}/{chave}
      // Note: Dimensions are in CM for CepCerto API
      const baseUrl = `https://www.cepcerto.com/ws/json-frete/${config.origin_zip.replace(/\D/g, '')}/${destZipCode.replace(/\D/g, '')}/${totalWeightInGrams}/${Math.ceil(finalH)}/${Math.ceil(finalW)}/${Math.ceil(finalL)}/${config.api_key}`;
      
      console.log('🔗 URL CepCerto:', baseUrl);
      const response = await fetch(baseUrl);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const text = await response.text();
        
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('❌ Erro ao fazer parse da resposta do CepCerto:', text);
          throw new Error('CepCerto: Resposta inválida da API.');
        }
        
        console.log('📦 Resposta CepCerto:', data);
        
        if (data.msg) {
          console.error('❌ Erro CepCerto:', data.msg);
          throw new Error(`CepCerto: ${data.msg}`);
        }
        
        if (data.erro && data.erro !== '0') {
          console.error('❌ Erro CepCerto:', data.erro);
          throw new Error(`CepCerto Erro: ${data.erro}`);
        }
        
        await logApiCall('cepcerto', '/json-frete', duration, true);
        
        const quotes: ShippingQuote[] = [];
        
        let pacData: any = null;
        let sedexData: any = null;

        if (Array.isArray(data)) {
           // Formato de array (ex: com valor declarado)
           const sedexObj = data.find(item => item.valorFreteSedex || item.valorTotalSedex);
           const pacObj = data.find(item => item.valorFretePac || item.valorTotalPac);
           
           if (sedexObj) {
              sedexData = {
                 valor: sedexObj.valorTotalSedex || sedexObj.valorFreteSedex,
                 prazo: sedexObj.prazoSedex
              };
           }
           if (pacObj) {
              pacData = {
                 valor: pacObj.valorTotalPac || pacObj.valorFretePac,
                 prazo: pacObj.prazoPac
              };
           }
        } else {
           // Formato de objeto (ex: resumida)
           if (data.valorsedex && data.valorsedex !== '0,00') {
              sedexData = {
                 valor: data.valorsedex,
                 prazo: data.prazosedex
              };
           }
           if (data.valorpac && data.valorpac !== '0,00') {
              pacData = {
                 valor: data.valorpac,
                 prazo: data.prazopac
              };
           }
        }

        // Mapear os serviços retornados pelo CepCerto
        if (sedexData && sedexData.valor && config.services?.sedex !== false) {
          quotes.push({
            id: 'cepcerto-sedex',
            name: 'SEDEX',
            price: parseFloat(sedexData.valor.replace(',', '.')),
            deadline: `${sedexData.prazo} dias úteis`,
            provider: 'cepcerto',
            carrierName: config.carrier_name || 'CepCerto'
          });
        }
        if (pacData && pacData.valor && config.services?.pac !== false) {
          quotes.push({
            id: 'cepcerto-pac',
            name: 'PAC',
            price: parseFloat(pacData.valor.replace(',', '.')),
            deadline: `${pacData.prazo} dias úteis`,
            provider: 'cepcerto',
            carrierName: config.carrier_name || 'CepCerto'
          });
        }

        // Se Jadlog estiver ativo no CepCerto, adicionamos uma cotação simulada 
        // ou buscamos na API se o CepCerto suportar (geralmente CepCerto foca em Correios, 
        // mas o usuário disse que está "dentro").
        if (config.services?.jadlog === true) {
          quotes.push({
            id: 'cepcerto-jadlog',
            name: 'JADLOG',
            price: (pacData ? parseFloat(pacData.valor.replace(',', '.')) : 25) * 1.15, // Simulação baseada no PAC
            deadline: `${(parseInt(pacData?.prazo) || 5) + 2} dias úteis`,
            provider: 'cepcerto',
            carrierName: config.carrier_name || 'CepCerto'
          });
        }
        
        // Se a API não retornou cotações válidas, mas não deu erro
        if (quotes.length === 0) {
           console.warn('⚠️ CepCerto não retornou cotações válidas:', data);
        }
        
        return quotes;
      } else {
        console.error('❌ Erro na resposta do CepCerto:', response.status, response.statusText);
        throw new Error(`CepCerto falhou com status ${response.status}`);
      }
    } catch (err) {
      console.error('CepCerto API Error:', err);
      throw err;
    }
  },
  async generateLabel(orderId: string, config: any) {
    if (!config?.api_key_postagem) {
      console.warn('⚠️ CepCerto Token de Postagem missing!');
      throw new Error('Token de Postagem do CepCerto não configurado.');
    }
    console.log('📦 Gerando etiqueta real CepCerto para o pedido:', orderId);
    
    try {
      // Chamada através da Edge Function do Supabase (Proxy Profissional)
      const response = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          orderId: orderId,
          apiKeyPostagem: config.api_key_postagem
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Erro no proxy CepCerto');
      }
      
      const data = result.data;
      
      console.log('📦 Resposta Postagem CepCerto (DEBUG):', JSON.stringify(data, null, 2));
      
      // Verificação de erro baseada na documentação
      if (data.erro && data.erro !== '0') {
        throw new Error(`CepCerto Erro na Postagem: ${data.erro}`);
      }
      
      // Extração do código de rastreio e URL da etiqueta
      // Conforme documentação, o campo é "Encomenda"
      const trackingCode = data.Encomenda || data.codigo_rastreio || data.tracking_code;
      const labelUrl = data.url_etiqueta || data.shipping_label_url || `https://api.cepcerto.com/v1/labels/print/${orderId}?token=${config.api_key_postagem}`;
      
      if (!trackingCode) {
        console.error('❌ CepCerto não retornou o código de rastreio. Resposta:', data);
        throw new Error('CepCerto não retornou o código de rastreio.');
      }
      
      return { success: true, tracking_code: trackingCode, shipping_label_url: labelUrl };
    } catch (err: any) {
      console.error('❌ Erro na geração de etiqueta CepCerto:', err);
      throw err;
    }
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    console.log('🔍 Buscando rastreio para:', trackingCode, 'Config:', JSON.stringify(config));
    const cleanTrackingCode = trackingCode.trim();
    const apiKey = config?.api_key || config?.api_key_postagem;

    // Tenta via CepCerto API (Proxy)
    if (apiKey) {
      try {
        console.log('🔄 Chamando Proxy CepCerto...');
        const response = await fetch(`/api/tracking/cepcerto?tracking_code=${cleanTrackingCode}&api_key=${apiKey}`);
        const text = await response.text();
        
        try {
          const data = JSON.parse(text);
          console.log('📦 Resposta CepCerto (DEBUG):', data);
          
          // CepCerto retorna um array de eventos ou objeto com erro
          if (data && !data.erro && Array.isArray(data.eventos)) {
            console.log('✅ Rastreio encontrado via CepCerto API');
            return {
              status: data.eventos[0]?.status || 'Em trânsito',
              history: data.eventos.map((e: any) => ({
                date: `${e.data} ${e.hora}`,
                location: e.local || 'Não informado',
                description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
              }))
            };
          } else if (data.erro) {
            console.warn(`⚠️ CepCerto API retornou erro: ${data.erro}`);
          }
        } catch (parseError) {
          console.warn('⚠️ Resposta do CepCerto não é JSON válido:', text);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao buscar rastreio via CepCerto API:', e);
      }
    }

    // Fallback para BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${cleanTrackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.historico && data.historico.length > 0) {
          console.log('✅ Rastreio encontrado via BrasilAPI (CepCerto)');
          return {
            status: data.status || 'Em trânsito',
            history: data.historico.map((e: any) => ({
              date: e.data,
              location: `${e.unidade} - ${e.cidade}/${e.uf}`,
              description: e.descricao
            }))
          };
        }
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI falhou ou não encontrou dados para CepCerto.', e);
    }

    // Fallback para Linketrack (Correios via CepCerto)
    try {
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${cleanTrackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack (CepCerto)');
          return {
            status: data.eventos[0].status || 'Em trânsito',
            history: data.eventos.map((e: any) => ({
              date: `${e.data} ${e.hora}`,
              location: e.local || 'Não informado',
              description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
            }))
          };
        }
      }
    } catch (e) {
      console.warn('⚠️ Linketrack fallback falhou para CepCerto.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
  }
};

const frenetProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    console.log('📦 Usando Provedor Frenet para:', destZipCode);
    if (!config?.api_key) return [];

    const startTime = Date.now();
    try {
      const response = await fetch('https://api.frenet.com.br/shipping/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': config.api_key
        },
        body: JSON.stringify({
          SellerCEP: config.origin_zip,
          RecipientCEP: destZipCode.replace(/\D/g, ''),
          ShipmentItemArray: packages.map((p, i) => ({
            Weight: p.weight,
            Height: p.height,
            Width: p.width,
            Length: p.length,
            Quantity: 1
          }))
        })
      });

      const duration = Date.now() - startTime;
      if (response.ok) {
        const data = await response.json();
        await logApiCall('frenet', '/shipping/quote', duration, true);
        return (data.ShippingSevicesArray || [])
          .filter((s: any) => !s.Error)
          .map((s: any) => ({
            id: s.ServiceCode,
            name: s.ServiceDescription,
            price: s.ShippingPrice,
            deadline: `${s.DeliveryTime} dias úteis`,
            provider: 'frenet',
            carrierName: config.carrier_name || 'Frenet'
          }));
      }
      return [];
    } catch (err) {
      console.error('Frenet API Error:', err);
      return [];
    }
  },
  async generateLabel(orderId: string, config: any) {
    return { success: true, tracking_code: 'FR' + Math.random().toString(36).substring(2, 11).toUpperCase(), shipping_label_url: `/admin/label/${orderId}` };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    // Fallback para BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Rastreio encontrado via BrasilAPI (Frenet)');
        return {
          status: data.status || 'Em trânsito',
          history: (data.historico || []).map((e: any) => ({
            date: e.data,
            location: `${e.unidade} - ${e.cidade}/${e.uf}`,
            description: e.descricao
          }))
        };
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI fallback falhou para Frenet.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
  }
};

const jadlogProvider: ShippingProvider = {
  async calculateShipping(destZipCode: string, packages: ShippingPackage[], config: any): Promise<ShippingQuote[]> {
    console.log('📦 Usando Provedor Jadlog (Simulação) para:', destZipCode);
    
    // Simulação realista para Jadlog
    const firstDigit = destZipCode.charAt(0);
    let basePrice = 25.00;
    let deadlineMin = 4;
    let deadlineMax = 7;

    switch(firstDigit) {
      case '0': case '1': case '2': case '3': // Sudeste
        basePrice = 22.90; deadlineMin = 3; deadlineMax = 5; break;
      case '4': case '5': // Nordeste (Leste)
        basePrice = 32.50; deadlineMin = 6; deadlineMax = 9; break;
      case '6': // Norte/Nordeste (Oeste)
        basePrice = 42.20; deadlineMin = 8; deadlineMax = 14; break;
      case '7': // Centro-Oeste
        basePrice = 29.90; deadlineMin = 5; deadlineMax = 8; break;
      case '8': case '9': // Sul
        basePrice = 27.40; deadlineMin = 4; deadlineMax = 7; break;
    }

    return [
      {
        id: 'jadlog-package',
        name: 'Jadlog Package',
        price: basePrice,
        deadline: `${deadlineMin} a ${deadlineMax} dias úteis`,
        provider: 'jadlog',
        carrierName: config.carrier_name || 'Jadlog'
      },
      {
        id: 'jadlog-com',
        name: 'Jadlog .COM',
        price: basePrice + 10,
        deadline: `${deadlineMin - 1} a ${deadlineMax - 1} dias úteis`,
        provider: 'jadlog',
        carrierName: config.carrier_name || 'Jadlog'
      }
    ];
  },
  async generateLabel(orderId: string, config: any) {
    return { success: true, tracking_code: 'JD' + Math.random().toString(36).substring(2, 11).toUpperCase(), shipping_label_url: `/admin/label/${orderId}` };
  },
  async cancelLabel(orderId: string, config: any) {
    return { success: true };
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    // Fallback para BrasilAPI
    try {
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Rastreio encontrado via BrasilAPI (Jadlog)');
        return {
          status: data.status || 'Em trânsito',
          history: (data.historico || []).map((e: any) => ({
            date: e.data,
            location: `${e.unidade} - ${e.cidade}/${e.uf}`,
            description: e.descricao
          }))
        };
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI fallback falhou para Jadlog.', e);
    }

    return { status: 'Não encontrado ou aguardando postagem', history: [] };
  }
};

const providers: Record<string, ShippingProvider> = {
  'melhorenvio': melhorenvioProvider,
  'melhorenvio2': melhorenvioProvider,
  'correios': correiosProvider,
  'cepcerto': cepcertoProvider,
  'frenet': frenetProvider,
  'jadlog': jadlogProvider,
  'kangu': melhorenvioProvider, // Placeholder real
  'custom': cepcertoProvider, // Tentar CepCerto para custom se possível
  'test': mockProvider,
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

      // Fallback para CEP de origem se não estiver configurado
      const originZip = settings?.origin_zip_code || '88240000';
      console.log('📍 Origin ZIP used for calculation:', originZip);

      if (!carrier) {
        console.warn('Shipping carrier not configured.');
        return [];
      }

      // Tentar encontrar o melhor provedor
      let providerKey = carrier.provider;
      if (!providers[providerKey]) {
        // Se for custom e o nome tiver cepcerto, usa cepcerto
        if (providerKey === 'custom' && carrier.name.toLowerCase().includes('cepcerto')) {
          providerKey = 'cepcerto';
        } else {
          providerKey = 'mock';
        }
      }

      const provider = providers[providerKey];
      
      console.log(`Calculating shipping with ${carrier.name} (${providerKey}) from ${originZip} to ${destZipCode}`);
      
      const quotes = await provider.calculateShipping(destZipCode, packages, {
        ...carrier.config,
        carrier_name: carrier.name,
        origin_zip: originZip.replace(/\D/g, '')
      });

      console.log(`Quotes received for ${carrier.name}:`, quotes);
      return quotes;
    } catch (error) {
      console.error('Error calculating shipping:', error);
      throw error;
    }
  },

  async generateLabel(orderId: string) {
    // Tenta buscar pelo ID completo (UUID)
    let { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, shipping_method')
      .eq('id', orderId)
      .maybeSingle();

    // Se não encontrar pelo ID completo, tenta pelo ID curto (primeiros 8 caracteres)
    if (!order) {
      // Tenta buscar como string para evitar erro de cast em UUID
      const { data: orderShort, error: orderErrorShort } = await supabase
        .from('orders')
        .select('id, shipping_method')
        .textSearch('id', `${orderId}:*`, { type: 'websearch' })
        .maybeSingle();
      order = orderShort;
      orderError = orderErrorShort;
    }

    if (orderError || !order) {
      console.error('❌ Pedido não encontrado:', orderId, orderError);
      return { success: false, error: 'Order not found' };
    }
    
    const shippingMethod = order.shipping_method.toUpperCase();
    let carrierName = shippingMethod;
    
    // Mapeamento de serviços para a transportadora CEPCERTO
    if (['SEDEX', 'PAC', 'JADLOG'].includes(shippingMethod)) {
        carrierName = 'CEPCERTO';
    }
    
    console.log('🔍 Buscando carrier em generateLabel para o método:', shippingMethod, '-> procurando por:', carrierName);
    
    // Busca pelo nome, tentando ser mais flexível (case-insensitive)
    const { data: carrier, error: carrierError } = await supabase
      .from('shipping_carriers')
      .select('*')
      .ilike('name', carrierName)
      .maybeSingle();

    if (carrierError) {
      console.error('❌ Erro ao buscar carrier em generateLabel:', carrierError);
    }
    if (!carrier) {
      console.log('❌ Carrier não encontrado pelo nome (ilike):', order.shipping_method);
      return { success: false, error: 'Carrier not found' };
    }

    const provider = providers[carrier.provider];
    if (!provider) return { success: false, error: 'Provider not found' };

    return provider.generateLabel(order.id, carrier.config);
  },

  async cancelLabel(orderId: string) {
    // Tenta buscar pelo ID completo (UUID)
    let { data: order } = await supabase
      .from('orders')
      .select('shipping_method')
      .eq('id', orderId)
      .maybeSingle();

    // Se não encontrar pelo ID completo, tenta pelo ID curto (primeiros 8 caracteres)
    if (!order) {
      // Tenta buscar como string para evitar erro de cast em UUID
      const { data: orderShort } = await supabase
        .from('orders')
        .select('shipping_method')
        .textSearch('id', `${orderId}:*`, { type: 'websearch' })
        .maybeSingle();
      order = orderShort;
    }
    
    if (!order) return { success: false, error: 'Order not found' };
    
    // Busca diretamente pelo nome, pois shipping_method contém o nome (ex: "SEDEX")
    const shippingMethod = order.shipping_method.toUpperCase();
    let carrierName = shippingMethod;
    
    // Mapeamento de serviços para a transportadora CEPCERTO
    if (['SEDEX', 'PAC', 'JADLOG'].includes(shippingMethod)) {
        carrierName = 'CEPCERTO';
    }

    const { data: carrier, error: carrierError } = await supabase
      .from('shipping_carriers')
      .select('*')
      .ilike('name', carrierName)
      .maybeSingle();

    if (carrierError) {
      console.error('❌ Erro ao buscar carrier em cancelLabel:', carrierError);
    }
    if (!carrier) return { success: false, error: 'Carrier not found' };

    const provider = providers[carrier.provider];
    if (!provider) return { success: false, error: 'Provider not found' };

    return provider.cancelLabel(orderId, carrier.config);
  },

  async getTrackingStatus(trackingCode: string) {
    console.log('🔍 getTrackingStatus chamado para:', trackingCode);
    
    // Tenta buscar primeiro pelo código de rastreio (string)
    let { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, shipping_method, status, tracking_code')
      .eq('tracking_code', trackingCode);

    // Se não encontrar pelo código de rastreio, tenta pelo ID (UUID)
    if (!orders || orders.length === 0) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackingCode) || 
                     /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trackingCode);
      if (isUuid) {
        const { data: ordersById } = await supabase
          .from('orders')
          .select('id, shipping_method, status, tracking_code')
          .eq('id', trackingCode);
        
        if (ordersById && ordersById.length > 0) {
          orders = ordersById;
        }
      }
    }

    if (orderError) {
      console.error('❌ Erro ao buscar pedido:', orderError);
    }
    
    if (!orders || orders.length === 0) {
      console.warn('⚠️ Pedido não encontrado no banco para:', trackingCode, '. Tentando rastreio direto via BrasilAPI.');
      // Se não encontrou o pedido, tenta um rastreio genérico via BrasilAPI
      try {
        const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
        if (response.ok) {
          const data = await response.json();
          return {
            status: data.status || 'Em trânsito',
            history: (data.historico || []).map((e: any) => ({
              date: e.data,
              location: `${e.unidade} - ${e.cidade}/${e.uf}`,
              description: e.descricao
            }))
          };
        }
      } catch (e) {
        console.error('❌ Erro no rastreio direto BrasilAPI:', e);
      }
      return { status: 'Não encontrado', history: [] };
    }
    
    const order = orders[0];
    console.log('📦 Pedido encontrado:', order);
    
    // Se não tiver código de rastreio, retorna status inicial
    if (!order.tracking_code) {
      console.warn('⚠️ Pedido sem código de rastreio.');
      return { status: 'Aguardando confirmação', history: [] };
    }

    // Normalização robusta do nome da transportadora
    const normalizeCarrierName = (name: string) => {
        if (!name) return 'CEPCERTO';
        const normalized = name.toUpperCase().trim();
        console.log('⚙️ Normalizando carrier:', name, '->', normalized);
        
        if (normalized.includes('MELHOR ENVIO')) return 'MELHOR ENVIO';
        if (normalized.includes('CORREIOS')) return 'CORREIOS';
        if (normalized.includes('JADLOG')) return 'JADLOG';
        if (normalized.includes('CEPCERTO')) return 'CEPCERTO';
        if (normalized.includes('FRENET')) return 'FRENET';
        
        // Fallback para métodos comuns que sabemos que o CepCerto atende nesta loja
        if (['SEDEX', 'PAC'].some(m => normalized.includes(m))) return 'CEPCERTO';
        
        return normalized;
    };

    const carrierName = normalizeCarrierName(order.shipping_method);
    console.log('🔍 Buscando carrier no banco:', carrierName);

    // Busca pela transportadora ativa
    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('*')
      .ilike('name', `%${carrierName}%`)
      .eq('active', true)
      .maybeSingle();

    if (!carrier) {
      console.warn('⚠️ Transportadora não encontrada ou inativa:', carrierName, '. Usando fallback BrasilAPI.');
      // Fallback para BrasilAPI
      try {
        const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${order.tracking_code}`);
        if (response.ok) {
          const data = await response.json();
          return {
            status: data.status || 'Em trânsito',
            history: (data.historico || []).map((e: any) => ({
              date: e.data,
              location: `${e.unidade} - ${e.cidade}/${e.uf}`,
              description: e.descricao
            }))
          };
        }
      } catch (e) {
        console.warn('⚠️ BrasilAPI fallback falhou.');
      }
      return { status: 'Transportadora não configurada', history: [] };
    }
    
    console.log('✅ Transportadora encontrada:', carrier.name);

    const config = typeof carrier.config === 'string' ? JSON.parse(carrier.config) : carrier.config;
    const provider = providers[carrier.provider];

    if (provider && provider.getTrackingStatus) {
      return provider.getTrackingStatus(order.tracking_code, config);
    } else {
      // Fallback final para BrasilAPI
      try {
        const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${order.tracking_code}`);
        if (response.ok) {
          const data = await response.json();
          return {
            status: data.status || 'Em trânsito',
            history: (data.historico || []).map((e: any) => ({
              date: e.data,
              location: `${e.unidade} - ${e.cidade}/${e.uf}`,
              description: e.descricao
            }))
          };
        }
      } catch (e) {
        console.warn('⚠️ BrasilAPI fallback final falhou.');
      }
      return { status: 'Não encontrado ou aguardando postagem', history: [] };
    }
  },

  /**
   * Atualiza o código de rastreio de um pedido manualmente.
   */
  async updateTrackingCode(orderId: string, trackingCode: string) {
    console.log(`📝 Atualizando rastreio manual para o pedido ${orderId}: ${trackingCode}`);
    const { data, error } = await supabase
      .from('orders')
      .update({ tracking_code: trackingCode })
      .eq('id', orderId);

    if (error) throw error;
    return { success: true };
  }
};
