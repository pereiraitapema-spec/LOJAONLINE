import { supabase } from '../lib/supabase';

export interface LogisticsStep {
  status: string;
  description: string;
  date: string;
  location: string;
}

export const logisticsService = {
  /**
   * Notifica a transportadora (CepCerto) sobre a nova compra
   */
  async notifyCarrier(orderId: string) {
    console.log(`🚚 Notificando CepCerto sobre o pedido ${orderId}...`);
    // Simulação de chamada de API para o CepCerto
    await new Promise(resolve => setTimeout(resolve, 1000));
    return { success: true };
  },

  /**
   * Gera o código de rastreamento
   */
  async generateTrackingCode(orderId: string) {
    const code = 'BR' + Math.random().toString(36).substring(2, 11).toUpperCase();
    console.log(`📦 Código de rastreamento gerado para ${orderId}: ${code}`);
    
    await supabase
      .from('orders')
      .update({ 
        tracking_code: code,
        status: 'preparing' // Muda para preparando após pagamento
      })
      .eq('id', orderId);
      
    return code;
  },

  /**
   * Gera a etiqueta de envio (Simulação)
   */
  async generateShippingLabel(orderId: string) {
    console.log(`🏷️ Gerando etiqueta de envio para o pedido ${orderId}...`);
    const labelUrl = `/api/logistics/label/${orderId}`;
    
    await supabase
      .from('orders')
      .update({ shipping_label_url: labelUrl })
      .eq('id', orderId);
      
    return labelUrl;
  },

  /**
   * Gera a Nota Fiscal (Simulação)
   */
  async generateInvoice(orderId: string) {
    console.log(`🧾 Gerando Nota Fiscal para o pedido ${orderId}...`);
    const invoiceNumber = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const invoiceUrl = `/api/logistics/invoice/${orderId}`;
    
    await supabase
      .from('orders')
      .update({ 
        invoice_number: invoiceNumber,
        invoice_url: invoiceUrl
      })
      .eq('id', orderId);
      
    return { invoiceNumber, invoiceUrl };
  },

  /**
   * Gera a lista de separação (Picking List)
   */
  async generatePickingList(orderId: string) {
    console.log(`📋 Gerando lista de separação para o pedido ${orderId}...`);
    return { success: true, url: `/api/logistics/picking/${orderId}` };
  },

  /**
   * Adiciona um passo na logística
   */
  async addLogisticsStep(orderId: string, step: LogisticsStep) {
    const { data: order } = await supabase
      .from('orders')
      .select('logistics_history')
      .eq('id', orderId)
      .single();
      
    const history = order?.logistics_history || [];
    const newHistory = [...history, step];
    
    await supabase
      .from('orders')
      .update({ 
        logistics_history: newHistory,
        current_logistics_status: step.status
      })
      .eq('id', orderId);
      
    return newHistory;
  }
};
