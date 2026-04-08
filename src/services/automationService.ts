import { supabase } from '../lib/supabase';

export type AutomationTrigger = 'new_lead' | 'abandoned_cart' | 'new_order' | 'order_paid' | 'order_shipped';
export type AutomationAction = 'chat_notification' | 'email' | 'webhook' | 'whatsapp_notification';

export interface Automation {
  id: string;
  name: string;
  trigger: AutomationTrigger;
  action: AutomationAction;
  config: any;
  active: boolean;
}

export const automationService = {
  async trigger(trigger: AutomationTrigger, data: any) {
    try {
      console.log(`🤖 Triggering automation for: ${trigger}`, data);
      
      // 1. Fetch active automations for this trigger
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger', trigger)
        .eq('active', true);

      if (error) throw error;
      if (!automations || automations.length === 0) {
        console.log(`ℹ️ No active automations for trigger: ${trigger}`);
        return;
      }

      for (const auto of automations) {
        await this.executeAction(auto, data);
      }
    } catch (error) {
      console.error('❌ Error in automationService.trigger:', error);
    }
  },

  async executeAction(automation: Automation, data: any) {
    try {
      console.log(`🚀 Executing action: ${automation.action} for automation: ${automation.name}`);
      
      switch (automation.action) {
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
          // WhatsApp logic would go here
          console.log('📱 WhatsApp automation not fully implemented yet');
          break;
        default:
          console.warn(`⚠️ Unknown action type: ${automation.action}`);
      }
    } catch (error) {
      console.error(`❌ Error executing action ${automation.action}:`, error);
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
          trigger: automation.trigger,
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
