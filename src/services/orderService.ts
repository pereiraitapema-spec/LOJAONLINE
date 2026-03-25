import { supabase } from '../lib/supabase';

export const orderService = {
  async getOrderById(orderId: number) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', orderId)
      .single();

    if (error) throw new Error(`Pedido ${orderId} não encontrado.`);
    return data;
  },

  async createOrder(userId: string, orderData: any, items: any[]) {
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ 
        user_id: userId,
        status: 'pending',
        ...orderData 
      }])
      .select()
      .single();
    
    if (orderError) throw orderError;

    const itemsWithOrderId = items.map(item => ({ 
      ...item, 
      order_id: order.id 
    }));
    
    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsWithOrderId);

    if (itemsError) throw itemsError;

    // Criar shipment padrão com CepCerto
    const { error: shipmentError } = await supabase
      .from('shipments')
      .insert([{
        order_id: order.id,
        carrier_name: 'CepCerto',
        tracking_number: 'TRACK-' + Math.random().toString(36).substr(2, 9).toUpperCase()
      }]);
    
    if (shipmentError) throw shipmentError;

    return order;
  }
};
