import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { supabase } from '../lib/supabase';
import { orderService } from './orderService';

export interface Message {
  role: 'user' | 'bot';
  content: string;
}

export const aiService = {
  async getSettings(agentType: 'vendas' | 'afiliados') {
    const [
      { data: storeSettings },
      { data: aiSettingsData }
    ] = await Promise.all([
      supabase.from('store_settings').select('ai_chat_rules, ai_chat_triggers, ai_auto_learning, ai_chat_memory').maybeSingle(),
      supabase.from('ai_settings').select('rules, memory').eq('agent_type', agentType).maybeSingle()
    ]);

    return {
      rules: aiSettingsData?.rules || storeSettings?.ai_chat_rules || '',
      memory: aiSettingsData?.memory || storeSettings?.ai_chat_memory || '',
      triggers: storeSettings?.ai_chat_triggers || '',
      autoLearning: !!storeSettings?.ai_auto_learning
    };
  },

  async processResponse(userId: string, currentMessages: Message[], isAffiliate: boolean) {
    try {
      const agentType = isAffiliate ? 'afiliados' : 'vendas';
      const aiSettings = await this.getSettings(agentType);

      // 1. Fetch API Keys
      const { data: fetchedKeys } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('service', 'gemini')
        .eq('active', true);

      const envKey = process.env.GEMINI_API_KEY;
      const allKeys = [...(fetchedKeys || [])];
      if (envKey && !allKeys.some(k => k.key_value === envKey)) {
        allKeys.push({ key_value: envKey });
      }

      if (allKeys.length === 0) {
        throw new Error('Nenhuma chave de API Gemini configurada.');
      }

      const apiKey = allKeys[0].key_value;

      // 2. Fetch Context
      const [
        { data: products },
        { data: settings },
        { data: siteContent },
        { data: knowledge }
      ] = await Promise.all([
        supabase.from('products').select('id, name, description, composition, price, discount_price, stock, quantity_info, usage_instructions, category:categories(name), tiers:product_tiers(*)').eq('active', true),
        supabase.from('store_settings').select('*').maybeSingle(),
        supabase.from('site_content').select('*'),
        supabase.from('ai_knowledge_base').select('*')
      ]);

      let context = 'Informações da Loja:\n';
      if (settings) {
        context += `Nome: ${settings.company_name}\nEndereço: ${settings.address}\nWhatsApp: ${settings.whatsapp}\nHorário: ${settings.business_hours}\n`;
      }

      context += `\nRegras do Agente (${agentType.toUpperCase()}):\n${aiSettings.rules}\n`;
      context += `\nMemória do Agente:\n${aiSettings.memory}\n`;

      if (siteContent) {
        context += 'Conteúdo do Site:\n' + siteContent.map(c => `${c.key}: ${c.value}`).join('\n') + '\n';
      }
      if (knowledge && knowledge.length > 0) {
        context += '\nConhecimento Adicional (Memória):\n' + knowledge.map(k => `${k.topic}: ${k.content}`).join('\n') + '\n';
      }

      context += '\nProdutos:\n' + (products && products.length > 0 
        ? products.map(p => {
            const currentPrice = p.discount_price || p.price;
            const productLink = `${window.location.origin}/?product=${p.id}`;
            return `Nome: [${p.name}](${productLink})\nPreço: R$ ${currentPrice}\nDescrição: ${p.description}\nUso: ${p.usage_instructions}`;
          }).join('\n\n')
        : 'Nenhum produto encontrado.');

      // 3. Call Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const maxLines = 4;

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `Você é uma consultora de vendas e suporte da G-FitLif, uma pessoa real e empática.
          
          REGRAS DE IDENTIDADE:
          1. NUNCA diga que você é uma inteligência artificial, robô ou assistente virtual.
          2. Fale como uma pessoa real (ex: "Oi, tudo bem? Sou a consultora da G-FitLif...").
          3. Use uma linguagem natural, amigável e persuasiva.
          
          ${isAffiliate ? `
          REGRAS ESPECÍFICAS PARA AFILIADOS (IA AFILIADOS):
          1. Você está falando com um afiliado parceiro da G-FitLif.
          2. Responda dúvidas sobre comissões, uso de banners, regras de divulgação e links de afiliado.
          3. Ensine o afiliado a usar o painel, pegar links e materiais de divulgação.
          4. NÃO tente vender produtos para o afiliado, foque em ajudá-lo a vender.
          ` : `
          REGRAS PARA CLIENTES (IA COMPRAS):
          1. Você está falando com um cliente interessado em comprar produtos.
          2. Foque em conversão de vendas, tirando dúvidas sobre produtos, frete e pagamentos.
          3. Responda com no máximo ${maxLines} linhas por mensagem.
          4. PADRÃO DE RESPOSTA HUMANIZADA:
             - Se o cliente perguntar sobre produtos, liste-os e explique um por um usando [SPLIT].
             - Para cada produto, informe o que é, como tomar e o valor mensal.
          `}
          
          REGRAS GERAIS:
          - RESPONDA SEMPRE EM PORTUGUÊS.
          - Use o contexto fornecido abaixo.
          - Se não souber, peça para falar com um atendente humano.
          - Use [SPLIT] para separar mensagens longas ou diferentes produtos.
          
          Contexto:\n${context}`
      });

      const history = currentMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = model.startChat({ history });
      const lastUserMessage = currentMessages[currentMessages.length - 1].content;
      const result = await chat.sendMessage(lastUserMessage);
      const responseText = result.response.text();

      return responseText || 'Desculpe, não consegui processar sua solicitação.';
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }
};
