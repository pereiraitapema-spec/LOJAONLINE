import { supabase } from '../lib/supabase';

export const productService = {
  async getActiveProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), tiers:product_tiers(*)')
      .eq('active', true)
      .order('name');
      
    if (error) throw error;
    return data;
  },

  async getAllProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), tiers:product_tiers(*)')
      .order('name');
      
    if (error) throw error;
    return data;
  },

  async getProductById(id: string) {
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), tiers:product_tiers(*)')
      .eq('id', id)
      .single();
      
    if (error) throw error;
    return data;
  },

  async getProductsByIds(ids: string[]) {
    if (!ids || ids.length === 0) return [];
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(name), tiers:product_tiers(*)')
      .in('id', ids);
      
    if (error) throw error;
    return data;
  },

  async updateStock(id: string, newStock: number) {
    const { error } = await supabase
      .from('products')
      .update({ stock: Math.max(0, newStock) })
      .eq('id', id);
      
    if (error) throw error;
  }
};
