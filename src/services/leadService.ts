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
        // Ordem: frio < morno < quente < cliente
        const statusOrder: Record<LeadStatus, number> = {
          'inativo': 0,
          'frio': 1,
          'morno': 2,
          'quente': 3,
          'cliente': 4
        };

        if (statusOrder[status] > statusOrder[existingLead.status_lead as LeadStatus]) {
          await supabase
            .from('leads')
            .update({ 
              status_lead: status,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingLead.id);
          
          console.log(`🔥 Lead atualizado para: ${status}`);
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
  }
};
