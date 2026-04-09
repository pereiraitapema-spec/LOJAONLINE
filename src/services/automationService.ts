import { supabase } from '../lib/supabase';

export type AutomationTrigger = 'new_lead' | 'abandoned_cart' | 'new_order' | 'order_paid' | 'order_shipped' | 'status_change';
export type AutomationAction = 'chat_notification' | 'email' | 'webhook' | 'whatsapp_notification' | 'whatsapp';

export interface Automation {
  id: string;
  name: string;
  trigger_type: AutomationTrigger;
  action_type: AutomationAction;
  config: any;
  active: boolean;
}

export const automationService = {
  async trigger(trigger: AutomationTrigger, data: any) {
    try {
      console.log(`🤖 Triggering automation for: ${trigger}`, data);
      
      // 1. Fetch store settings for global webhook
      const { data: settings } = await supabase
        .from('store_settings')
        .select('n8n_webhook_url')
        .maybeSingle();

      // 2. If global webhook exists, send to it
      if (settings?.n8n_webhook_url) {
        await this.sendGlobalWebhook(settings.n8n_webhook_url, trigger, data);
      }

      // 3. Fetch active automations for this trigger
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', trigger)
        .eq('active', true);

      if (error) throw error;
      if (!automations || automations.length === 0) {
        console.log(`ℹ️ No active specific automations for trigger: ${trigger}`);
        return;
      }

      for (const auto of automations) {
        await this.executeAction(auto, data);
      }
    } catch (error) {
      console.error('❌ Error in automationService.trigger:', error);
    }
  },

  async sendGlobalWebhook(url: string, trigger: string, data: any) {
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: trigger,
          timestamp: new Date().toISOString(),
          ...data
        })
      });
      console.log(`✅ Global Webhook sent to ${url}`);
    } catch (e) {
      console.warn(`⚠️ Failed to send global webhook to ${url}:`, e);
    }
  },

  async executeAction(automation: Automation, data: any) {
    try {
      console.log(`🚀 Executing action: ${automation.action_type} for automation: ${automation.name}`);
      
      switch (automation.action_type) {
        case 'chat_notification':
          await this.sendChatNotification(automation, data);
          break;
        case 'webhook':
          await this.sendWebhook(automation, data);
          break;
        case 'email':
          // Email logic would go here
          console.log('📧 Email automation not fully implemented yet');
          break;
        case 'whatsapp_notification':
        case 'whatsapp':
          // WhatsApp logic would go here
          console.log('📱 WhatsApp automation not fully implemented yet');
          break;
        default:
          console.warn(`⚠️ Unknown action type: ${automation.action_type}`);
      }
    } catch (error) {
      console.error(`❌ Error executing action ${automation.action_type}:`, error);
    }
  },

  async sendChatNotification(automation: Automation, data: any) {
    const userId = data.user_id || data.id;
    if (!userId) return;

    let message = automation.config.message || 'Olá! Como podemos ajudar?';
    
    // Simple variable replacement
    message = message.replace('{name}', data.nome || data.name || 'Cliente');
    message = message.replace('{order_id}', data.order_id || data.id || '');

    await supabase.from('chat_messages').insert({
      sender_id: null, // AI/System
      receiver_id: userId,
      message: message,
      is_human: false,
      is_read: false
    });
    
    console.log(`✅ Chat notification sent to user ${userId}`);
  },

  async sendWebhook(automation: Automation, data: any) {
    const url = automation.config.webhook_url;
    if (!url) return;

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          automation_name: automation.name,
          trigger: automation.trigger_type,
          timestamp: new Date().toISOString(),
          data
        })
      });
      console.log(`✅ Webhook sent to ${url}`);
    } catch (e) {
      console.warn(`⚠️ Failed to send webhook to ${url}:`, e);
    }
  }
};
