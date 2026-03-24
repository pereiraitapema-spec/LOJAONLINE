import { supabase } from '../lib/supabase';

export interface ChatMessage {
  id: string;
  chat_id?: string;
  sender_id: string;
  receiver_id?: string | null;
  message: string;
  created_at: string;
  is_human?: boolean;
  is_read?: boolean;
}

export const chatService = {
  async fetchMessages(chatId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async fetchUserHistory(userId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw error;
    return data || [];
  },

  async sendMessage(messageData: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  subscribeToMessages(userId: string, callback: (payload: any) => void) {
    return supabase
      .channel('chat_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'chat_messages',
        filter: `receiver_id=eq.${userId}`
      }, callback)
      .subscribe();
  }
};
