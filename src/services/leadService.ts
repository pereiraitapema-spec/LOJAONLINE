import { supabase } from '../lib/supabase';
import { automationService } from './automationService';

export type LeadStatus = 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';

export const leadService = {
  async updateStatus(status: LeadStatus, purchaseData?: { product: string, value: number, email?: string, name?: string }) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      let userId = session?.user?.id;
      let email = purchaseData?.email || session?.user?.email;
      let name = purchaseData?.name || session?.user?.user_metadata?.full_name || email?.split('@')[0];

      if (email === 'pereira.itapema@gmail.com') return;
      if (!email && !userId) return;

      // 1. Busca lead existente por ID ou E-mail
      let lead = null;
      if (userId) {
        const { data } = await supabase.from('leads').select('*').eq('id', userId).maybeSingle();
        lead = data;
      }
      
      if (!lead && email) {
        const { data } = await supabase.from('leads').select('*').eq('email', email).maybeSingle();
        lead = data;
      }

      const statusOrder: Record<LeadStatus, number> = {
        'inativo': 0, 'frio': 1, 'morno': 2, 'quente': 3, 'cliente': 4
      };

      const currentStatus = (lead?.status_lead || 'frio') as LeadStatus;
      
      // Se status novo não for superior AND não houver dados de compra, não faz nada
      // Exceto se estivermos forçando um status (como 'cliente' após pagamento)
      if (statusOrder[status] <= statusOrder[currentStatus] && !purchaseData) return;

      // 3. Get affiliate_id from localStorage if exists
      const affiliateId = localStorage.getItem('affiliate_code') || lead?.affiliate_id;

      // 2. Upsert atômico
      const payload: any = {
        nome: lead?.nome || name,
        email: email,
        status_lead: status,
        affiliate_id: affiliateId,
        score: status === 'morno' ? 30 : (status === 'quente' ? 100 : (status === 'cliente' ? 150 : 10)),
        updated_at: new Date().toISOString()
      };

      // Se temos o ID do usuário, usamos como PK
      if (userId) {
        payload.id = userId;
      } else if (lead?.id) {
        payload.id = lead.id;
      }

      if (purchaseData) {
        payload.ultimo_produto_comprado = purchaseData.product;
        payload.valor_total_gasto = (lead?.valor_total_gasto || 0) + purchaseData.value;
        payload.ultima_compra_data = new Date().toISOString();
      }

      const { data: updatedLead, error } = await supabase
        .from('leads')
        .upsert(payload, { onConflict: userId ? 'id' : 'email' })
        .select()
        .single();

      if (error) throw new Error(`Erro ao atualizar lead: ${error.message}`);
      
      console.log(`🔥 Lead (${email}) atualizado: ${currentStatus} -> ${status}`);
      
      // Se foi criado (não existia), dispara automação
      if (!lead) {
        await automationService.trigger('new_lead', updatedLead);
      }
    } catch (error) {
      console.error('❌ Erro crítico em leadService.updateStatus:', error);
    }
  }
};
