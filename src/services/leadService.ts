import { supabase } from '../lib/supabase';
import { automationService } from './automationService';

export type LeadStatus = 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';

export const leadService = {
  async updateStatus(status: LeadStatus, purchaseData?: { product: string, value: number }) {
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
        .select('status_lead, nome, valor_total_gasto')
        .eq('id', userId)
        .maybeSingle();

      const statusOrder: Record<LeadStatus, number> = {
        'inativo': 0, 'frio': 1, 'morno': 2, 'quente': 3, 'cliente': 4
      };

      const currentStatus = (lead?.status_lead || 'frio') as LeadStatus;
      
      // Se status novo não for superior AND não houver dados de compra, não faz nada
      if (statusOrder[status] <= statusOrder[currentStatus] && !purchaseData) return;

      // 3. Get affiliate_id from localStorage if exists
      const affiliateId = localStorage.getItem('affiliate_code');

      // 2. Upsert atômico
      const payload: any = {
        id: userId,
        nome: lead?.nome || name,
        email: email,
        status_lead: status,
        affiliate_id: affiliateId,
        score: status === 'morno' ? 30 : (status === 'quente' ? 100 : (status === 'cliente' ? 150 : 10)),
        updated_at: new Date().toISOString()
      };

      if (purchaseData) {
        payload.ultimo_produto_comprado = purchaseData.product;
        payload.valor_total_gasto = (lead?.valor_total_gasto || 0) + purchaseData.value;
        payload.ultima_compra_data = new Date().toISOString();
      }

      const { data: updatedLead, error } = await supabase
        .from('leads')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

      if (error) throw new Error(`Erro ao atualizar lead: ${error.message}`);
      
      console.log(`🔥 Lead (ID: ${userId}) atualizado: ${currentStatus} -> ${status}`);
      
      // Se foi criado (não existia), envia webhook
      if (!lead) {
        await this.sendToWebhook('lead:created', updatedLead);
        await automationService.trigger('new_lead', updatedLead);
      }
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
