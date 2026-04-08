import { supabase } from '../lib/supabase';
import { automationService } from './automationService';

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

    await automationService.trigger('new_order', order);

    return order;
  },
  async updateOrderStatus(orderId: string, status: string) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (error) throw error;

    if (status === 'paid') {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (order) await automationService.trigger('order_paid', order);
    } else if (status === 'shipped') {
      const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
      if (order) await automationService.trigger('order_shipped', order);
    }
  },

  async updateOrder(orderId: string, updateData: any) {
    const { error } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (error) throw error;
  },

  async deleteOrder(orderId: string) {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', orderId);

    if (error) throw error;
  },

  async getOrders(userId?: string, isAdmin?: boolean) {
    let query = supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!isAdmin && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getOrderItems(orderId: string) {
    const { data, error } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (error) throw error;
    return data;
  }
};
