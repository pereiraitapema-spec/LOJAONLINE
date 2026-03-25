import { supabase } from '../lib/supabase';

export const orderService = {
  async getOrderById(orderId: number) {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name))')
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

    return order;
  }
};
