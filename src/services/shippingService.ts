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

    // Fallback para Linketrack se tudo mais falhar
    try {
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack (Fallback Melhor Envio)');
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
    } catch (e) {}

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

    // Fallback para BrasilAPI (via Proxy se possível ou direto)
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

    // Fallback para Linketrack (Proxy do Servidor ou Direto via AllOrigins)
    try {
      console.log('🔄 Tentando Linketrack Proxy (Correios)...');
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack Proxy (Correios)');
          return {
            status: data.eventos[0].status || 'Em trânsito',
            history: data.eventos.map((e: any) => ({
              date: `${e.data} ${e.hora}`,
              location: e.local || 'Não informado',
              description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
            }))
          };
        }
      } else {
        console.warn(`⚠️ Linketrack Proxy falhou (${response.status}). Tentando fallback direto via AllOrigins...`);
        try {
          const targetUrl = encodeURIComponent(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${trackingCode}`);
          const directRes = await fetch(`https://api.allorigins.win/get?url=${targetUrl}`);
          const directData = await directRes.json();
          const linkeData = JSON.parse(directData.contents);
          
          if (linkeData && linkeData.eventos && linkeData.eventos.length > 0) {
            console.log('✅ Rastreio encontrado via Linketrack (AllOrigins Fallback - Correios)');
            return {
              status: linkeData.eventos[0].status || 'Em trânsito',
              history: linkeData.eventos.map((e: any) => ({
                date: `${e.data} ${e.hora}`,
                location: e.local || 'Não informado',
                description: linkeData.eventos[0].status + (linkeData.eventos[0].subStatus ? ` - ${linkeData.eventos[0].subStatus[0]}` : '')
              }))
            };
          }
        } catch (directErr) {
          console.warn('⚠️ Fallback direto Linketrack falhou para Correios:', directErr);
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
    const token = config.api_key_postagem || config.api_key;
    if (!token) {
      throw new Error('Token CepCerto não configurado.');
    }
    
    const startTime = Date.now();
    try {
      const totalWeight = packages.reduce((acc, p) => acc + p.weight, 0);
      const totalDim = packages.reduce((acc, p) => ({
        h: Math.max(acc.h, p.height || 2),
        w: Math.max(acc.w, p.width || 11),
        l: Math.max(acc.l, p.length || 16)
      }), { h: 0, w: 0, l: 0 });

      const finalH = Math.max(totalDim.h, 2);
      const finalW = Math.max(totalDim.w, 11);
      const finalL = Math.max(totalDim.l, 16);
      
      // Valor da encomenda (padrão 50.00 se não informado)
      const totalValue = packages.reduce((acc, p) => acc + (p.price || 0), 0) || 50;

      // Tentar a nova API via POST primeiro
      try {
        const payload = {
          token_cliente_postagem: token,
          cep_remetente: config.origin_zip.replace(/\D/g, ''),
          cep_destinatario: destZipCode.replace(/\D/g, ''),
          peso: totalWeight.toFixed(2),
          altura: finalH.toFixed(2),
          largura: finalW.toFixed(2),
          comprimento: finalL.toFixed(2),
          valor_encomenda: totalValue.toFixed(2)
        };

        const response = await fetch('https://cepcerto.com/api-cotacao-frete/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const data = await response.json();
          if (data.dados_frete) {
            const quotes: ShippingQuote[] = [];
            const frete = data.dados_frete;

            if (frete.valor_sedex && config.services?.sedex !== false) {
              quotes.push({
                id: 'cepcerto-sedex',
                name: 'SEDEX',
                price: parseFloat(frete.valor_sedex.replace('R$', '').replace('.', '').replace(',', '.').trim()),
                deadline: frete.prazo_entrega_sedex || 'Prazo não informado',
                provider: 'cepcerto',
                carrierName: config.carrier_name || 'CepCerto'
              });
            }

            if (frete.valor_pac && config.services?.pac !== false) {
              quotes.push({
                id: 'cepcerto-pac',
                name: 'PAC',
                price: parseFloat(frete.valor_pac.replace('R$', '').replace('.', '').replace(',', '.').trim()),
                deadline: frete.prazo_entrega_pac || 'Prazo não informado',
                provider: 'cepcerto',
                carrierName: config.carrier_name || 'CepCerto'
              });
            }

            await logApiCall('cepcerto', '/api-cotacao-frete', Date.now() - startTime, true);
            return quotes;
          }
        }
      } catch (e) {
        console.warn('Nova API de cotação falhou ou bloqueada por CORS, tentando fallback...', e);
      }

      // Fallback para a API antiga via GET
      const totalWeightInGrams = Math.max(300, Math.ceil(totalWeight * 1000));
      const baseUrl = `https://www.cepcerto.com/ws/json-frete-desconto/${config.origin_zip.replace(/\D/g, '')}/${destZipCode.replace(/\D/g, '')}/${totalWeightInGrams}/${Math.ceil(finalH)}/${Math.ceil(finalW)}/${Math.ceil(finalL)}/${config.api_key}`;
      
      const response = await fetch(baseUrl);
      const duration = Date.now() - startTime;
      
      if (response.ok) {
        const text = await response.text();
        const data = JSON.parse(text);
        
        if (data.msg && !data.dados_frete) throw new Error(`CepCerto: ${data.msg}`);
        
        await logApiCall('cepcerto', '/json-frete-desconto', duration, true);
        
        const quotes: ShippingQuote[] = [];
        const frete = data.dados_frete || data;

        if ((frete.valor_sedex || frete.valorsedex) && config.services?.sedex !== false) {
          const val = frete.valor_sedex || frete.valorsedex;
          quotes.push({
            id: 'cepcerto-sedex',
            name: 'SEDEX',
            price: parseFloat(val.toString().replace('R$', '').replace(' ', '').replace(',', '.')),
            deadline: frete.prazo_entrega_sedex || frete.prazosedex || 'Prazo não informado',
            provider: 'cepcerto',
            carrierName: config.carrier_name || 'CepCerto'
          });
        }
        if ((frete.valor_pac || frete.valorpac) && config.services?.pac !== false) {
          const val = frete.valor_pac || frete.valorpac;
          quotes.push({
            id: 'cepcerto-pac',
            name: 'PAC',
            price: parseFloat(val.toString().replace('R$', '').replace(' ', '').replace(',', '.')),
            deadline: frete.prazo_entrega_pac || frete.prazopac || 'Prazo não informado',
            provider: 'cepcerto',
            carrierName: config.carrier_name || 'CepCerto'
          });
        }
        
        return quotes;
      }
      throw new Error('Erro ao calcular frete no CepCerto');
    } catch (err) {
      console.error('CepCerto API Error:', err);
      throw err;
    }
  },

  async getBalance(config: any) {
    if (!config?.api_key_postagem && !config?.api_key) throw new Error('Token CepCerto não configurado.');
    const key = config.api_key_postagem || config.api_key;
    
    // Tentar via proxy para evitar CORS
    const tryFetch = async (url: string, options?: any) => {
      try {
        // Tenta primeiro via corsproxy.io (geralmente mais estável)
        const corsProxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const res1 = await fetch(corsProxyUrl).catch(() => null);
        if (res1 && res1.ok) {
          const text = await res1.text();
          try {
            return JSON.parse(text);
          } catch {
            // Se for o AllOrigins formatado
            const data = JSON.parse(text);
            return JSON.parse(data.contents);
          }
        }

        // Tenta usar o proxy do AllOrigins como segunda opção
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}&timestamp=${Date.now()}`;
        
        if (options?.method === 'POST') {
          const getUrl = `https://www.cepcerto.com/ws/json-saldo/${key}`;
          const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(getUrl)}&timestamp=${Date.now()}`);
          if (res.ok) {
            const data = await res.json();
            return JSON.parse(data.contents);
          }
        } else {
          const res = await fetch(proxyUrl);
          if (res.ok) {
            const data = await res.json();
            return JSON.parse(data.contents);
          }
        }
      } catch (e) {
        console.warn(`Proxy falhou para ${url}:`, e);
        return null;
      }
      return null;
    };

    try {
      // Tentar primeiro a API antiga via proxy (mais estável para GET)
      const data = await tryFetch(`https://www.cepcerto.com/ws/json-saldo/${key}`);
      if (data && (data.saldo || data.saldo_atual)) {
        return data;
      }

      // Se falhar, tenta a nova API (mas via proxy também)
      // Como AllOrigins é chato com POST, vamos tentar outro proxy ou apenas falhar graciosamente
      console.warn('Tentando via fallback direto (pode falhar por CORS)...');
      const response = await fetch('https://cepcerto.com/api-saldo/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_cliente_postagem: key })
      }).catch(() => null);

      if (response && response.ok) {
        const newData = await response.json();
        if (newData.saldo_atual) {
          const cleanSaldo = newData.saldo_atual.replace('R$', '').replace('.', '').replace(',', '.').trim();
          return { ...newData, saldo: cleanSaldo };
        }
        return newData;
      }

      // Se tudo falhar, retorna um objeto vazio para não quebrar o app
      return { saldo: "0,00", error: "Não foi possível conectar à API" };
    } catch (err) {
      console.error('CepCerto Balance Error:', err);
      return { saldo: "0,00", error: String(err) };
    }
  },

  async generatePix(amount: number, email: string, phone: string, config: any) {
    if (!config?.api_key_postagem && !config?.api_key) throw new Error('Token CepCerto não configurado.');
    const key = config.api_key_postagem || config.api_key;
    try {
      // Formatar o valor como 9.999,00 conforme solicitado
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);

      const response = await fetch('https://cepcerto.com/api-credito/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token_cliente_postagem: key,
          valor_credito: formattedAmount,
          email: email,
          telefone: phone
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // Se falhar por CORS ou outro erro, tentar via proxy
      console.warn('Direct PIX generation failed, trying via proxy...');
      const targetUrl = `https://www.cepcerto.com/ws/json-pix/${amount}/${email}/${phone.replace(/\D/g, '')}/${key}`;
      const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`);
      
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        const contents = JSON.parse(data.contents);
        if (contents.msg && contents.msg !== 'OK') throw new Error(contents.msg);
        return contents;
      }
      
      throw new Error('Erro ao gerar PIX');
    } catch (err) {
      console.error('CepCerto PIX Error:', err);
      throw err;
    }
  },

  async generateLabel(orderId: string, config: any, manualData?: any) {
    if (!config?.api_key_postagem && !config?.api_key) {
      throw new Error('Token do CepCerto não configurado.');
    }
    const key = config.api_key_postagem || config.api_key;
    console.log('📦 Gerando etiqueta real CepCerto para o pedido:', orderId, manualData ? 'Manual' : 'Automático');
    
    try {
      let payload: any;

      if (manualData) {
        payload = {
          token_cliente_postagem: key,
          ...manualData
        };
      } else {
        // 1. Buscar dados completos do pedido e itens
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle();

        if (orderError || !order) throw new Error('Pedido não encontrado');

        // 2. Buscar dados da loja (remetente)
        const { data: settings } = await supabase
          .from('store_settings')
          .select('*')
          .limit(1)
          .maybeSingle();

        if (!settings) throw new Error('Configurações da loja não encontradas');

        // 3. Mapear tipo de entrega
        const method = (order.shipping_method || '').toLowerCase();
        let tipoEntrega = 'sedex';
        if (method.includes('pac')) tipoEntrega = 'pac';
        else if (method.includes('jadlog-package')) tipoEntrega = 'jadlog-package';
        else if (method.includes('jadlog-dotcom')) tipoEntrega = 'jadlog-dotcom';

        // 4. Preparar dados do remetente (parsing do endereço se necessário)
        const senderAddress = settings.address || '';
        const senderParts = senderAddress.split(',').map((s: string) => s.trim());
        const senderLogradouro = senderParts[0] || 'Endereço não informado';
        const senderRest = (senderParts[1] || '').split('-').map((s: string) => s.trim());
        const senderNumero = senderRest[0] || 'SN';
        const senderBairro = senderRest[1] || 'Centro';

        // 5. Preparar dados do destinatário
        const dest = order.shipping_address || {};
        
        // 6. Montar o payload conforme solicitado
        payload = {
          token_cliente_postagem: key,
          tipo_entrega: tipoEntrega,
          logistica_reversa: "",
          cep_remetente: (settings.origin_zip_code || settings.cep || '').replace(/\D/g, ''),
          cep_destinatario: (dest.cep || '').replace(/\D/g, ''),
          peso: (order.weight_kg || 1).toString(),
          altura: (order.height_cm || 20).toString(),
          largura: (order.width_cm || 20).toString(),
          comprimento: (order.length_cm || 20).toString(),
          valor_encomenda: Math.max(50, order.total).toFixed(2),
          
          // Remetente
          nome_remetente: settings.company_name.substring(0, 50),
          cpf_cnpj_remetente: settings.cnpj.replace(/\D/g, ''),
          whatsapp_remetente: (settings.whatsapp || settings.phone || '').replace(/\D/g, '').substring(0, 11),
          email_remetente: settings.email.substring(0, 50),
          logradouro_remetente: senderLogradouro.substring(0, 50),
          bairro_remetente: senderBairro.substring(0, 40),
          numero_endereco_remetente: senderNumero.substring(0, 10),
          complemento_remetente: "",
          
          // Destinatário
          nome_destinatario: (order.customer_name || dest.nome || 'Cliente').substring(0, 50),
          cpf_cnpj_destinatario: (order.customer_document || '').replace(/\D/g, ''),
          whatsapp_destinatario: (order.customer_phone || '').replace(/\D/g, '').substring(0, 11),
          email_destinatario: (order.customer_email || '').substring(0, 50),
          logradouro_destinatario: (dest.logradouro || '').substring(0, 50),
          bairro_destinatario: (dest.bairro || '').substring(0, 40),
          numero_endereco_destinatario: (dest.numero || 'SN').toString().substring(0, 10),
          complemento_destinatario: (dest.complemento || '').substring(0, 20),
          
          tipo_doc_fiscal: "declaracao",
          produtos: (order.order_items || []).map((item: any) => ({
            descricao: item.product_name.substring(0, 50),
            valor: item.price.toFixed(2),
            quantidade: item.quantity.toString()
          })),
          chave_danfe: ""
        };
      }

      console.log('🚀 Enviando payload para CepCerto:', payload);

      // Tentar via proxy para evitar CORS
      const response = await fetch('https://cepcerto.com/api-postagem/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        // Fallback via proxy se falhar por CORS
        console.warn('Direct postagem failed, trying via proxy...');
        const proxyRes = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'postagem-direta',
            payload: payload
          })
        });
        result = await proxyRes.json();
      }

      if (!result || (!result.success && !result.recibo)) {
        throw new Error(result?.error || result?.msg || 'Erro ao gerar postagem no CepCerto');
      }

      const recibo = result.recibo || result.data?.recibo;
      if (!recibo) throw new Error('CepCerto não retornou recibo de postagem.');

      // Agora gera a etiqueta com o recibo
      const labelRes = await fetch(`https://www.cepcerto.com/ws/json-etiqueta/${recibo}/${key}`);
      if (!labelRes.ok) throw new Error('Erro ao gerar etiqueta final');
      
      const labelData = await labelRes.json();
      
      return { 
        success: true, 
        tracking_code: labelData.cod_objeto || labelData.Encomenda, 
        shipping_label_url: labelData.url 
      };
    } catch (err: any) {
      console.error('❌ Erro na geração de etiqueta CepCerto:', err);
      return { success: false, error: err.message };
    }
  },

  async cancelLabel(orderId: string, trackingCode: string, config: any) {
    if (!config?.api_key_postagem && !config?.api_key) throw new Error('Token CepCerto não configurado.');
    const key = config.api_key_postagem || config.api_key;
    
    const payload = {
      token_cliente_postagem: key,
      cod_objeto: trackingCode
    };

    try {
      console.log('🗑️ Cancelando postagem CepCerto:', trackingCode);
      
      // Tenta via POST conforme nova documentação
      const response = await fetch('https://cepcerto.com/api-cancela-postagem/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        // Fallback via proxy se falhar por CORS
        console.warn('Direct cancel failed, trying via proxy...');
        const proxyRes = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'cancelar-postagem',
            payload: payload
          })
        });
        result = await proxyRes.json();
      }

      console.log('📡 Resposta cancelamento CepCerto:', result);

      if (result && (result.sucesso === true || result.sucesso === "true" || result.success === true)) {
        return { success: true };
      }
      
      throw new Error(result?.mensagem || result?.msg || result?.erro || 'Erro ao cancelar etiqueta');
    } catch (err: any) {
      console.error('CepCerto Cancel Error:', err);
      return { success: false, error: err.message };
    }
  },
  async consultPostage(trackingCode: string, config: any) {
    const apiKey = config?.api_key || config?.api_key_postagem;
    if (!apiKey) throw new Error('Token de postagem não configurado');

    const payload = {
      token_cliente_postagem: apiKey,
      cod_objeto: trackingCode
    };

    try {
      console.log('🔍 Consultando postagem CepCerto:', trackingCode);
      
      const response = await fetch('https://cepcerto.com/api-consulta-postagem/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        // Fallback via proxy
        const proxyRes = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'consulta-postagem',
            payload: payload
          })
        });
        result = await proxyRes.json();
      }

      console.log('📡 Resposta consulta CepCerto:', result);
      return result;
    } catch (err: any) {
      console.error('CepCerto Consult Error:', err);
      throw err;
    }
  },
  async getFinancialStatement(config: any) {
    const apiKey = config?.api_key || config?.api_key_postagem;
    if (!apiKey) throw new Error('Token de postagem não configurado');

    const payload = {
      token_cliente_postagem: apiKey
    };

    try {
      console.log('💰 Consultando extrato financeiro CepCerto');
      
      const response = await fetch('https://cepcerto.com/api-financeiro/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        // Fallback via proxy
        const proxyRes = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'extrato-financeiro',
            payload: payload
          })
        });
        result = await proxyRes.json();
      }

      console.log('📡 Resposta extrato financeiro CepCerto:', result);
      return result;
    } catch (err: any) {
      console.error('CepCerto Financial Error:', err);
      throw err;
    }
  },
  async getTrackingInfo(trackingCode: string, config: any) {
    const apiKey = config?.api_key || config?.api_key_postagem;
    if (!apiKey) throw new Error('Token de postagem não configurado');

    const payload = {
      token_cliente_postagem: apiKey,
      codigo_objeto: trackingCode
    };

    try {
      console.log('🔍 Consultando rastreio CepCerto (API POST):', trackingCode);
      
      const response = await fetch('https://cepcerto.com/api-rastreio/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      let result;
      if (response.ok) {
        result = await response.json();
      } else {
        // Fallback via proxy
        const proxyRes = await fetch('https://bnqxinknkjvfbaqaopjc.supabase.co/functions/v1/cepcerto-proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
            action: 'rastreio-objeto',
            payload: payload
          })
        });
        result = await proxyRes.json();
      }

      console.log('📡 Resposta rastreio CepCerto:', result);
      return result;
    } catch (err: any) {
      console.error('CepCerto Tracking API Error:', err);
      throw err;
    }
  },
  async getTrackingStatus(trackingCode: string, config: any) {
    console.log('🔍 Buscando rastreio para:', trackingCode, 'Config:', JSON.stringify(config));
    const cleanTrackingCode = trackingCode.trim();
    const apiKey = config?.api_key || config?.api_key_postagem;

    // Função auxiliar para tentar CepCerto com fallbacks
    const tryCepCerto = async (code: string, key: string) => {
      // 1. Tenta Proxy do Servidor
      try {
        console.log('🔄 Chamando Proxy CepCerto...');
        const res = await fetch(`/api/tracking/cepcerto?tracking_code=${code}&api_key=${key}`);
        if (res.ok) {
          const data = await res.json();
          if (data && !data.erro && Array.isArray(data.eventos)) return data;
        } else {
          console.warn(`⚠️ Proxy CepCerto retornou status ${res.status}`);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao chamar Proxy CepCerto.');
      }

      // 2. Tenta AllOrigins (CORS Bypass Direto)
      try {
        console.log('🔄 Tentando fallback direto CepCerto (AllOrigins)...');
        const target = encodeURIComponent(`https://www.cepcerto.com/ws/json-rastreio/${code}/${key}`);
        const res = await fetch(`https://api.allorigins.win/get?url=${target}`);
        if (res.ok) {
          const json = await res.json();
          if (json.contents) {
            try {
              const data = JSON.parse(json.contents);
              if (data && !data.erro && Array.isArray(data.eventos)) return data;
            } catch (parseErr) {
              console.warn('⚠️ Resposta AllOrigins CepCerto não é JSON válido.');
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Fallback direto CepCerto falhou.');
      }

      return null;
    };

    // Função auxiliar para tentar Linketrack com fallbacks
    const tryLinketrack = async (code: string) => {
      // 1. Tenta Proxy do Servidor
      try {
        console.log('🔄 Tentando Linketrack Proxy...');
        const res = await fetch(`/api/tracking/linketrack?tracking_code=${code}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.eventos && data.eventos.length > 0) return data;
        } else {
          console.warn(`⚠️ Linketrack Proxy retornou status ${res.status}`);
        }
      } catch (e) {
        console.warn('⚠️ Erro ao chamar Linketrack Proxy.');
      }

      // 2. Tenta AllOrigins (CORS Bypass Direto)
      try {
        console.log('🔄 Tentando fallback direto Linketrack (AllOrigins)...');
        const target = encodeURIComponent(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${code}`);
        const res = await fetch(`https://api.allorigins.win/get?url=${target}`);
        if (res.ok) {
          const json = await res.json();
          if (json.contents) {
            try {
              const data = JSON.parse(json.contents);
              if (data && data.eventos && data.eventos.length > 0) return data;
            } catch (parseErr) {
              console.warn('⚠️ Resposta AllOrigins Linketrack não é JSON válido.');
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Fallback direto Linketrack falhou.');
      }

      return null;
    };

    // EXECUÇÃO EM CASCATA

    // 1. Tenta CepCerto (se houver chave)
    if (apiKey) {
      const cepData = await tryCepCerto(cleanTrackingCode, apiKey);
      if (cepData) {
        console.log('✅ Rastreio encontrado via CepCerto');
        return {
          status: cepData.eventos[0]?.status || 'Em trânsito',
          history: cepData.eventos.map((e: any) => ({
            date: `${e.data} ${e.hora}`,
            location: e.local || 'Não informado',
            description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
          }))
        };
      }
    }

    // 2. Tenta BrasilAPI
    try {
      console.log('🔄 Tentando BrasilAPI...');
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${cleanTrackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.historico && data.historico.length > 0) {
          console.log('✅ Rastreio encontrado via BrasilAPI');
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
      console.warn('⚠️ BrasilAPI falhou.');
    }

    // 3. Tenta Linketrack
    const linkeData = await tryLinketrack(cleanTrackingCode);
    if (linkeData) {
      console.log('✅ Rastreio encontrado via Linketrack');
      return {
        status: linkeData.eventos[0].status || 'Em trânsito',
        history: linkeData.eventos.map((e: any) => ({
          date: `${e.data} ${e.hora}`,
          location: e.local || 'Não informado',
          description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
        }))
      };
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

    // Fallback para Linketrack
    try {
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack (Frenet)');
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
    } catch (e) {}

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
    // 1. Fallback para BrasilAPI
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

    // 2. Fallback para Linketrack (Proxy do Servidor)
    try {
      console.log('🔄 Tentando Linketrack Proxy (Jadlog)...');
      const response = await fetch(`/api/tracking/linketrack?tracking_code=${trackingCode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.eventos && data.eventos.length > 0) {
          console.log('✅ Rastreio encontrado via Linketrack Proxy (Jadlog)');
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
      console.warn('⚠️ Linketrack fallback falhou para Jadlog.', e);
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
      .select('shipping_method, tracking_code')
      .eq('id', orderId)
      .maybeSingle();

    // Se não encontrar pelo ID completo, tenta pelo ID curto (primeiros 8 caracteres)
    if (!order) {
      // Tenta buscar como string para evitar erro de cast em UUID
      const { data: orderShort } = await supabase
        .from('orders')
        .select('shipping_method, tracking_code')
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

    // Para CepCerto, usamos o tracking_code se disponível
    const identifier = (carrier.provider === 'cepcerto' && order.tracking_code) ? order.tracking_code : orderId;

    return provider.cancelLabel(identifier, carrier.config);
  },

  async getBalance(carrierId: string) {
    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('*')
      .eq('id', carrierId)
      .maybeSingle();

    if (!carrier) throw new Error('Carrier not found');
    const provider = providers[carrier.provider];
    if (!provider || !provider.getBalance) throw new Error('Provider does not support balance inquiry');

    return provider.getBalance(carrier.config);
  },

  async generatePix(carrierId: string, amount: number, email: string, phone: string) {
    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('*')
      .eq('id', carrierId)
      .maybeSingle();

    if (!carrier) throw new Error('Carrier not found');
    const provider = providers[carrier.provider];
    if (!provider || !provider.generatePix) throw new Error('Provider does not support PIX generation');

    return provider.generatePix(amount, email, phone, carrier.config);
  },

  async getTrackingStatus(idOrCode: string) {
    console.log("================================");
    console.log("INICIANDO RASTREAMENTO");
    console.log("Input:", idOrCode);
    console.log("================================");

    // 1. Tenta identificar se é um UUID (Order ID) ou Código de Rastreio
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode) || 
                   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

    let orderId = isUuid ? idOrCode : null;
    let trackingCode = isUuid ? null : idOrCode;

    // Se for UUID, precisamos buscar o pedido para pegar o tracking_code
    if (isUuid) {
      console.log("Buscando pedido no banco para obter código de rastreio...");
      const { data: orders, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', idOrCode)
        .limit(1);

      const order = orders?.[0];

      if (orderError || !order) {
        console.log("❌ Pedido não encontrado no banco.");
      } else {
        console.log("✅ Pedido encontrado:", order.id);
        trackingCode = order.tracking_code;
        
        if (order.shipping_method === 'CLIENTE BUSCA NA EMPRESA') {
          return {
            status: 'Pronto para retirada',
            history: []
          };
        }
      }
    }

    if (trackingCode) {
      if (trackingCode.toUpperCase() === 'CLIENTE BUSCA NA EMPRESA') {
        return {
          status: 'Pronto para retirada',
          history: []
        };
      }
      console.log("Normalizando código");
      trackingCode = trackingCode.replace(/\s/g, "").trim().toUpperCase();
    }

    console.log("Tracking Code:", trackingCode);

    // Se não tivermos orderId mas tivermos trackingCode, tentamos achar o orderId para o histórico do banco
    if (!orderId && trackingCode) {
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('tracking_code', trackingCode)
        .limit(1);
      if (orderData && orderData.length > 0) orderId = orderData[0].id;
    }

    // Se tivermos um código de rastreio, tentamos a API obrigatoriamente
    if (trackingCode) {
      console.log("Consultando API de rastreamento...");
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const endpoint = orderId 
          ? `/api/tracking/code/${trackingCode}?orderId=${orderId}`
          : `/api/tracking/code/${trackingCode}`;
        const response = await fetch(endpoint, { signal: controller.signal });
        clearTimeout(timeoutId);

        console.log("Response status:", response.status);
        const data = await response.json();
        console.log("Resposta API Rastreamento:", data);

        if (data && data.success && data.history && data.history.length > 0) {
          console.log("✅ Eventos encontrados API:", data.history.length);
          
          if (data.provider === 'Fallback Manual') {
            console.log("Aguardando verificação manual");
            
            data.history = [{
              description: "Não foi possível consultar automaticamente. Por favor, verifique o status manualmente.",
              location: "Correios",
              date: new Date().toLocaleString('pt-BR')
            }];
            data.status = 'Aguardando verificação manual';
          }

          console.log("FINALIZANDO RASTREAMENTO");
          return {
            status: data.status || 'Em trânsito',
            history: data.history
          };
        } else {
          console.log("⚠️ Nenhum evento retornado pela API ou falha na resposta.");
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log("❌ Erro: Timeout de 20 segundos atingido na chamada da API");
        } else {
          console.log("❌ Erro ao consultar API:", error);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      console.log("⚠️ Código de rastreio não disponível para consulta API.");
    }

    // Fallback: Somente se a API falhar ou não houver código
    console.log("Nenhum evento API, ativando fallback");

    if (orderId) {
      console.log("Buscando histórico no banco de dados (tracking_history)...");
      const { data: history } = await supabase
        .from('tracking_history')
        .select('*')
        .eq('order_id', orderId)
        .order('date', { ascending: true });

      if (history && history.length > 0) {
        console.log("✅ Eventos encontrados no banco (Fallback):", history.length);
        console.log("FINALIZANDO RASTREAMENTO");
        return {
          status: 'Em trânsito',
          history: history.map(h => ({
            date: new Date(h.date).toLocaleString('pt-BR'),
            location: h.location || 'Correios',
            description: h.description
          }))
        };
      }
    }

    if (trackingCode) {
      console.log("Aguardando verificação manual");
      
      return {
        status: 'Aguardando verificação manual',
        history: [{
          description: "Não foi possível consultar automaticamente. Por favor, verifique o status manualmente.",
          location: "Correios",
          date: new Date().toLocaleString('pt-BR')
        }]
      };
    }

    // Fallback Manual Final
    console.log("Usando fallback manual padrão");
    const manualResult = {
      status: 'Preparando envio',
      history: []
    };
    console.log("Exibindo 0 eventos (Fallback Manual)");
    console.log("FINALIZANDO RASTREAMENTO");
    return manualResult;
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
  },

  /**
   * Adiciona um evento de rastreio manualmente ao histórico.
   */
  async addTrackingEvent(orderId: string, description: string, location: string = 'Centro Logístico') {
    console.log(`➕ Adicionando evento de rastreio para o pedido ${orderId}: ${description}`);
    const { error } = await supabase
      .from('tracking_history')
      .insert({
        order_id: orderId,
        description,
        location,
        date: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Erro ao adicionar evento de rastreio:', error);
      throw error;
    }
    return { success: true };
  },

  async consultPostage(trackingCode: string, config: any) {
    return cepcertoProvider.consultPostage!(trackingCode, config);
  },

  async getFinancialStatement(config: any) {
    return cepcertoProvider.getFinancialStatement!(config);
  },

  async getTrackingInfo(trackingCode: string, config: any) {
    return cepcertoProvider.getTrackingInfo!(trackingCode, config);
  }
};
