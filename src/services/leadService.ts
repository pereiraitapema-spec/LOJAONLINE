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

      // 1. Tentar encontrar o lead pelo email ou user_id
      const { data: existingLead } = await supabase
        .from('leads')
        .select('id, status_lead')
        .or(`email.eq.${email},id.eq.${userId}`)
        .maybeSingle();

      if (existingLead) {
        // Só atualiza se o novo status for "mais quente" que o atual
        // Ordem: inativo < frio < morno < quente < cliente
        const statusOrder: Record<LeadStatus, number> = {
          'inativo': 0,
          'frio': 1,
          'morno': 2,
          'quente': 3,
          'cliente': 4
        };

        const currentStatus = (existingLead.status_lead || 'frio') as LeadStatus;
        
        if (statusOrder[status] > statusOrder[currentStatus]) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ 
              status_lead: status,
              score: status === 'morno' ? 30 : (status === 'quente' ? 100 : 10),
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id);
          
          if (updateError) throw updateError;
          console.log(`🔥 Lead atualizado: ${currentStatus} -> ${status}`);
        }
      } else {
        // Criar novo lead se não existir
        await supabase
          .from('leads')
          .insert([{
            nome: name,
            email: email,
            whatsapp: session.user.user_metadata?.phone || 'Não informado',
            status_lead: status,
            score: status === 'frio' ? 10 : (status === 'morno' ? 30 : 100)
          }]);
        
        console.log(`❄️ Novo lead criado como: ${status}`);
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
