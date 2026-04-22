import { supabase } from '../lib/supabase';
import { PaymentProvider } from './providers/payment/types';
import { logApiCall } from '../lib/monitoring';

const pagarmeProvider: PaymentProvider = {
  async processPayment(orderData: any, config: any) {
    if (!config?.access_token) return { success: false, error: 'Access Token não configurado.' };
    
    console.log(`💳 Processando pagamento via Pagar.me...`);
    console.log('📦 Dados do Pedido para Provedor:', JSON.stringify(orderData, null, 2));
    
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

    console.log('⏱️ Iniciando fetch com timeout de 60s...');
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pagarme-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          orderData: {
            items: orderData.items.map((item: any) => ({
              amount: Math.round(item.price * 100),
              description: item.product_name,
              quantity: item.quantity,
              code: item.product_id
            })),
            customer: {
              name: orderData.customer_name,
              email: orderData.customer_email,
              document: orderData.customer_document.replace(/\D/g, ''),
              tax_id: orderData.customer_document.replace(/\D/g, ''),
              type: orderData.customer_document.replace(/\D/g, '').length > 11 ? 'company' : 'individual',
              phones: {
                mobile_phone: {
                  country_code: '55',
                  area_code: orderData.customer_phone.replace(/\D/g, '').substring(0, 2),
                  number: orderData.customer_phone.replace(/\D/g, '').length > 10 
                    ? orderData.customer_phone.replace(/\D/g, '').substring(2)
                    : orderData.customer_phone.replace(/\D/g, '')
                }
              },
              address: {
                line_1: orderData.shipping_address.street ? `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood || ''}` : 'Rua Fictícia, 123, Centro',
                zip_code: orderData.shipping_address.cep && orderData.shipping_address.cep.toUpperCase() !== 'BALCAO' ? orderData.shipping_address.cep.replace(/\D/g, '') : '01001000',
                city: orderData.shipping_address.city || 'São Paulo',
                state: orderData.shipping_address.state || 'SP',
                country: 'BR'
              }
            },
            shipping: {
              amount: Math.round((orderData.shipping_cost || 0) * 100),
              description: orderData.shipping_method || 'Entrega Padrão',
              recipient_name: orderData.customer_name,
              recipient_phone: orderData.customer_phone.replace(/\D/g, ''),
              address: {
                line_1: orderData.shipping_address.street ? `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood || ''}` : 'Rua Fictícia, 123, Centro',
                zip_code: orderData.shipping_address.cep && orderData.shipping_address.cep.toUpperCase() !== 'BALCAO' ? orderData.shipping_address.cep.replace(/\D/g, '') : '01001000',
                city: orderData.shipping_address.city || 'São Paulo',
                state: orderData.shipping_address.state || 'SP',
                country: 'BR'
              }
            },
            metadata: {
              order_id: orderData.order_id
            },
            payments: [
              {
                payment_method: orderData.payment_method,
                credit_card: orderData.payment_method === 'credit_card' ? {
                  card: {
                    number: orderData.card_number,
                    holder_name: orderData.card_name,
                    holder_document: orderData.customer_document.replace(/\D/g, ''),
                    exp_month: parseInt(orderData.expiry.split('/')[0].trim(), 10),
                    exp_year: parseInt('20' + orderData.expiry.split('/')[1].trim(), 10),
                    cvv: orderData.cvv,
                    billing_address: {
                      line_1: orderData.shipping_address.street ? `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood}` : 'Rua Fictícia, 123, Centro',
                      zip_code: orderData.shipping_address.cep && orderData.shipping_address.cep.toUpperCase() !== 'BALCAO' ? orderData.shipping_address.cep.replace(/\D/g, '') : '01001000',
                      city: orderData.shipping_address.city || 'São Paulo',
                      state: orderData.shipping_address.state || 'SP',
                      country: 'BR'
                    }
                  },
                  installments: parseInt(orderData.installments)
                } : undefined,
                debit_card: orderData.payment_method === 'debit_card' ? {
                  card: {
                    number: orderData.card_number,
                    holder_name: orderData.card_name,
                    holder_document: orderData.customer_document.replace(/\D/g, ''),
                    exp_month: parseInt(orderData.expiry.split('/')[0].trim()),
                    exp_year: parseInt('20' + orderData.expiry.split('/')[1].trim()),
                    cvv: orderData.cvv,
                    billing_address: {
                      line_1: orderData.shipping_address.street ? `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood}` : 'Rua Fictícia, 123, Centro',
                      zip_code: orderData.shipping_address.cep && orderData.shipping_address.cep.toUpperCase() !== 'BALCAO' ? orderData.shipping_address.cep.replace(/\D/g, '') : '01001000',
                      city: orderData.shipping_address.city || 'São Paulo',
                      state: orderData.shipping_address.state || 'SP',
                      country: 'BR'
                    }
                  }
                } : undefined,
                boleto: orderData.payment_method === 'boleto' ? {
                  bank: 'itau',
                  instructions: 'Pagar até o vencimento',
                  due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
                } : undefined,
                pix: orderData.payment_method === 'pix' ? {
                  expires_in: 3600,
                  additional_information: [
                    {
                      name: 'Pedido',
                      value: orderData.order_id || 'Magnifique4Life'
                    }
                  ]
                } : undefined
              }
            ].filter(p => {
              // Remove o objeto de pagamento se o método não for o selecionado
              // (Isso limpa os campos undefined que o Pagar.me rejeita)
              const method = p.payment_method;
              return (
                (method === 'credit_card' && p.credit_card) ||
                (method === 'debit_card' && p.debit_card) ||
                (method === 'boleto' && p.boleto) ||
                (method === 'pix' && p.pix)
              );
            })
          },
          config
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      console.log('✅ Fetch concluído.');

      const duration = Date.now() - startTime;
      const data = await response.json();
      
      console.log('📡 Resposta do Proxy de Pagamento:', JSON.stringify(data, null, 2));
      
      if (response.ok) {
        console.log('✅ Pagamento processado com sucesso pelo gateway.');
        await logApiCall('pagarme', '/orders', duration, true);
        
        // Extrair dados do PIX ou Boleto se for o caso
        let pixData = null;
        let boletoData = null;
        
        // Log detalhado para depuração
        console.log('🔍 RAW RESPONSE DO GATEWAY:', JSON.stringify(data, null, 2));

        if (orderData.payment_method === 'pix') {
          // Tenta extrair de várias formas possíveis baseadas na API V5
          // No Pagar.me V5, os dados do PIX costumam estar em last_transaction ou em um objeto pix na raiz do payment
          const transaction = data.charges?.[0]?.last_transaction || data.last_transaction || {};
          const payment = data.payments?.[0] || {};
          const pixFromPayment = payment.pix || {};
          const pixFromCharge = data.charges?.[0]?.pix || {};

          pixData = {
            qr_code: 
              transaction.qr_code || 
              transaction.transaction_details?.qr_code || 
              pixFromPayment.qr_code ||
              pixFromCharge.qr_code ||
              data.pix?.qr_code || 
              (data as any).qr_code,
            qr_code_url: 
              transaction.qr_code_url || 
              transaction.transaction_details?.qr_code_url || 
              pixFromPayment.qr_code_url ||
              pixFromCharge.qr_code_url ||
              data.pix?.qr_code_url || 
              (data as any).qr_code_url,
            expires_at: 
              transaction.expires_at || 
              pixFromPayment.expires_at || 
              pixFromCharge.expires_at || 
              data.pix?.expires_at
          };
          
          if (!pixData.qr_code && !pixData.qr_code_url) {
             console.warn('⚠️ Não foi possível encontrar dados do PIX na resposta.', JSON.stringify(data));
             // Fallback total se algo estiver na raiz
             if ((data as any).qr_code) pixData.qr_code = (data as any).qr_code;
             if ((data as any).qr_code_url) pixData.qr_code_url = (data as any).qr_code_url;
          }
          
          console.log('✅ PIX Extraído Final:', pixData);
        }

        return { 
          success: true, 
          payment_id: data.id,
          status: data.status || data.charges?.[0]?.status || data.charges?.[0]?.last_transaction?.status,
          pix: pixData,
          boleto: boletoData
        };
      }
      
      await logApiCall('pagarme', '/orders', duration, false, data.message || 'Erro no processamento.');
      
      let errorMsg = data.message || 'Erro no processamento.';
      if (data.errors) {
        errorMsg += ' Detalhes: ' + Object.keys(data.errors).map(key => `${key}: ${data.errors[key]}`).join(', ');
      }
      
      if (errorMsg.toLowerCase().includes('forbidden') || errorMsg.toLowerCase().includes('authorized')) {
        errorMsg = 'Acesso negado pelo Pagar.me. Verifique se o método de pagamento (PIX ou Cartão) está habilitado na sua conta Pagar.me e se a API Key é de Produção (sk_live).';
      }

      return { success: false, error: errorMsg };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('⏱️ Timeout: O processamento do pagamento demorou mais de 60s.');
        await logApiCall('pagarme', '/orders', Date.now() - startTime, false, 'Timeout: O processamento demorou mais de 60s.');
        return { success: false, error: 'O processamento do pagamento demorou muito (60s). Por favor, tente novamente.' };
      }
      await logApiCall('pagarme', '/orders', Date.now() - startTime, false, err.message);
      return { success: false, error: err.message };
    }
  },
  async refundPayment(paymentId: string, config: any) {
    return { success: true };
  }
};

