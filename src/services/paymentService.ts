import { supabase } from '../lib/supabase';
import { PaymentProvider } from './providers/payment/types';
import { logApiCall } from '../lib/monitoring';

const pagarmeProvider: PaymentProvider = {
  async processPayment(orderData: any, config: any) {
    if (!config?.access_token) return { success: false, error: 'Access Token não configurado.' };
    
    console.log(`💳 Processando pagamento via Pagar.me...`);
    console.log('📦 Dados do Pedido para Provedor:', JSON.stringify(orderData, null, 2));
    
    const startTime = Date.now();
    try {
      const response = await fetch('/api/payments/pagarme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
              document: orderData.customer_document,
              type: 'individual',
              phones: {
                mobile_phone: {
                  country_code: '55',
                  area_code: orderData.customer_phone.substring(0, 2),
                  number: orderData.customer_phone.substring(2)
                }
              },
              address: {
                line_1: `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood}`,
                zip_code: orderData.shipping_address.cep.replace(/\D/g, ''),
                city: orderData.shipping_address.city,
                state: orderData.shipping_address.state,
                country: 'BR'
              }
            },
            shipping: {
              amount: Math.round((orderData.shipping_cost || 0) * 100),
              description: orderData.shipping_method || 'Entrega Padrão',
              recipient_name: orderData.customer_name,
              recipient_phone: orderData.customer_phone,
              address: {
                line_1: `${orderData.shipping_address.number}, ${orderData.shipping_address.street}, ${orderData.shipping_address.neighborhood}`,
                zip_code: orderData.shipping_address.cep.replace(/\D/g, ''),
                city: orderData.shipping_address.city,
                state: orderData.shipping_address.state,
                country: 'BR'
              }
            },
            payments: [
              {
                payment_method: orderData.payment_method,
                credit_card: orderData.payment_method === 'credit_card' ? {
                  card: {
                    number: orderData.card_number,
                    holder_name: orderData.card_name,
                    exp_month: parseInt(orderData.expiry.split('/')[0]),
                    exp_year: parseInt('20' + orderData.expiry.split('/')[1]),
                    cvv: orderData.cvv
                  },
                  installments: parseInt(orderData.installments)
                } : undefined,
                debit_card: orderData.payment_method === 'debit_card' ? {
                  card: {
                    number: orderData.card_number,
                    holder_name: orderData.card_name,
                    exp_month: parseInt(orderData.expiry.split('/')[0]),
                    exp_year: parseInt('20' + orderData.expiry.split('/')[1]),
                    cvv: orderData.cvv
                  }
                } : undefined,
                boleto: orderData.payment_method === 'boleto' ? {
                  bank: 'itau', // Ou dinâmico se necessário
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
            ]
          },
          config
        })
      });

      const duration = Date.now() - startTime;
      const data = await response.json();
      
      console.log('📡 Resposta do Proxy de Pagamento:', JSON.stringify(data, null, 2));
      
      if (response.ok) {
        console.log('✅ Pagamento processado com sucesso pelo gateway.');
        await logApiCall('pagarme', '/orders', duration, true);
        
        // Extrair dados do PIX ou Boleto se for o caso
        let pixData = null;
        let boletoData = null;
        if (data.charges?.[0]?.last_transaction) {
          const transaction = data.charges[0].last_transaction;
          if (orderData.payment_method === 'pix') {
            pixData = {
              qr_code: transaction.qr_code,
              qr_code_url: transaction.qr_code_url,
              expires_at: transaction.expires_at
            };
          } else if (orderData.payment_method === 'boleto') {
            boletoData = {
              url: transaction.url,
              pdf: transaction.pdf,
              barcode: transaction.barcode,
              expires_at: transaction.due_at
            };
          }
        }

        return { 
          success: true, 
          payment_id: data.id,
          pix: pixData,
          boleto: boletoData
        };
      }
      
      await logApiCall('pagarme', '/orders', duration, false, data.message || 'Erro no processamento.');
      return { success: false, error: data.message || 'Erro no processamento.' };
    } catch (err: any) {
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
    const paymentProvider = providers[provider];
    if (!paymentProvider) throw new Error(`Provedor ${provider} não suportado.`);
    return paymentProvider.processPayment(orderData, gatewayConfig);
  }
};
