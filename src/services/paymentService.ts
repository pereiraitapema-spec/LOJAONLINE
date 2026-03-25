import { supabase } from '../lib/supabase';
import { PaymentProvider } from './providers/payment/types';
import { logApiCall } from '../lib/monitoring';

const pagarmeProvider: PaymentProvider = {
  async processPayment(orderData: any, config: any) {
    if (!config?.access_token) return { success: false, error: 'Access Token não configurado.' };
    
    const startTime = Date.now();
    try {
      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(config.access_token + ':')}`
        },
        body: JSON.stringify({
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
            type: 'individual'
          },
          payments: [
            {
              payment_method: orderData.payment_method === 'credit_card' ? 'credit_card' : 'pix',
              credit_card: orderData.payment_method === 'credit_card' ? {
                card: {
                  number: orderData.card_number,
                  holder_name: orderData.card_name,
                  exp_month: orderData.expiry.split('/')[0],
                  exp_year: '20' + orderData.expiry.split('/')[1],
                  cvv: orderData.cvv
                },
                installments: parseInt(orderData.installments)
              } : undefined
            }
          ]
        })
      });

      const duration = Date.now() - startTime;
      const data = await response.json();
      
      if (response.ok) {
        await logApiCall('pagarme', '/orders', duration, true);
        return { success: true, payment_id: data.id };
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

const providers: Record<string, PaymentProvider> = {
  'pagarme': pagarmeProvider,
  'pagarme2': pagarmeProvider
};

export const paymentService = {
  async processPayment(provider: string, orderData: any, gatewayConfig: any) {
    const paymentProvider = providers[provider];
    if (!paymentProvider) throw new Error(`Provedor ${provider} não suportado.`);
    return paymentProvider.processPayment(orderData, gatewayConfig);
  }
};