const mockProvider: PaymentProvider = {
  async processPayment(orderData: any, config: any) {
    console.log(`💳 Simulando pagamento para provedor não implementado...`);
    return { success: true, payment_id: `sim_${Math.random().toString(36).substring(7)}` };
  },
  async refundPayment(paymentId: string, config: any) {
    return { success: true };
  }
};

const providers: Record<string, PaymentProvider> = {
  'pagarme': pagarmeProvider,
  'appmax': mockProvider,
  'yampi': mockProvider,
  'cartpanda': mockProvider,
  'mercadopago': mockProvider,
  'stripe': mockProvider,
  'asaas': mockProvider,
  'cielo': mockProvider,
  'rede': mockProvider,
  'getnet': mockProvider,
  'itau': mockProvider,
  'bradesco': mockProvider,
  'bb': mockProvider,
  'pix': mockProvider,
  'custom': mockProvider
};

export const paymentService = {
  async processPayment(provider: string, orderData: any, gatewayConfig: any) {
    const normalizedProvider = provider.toLowerCase().replace(/[^a-z0-9]/g, '');
    const paymentProvider = providers[normalizedProvider];
    
    if (!paymentProvider) {
      console.error(`❌ Provedor não suportado: "${provider}" (normalizado como: "${normalizedProvider}")`);
      console.log('📡 Provedores disponíveis:', Object.keys(providers));
      throw new Error(`Provedor ${provider} não suportado pelo sistema de check-out.`);
    }
    
    return paymentProvider.processPayment(orderData, gatewayConfig);
  }
};
