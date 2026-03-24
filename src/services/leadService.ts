import { supabase } from '../lib/supabase';

export type LeadStatus = 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';

export const leadService = {
  /**
   * Atualiza o status de um lead baseado na ação do usuário.
   * @param status O novo status do lead
   */
  async updateStatus(status: LeadStatus) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const email = session.user.email;
      const name = session.user.user_metadata?.full_name || email?.split('@')[0];

      // Não criar lead para o admin
      if (email === 'pereira.itapema@gmail.com') {
        console.log('🛡️ Admin detectado no chat, pulando criação de lead.');
        return;
      }

      // 1. Verificar se já existe um lead com este ID (userId)
      const { data: leadById } = await supabase
        .from('leads')
        .select('id, status_lead')
        .eq('id', userId)
        .maybeSingle();

      if (leadById) {
        // Lead já existe com este ID, apenas atualiza o status se necessário
        const statusOrder: Record<LeadStatus, number> = {
          'inativo': 0,
          'frio': 1,
          'morno': 2,
          'quente': 3,
          'cliente': 4
        };

        const currentStatus = (leadById.status_lead || 'frio') as LeadStatus;
        
        if (statusOrder[status] > statusOrder[currentStatus]) {
          await supabase
            .from('leads')
            .update({ 
              status_lead: status,
              score: status === 'morno' ? 30 : (status === 'quente' ? 100 : 10),
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
          
          console.log(`🔥 Lead (ID: ${userId}) atualizado: ${currentStatus} -> ${status}`);
        }
      } else {
        // Não existe lead com este ID.
        // Vamos ver se existe um lead com este EMAIL para copiar os dados (como whatsapp)
        const { data: leadByEmail } = await supabase
          .from('leads')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        // Criar novo lead com o ID do usuário
        const newLead = {
          id: userId,
          nome: leadByEmail?.nome || name,
          email: email,
          whatsapp: leadByEmail?.whatsapp || session.user.user_metadata?.phone || 'Não informado',
          status_lead: status,
          score: status === 'frio' ? 10 : (status === 'morno' ? 30 : 100)
        };

        const { data: createdLead, error: insertError } = await supabase
          .from('leads')
          .insert([newLead])
          .select()
          .single();
        
        if (insertError) {
          console.error('❌ Erro ao criar novo lead com ID de usuário:', insertError);
          throw insertError;
        }

        console.log(`❄️ Novo lead criado com ID de usuário (${userId}) como: ${status}`);
        await this.sendToWebhook('lead:created', createdLead);
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar status do lead:', error);
    }
  },

  /**
   * Envia dados para o webhook do n8n para automação.
   */
  async sendToWebhook(event: string, data: any) {
    try {
      const { data: settings } = await supabase
        .from('store_settings')
        .select('n8n_webhook_url')
        .maybeSingle();

      if (!settings?.n8n_webhook_url) return;

      const payload = {
        event,
        timestamp: new Date().toISOString(),
        ...data
      };

      await fetch(settings.n8n_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      console.log(`🚀 Evento "${event}" enviado para n8n`);
    } catch (error) {
      console.warn('⚠️ Falha ao enviar para n8n:', error);
    }
  }
};
