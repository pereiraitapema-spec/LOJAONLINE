import { supabase } from '../lib/supabase';

export const paymentService = {
  async processPayment(provider: string, orderData: any, gatewayConfig: any) {
    switch (provider) {
      case 'pagarme':
      case 'pagarme2':
        return this.processPagarmePayment(orderData, gatewayConfig);
      default:
        throw new Error(`Provedor ${provider} não suportado.`);
    }
  },

  async processPagarmePayment(orderData: any, gatewayConfig: any) {
    try {
      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(gatewayConfig.access_token + ':')}`
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

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao processar pagamento no Pagar.me');
      }

      return await response.json();
    } catch (error) {
      console.error('Pagar.me API Error:', error);
      throw error;
    }
  }
};
