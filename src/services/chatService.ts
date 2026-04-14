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
  source?: string;
}

export const chatService = {
  async fetchMessages(chatId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Erro ao buscar mensagens: ${error.message}`);
    return data || [];
  },

  async fetchUserHistory(userId: string): Promise<ChatMessage[]> {
    if (!userId) throw new Error('ID do usuário é obrigatório.');

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true })
      .limit(50);

    if (error) throw new Error(`Erro ao buscar histórico: ${error.message}`);
    return data || [];
  },

  async sendMessage(messageData: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessage> {
    // Validação de entrada rigorosa
    if (!messageData.message || messageData.message.trim().length === 0) {
      throw new Error('A mensagem não pode estar vazia.');
    }
    if (messageData.message.length > 2000) {
      throw new Error('A mensagem é muito longa.');
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select()
      .single();

    if (error) throw new Error(`Erro ao enviar mensagem: ${error.message}`);
    return data;
  },

  subscribeToMessages(userId: string, callback: (payload: any) => void) {
    if (!userId) throw new Error('ID do usuário é obrigatório para subscrição.');
    
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
