import { GoogleGenAI, Type, FunctionDeclaration, FunctionCallingConfigMode } from "@google/genai";
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
      const ai = new GoogleGenAI(apiKey);
      const maxLines = 4;

      const saveKnowledge: FunctionDeclaration = {
        name: "save_knowledge",
        description: "Salva uma informação no banco de dados para uso futuro.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "O tópico ou nome do produto." },
            content: { type: Type.STRING, description: "A informação detalhada para salvar." }
          },
          required: ["topic", "content"]
        }
      };

      const getOrderDetails: FunctionDeclaration = {
        name: "get_order_details",
        description: "Busca detalhes de um pedido pelo número do pedido.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            orderId: { type: Type.NUMBER, description: "O número do pedido." }
          },
          required: ["orderId"]
        }
      };

      const model = (ai as any).getGenerativeModel({
        model: "gemini-1.5-flash",
        systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
          
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
          
          Contexto:\n${context}`,
        tools: aiSettings.autoLearning ? [
          { googleSearch: {} },
          { functionDeclarations: [saveKnowledge, getOrderDetails] }
        ] : [{ functionDeclarations: [getOrderDetails] }],
        toolConfig: { 
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.AUTO
          }
        }
      } as any);

      const history = currentMessages.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

      const chat = (model as any).startChat({ history });
      const lastUserMessage = currentMessages[currentMessages.length - 1].content;
      const result = await chat.sendMessage(lastUserMessage);
      
      let responseText = result.response.text();
      const functionCalls = result.response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === 'save_knowledge') {
            const { topic, content } = call.args as any;
            await supabase.from('ai_knowledge_base').upsert({ topic, content }, { onConflict: 'topic' });
          } else if (call.name === 'get_order_details') {
            const { orderId } = call.args as any;
            const order = await orderService.getOrderById(orderId);
            const followUp = await chat.sendMessage(`Dados do Pedido ${orderId}: ${JSON.stringify(order)}`);
            responseText = followUp.response.text();
          }
        }
      }

      return responseText || 'Desculpe, não consegui processar sua solicitação.';
    } catch (error) {
      console.error('AI Service Error:', error);
      throw error;
    }
  }
};
