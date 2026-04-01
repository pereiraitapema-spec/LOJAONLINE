import { supabase } from '../lib/supabase';

export type LeadStatus = 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';

export const leadService = {
  async updateStatus(status: LeadStatus) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const userId = session.user.id;
      const email = session.user.email;
      const name = session.user.user_metadata?.full_name || email?.split('@')[0];

      if (email === 'pereira.itapema@gmail.com') return;

      // 1. Busca status atual para lógica de progressão
      const { data: lead } = await supabase
        .from('leads')
        .select('status_lead, nome')
        .eq('id', userId)
        .maybeSingle();

      const statusOrder: Record<LeadStatus, number> = {
        'inativo': 0, 'frio': 1, 'morno': 2, 'quente': 3, 'cliente': 4
      };

      const currentStatus = (lead?.status_lead || 'frio') as LeadStatus;
      
      // Se status novo não for superior, não faz nada
      if (statusOrder[status] <= statusOrder[currentStatus]) return;

      // 2. Upsert atômico
      const { data: updatedLead, error } = await supabase
        .from('leads')
        .upsert({
          id: userId,
          nome: lead?.nome || name,
          email: email,
          status_lead: status,
          score: status === 'morno' ? 30 : (status === 'quente' ? 100 : 10),
          updated_at: new Date().toISOString()
        }, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw new Error(`Erro ao atualizar lead: ${error.message}`);
      
      console.log(`🔥 Lead (ID: ${userId}) atualizado: ${currentStatus} -> ${status}`);
      
      // Se foi criado (não existia), envia webhook
      if (!lead) await this.sendToWebhook('lead:created', updatedLead);
    } catch (error) {
      console.error('❌ Erro crítico em leadService.updateStatus:', error);
    }
  },

  async sendToWebhook(event: string, data: any) {
    try {
      const { data: settings } = await supabase
        .from('store_settings')
        .select('n8n_webhook_url')
        .maybeSingle();

      if (!settings?.n8n_webhook_url) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        await fetch(settings.n8n_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event,
            timestamp: new Date().toISOString(),
            ...data
          }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.warn('⚠️ Falha ao enviar webhook:', error);
    }
  }
};
