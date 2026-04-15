import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
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
    console.log('[AI] 🚀 Iniciando processamento de resposta...');
    const agentType = isAffiliate ? 'afiliados' : 'vendas';
    console.log(`[AI] Origem identificada: ${agentType}`);

    try {
      const aiSettings = await this.getSettings(agentType);
      console.log('[AI] Configurações carregadas');

      // 1. Fetch API Keys
      console.log('[AI] Verificando APIs disponíveis...');
      const { data: allKeys } = await supabase
        .from('api_keys')
        .select('service, key_value, active, status, model, last_error_at')
        .eq('active', true);

      const envGeminiKey = process.env.GEMINI_API_KEY;
      const keys = (allKeys || []).filter(k => {
        // Se estiver offline, verifica se já passou 5 minutos para tentar de novo
        if (k.status === 'offline' && k.last_error_at) {
          const lastError = new Date(k.last_error_at).getTime();
          const now = new Date().getTime();
          const diffMinutes = (now - lastError) / (1000 * 60);
          if (diffMinutes < 5) {
            console.log(`[AI] Pulando API ${k.service.toUpperCase()} (Offline há ${Math.round(diffMinutes)}min)`);
            return false;
          }
        }
        return true;
      });
      
      if (envGeminiKey && !keys.some(k => k.service === 'gemini' && k.key_value === envGeminiKey)) {
        keys.push({ service: 'gemini', key_value: envGeminiKey, active: true, status: 'online', model: 'gemini-1.5-flash', last_error_at: null });
      }

      console.log(`[AI] Chaves prontas para uso: ${keys.map(k => k.service).join(', ')}`);

      // 2. Fetch Context
      console.log('[AI] Carregando contexto (produtos, regras, memória)...');
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

      // Check if last message was an error to apologize
      const lastBotMessage = [...currentMessages].reverse().find(m => m.role === 'bot');
      const wasError = lastBotMessage?.content.includes('problema técnico');

      const systemInstruction = `Você é uma consultora de vendas e suporte da G-FitLif, uma pessoa real e empática.
          
          REGRAS DE IDENTIDADE:
          1. NUNCA diga que você é uma inteligência artificial, robô ou assistente virtual.
          2. Fale como uma pessoa real (ex: "Oi, tudo bem? Sou a consultora da G-FitLif...").
          3. Use uma linguagem natural, amigável e persuasiva.
          
          ${wasError ? '4. IMPORTANTE: A última mensagem enviada foi um erro técnico. Peça desculpas pelo incômodo antes de responder.' : ''}

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
          3. PADRÃO DE RESPOSTA (OBRIGATÓRIO):
             - Máximo 2 linhas por mensagem.
             - 1 produto por mensagem (use [SPLIT] para separar).
             - Seja direto e humano.
          `}
          
          REGRAS GERAIS:
          - RESPONDA SEMPRE EM PORTUGUÊS.
          - Use o contexto fornecido abaixo.
          - Se não souber, peça para falar com um atendente humano.
          - Use [SPLIT] para separar mensagens longas ou diferentes produtos.
          
          Contexto:\n${context}`;

      // 3. Try APIs in order
      const providers = keys.map(k => ({
        name: k.service,
        key: k.key_value,
        model: k.model
      }));

      if (providers.length === 0) {
        console.error('[AI] Nenhuma chave de API ativa encontrada.');
        throw new Error('Nenhuma chave de API configurada.');
      }

      for (const provider of providers) {
        try {
          console.log(`[AI] Testando provedor: ${provider.name.toUpperCase()}`);
          let responseText = '';

          if (provider.name === 'gemini') {
            const modelName = provider.model || "gemini-1.5-flash";
            const genAI = new GoogleGenerativeAI(provider.key!);
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: systemInstruction
            });

            const history = currentMessages.slice(0, -1).map(msg => ({
              role: msg.role === 'bot' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            }));

            const chat = model.startChat({ history });
            const lastUserMessage = currentMessages[currentMessages.length - 1].content;
            const result = await chat.sendMessage(lastUserMessage);
            responseText = result.response.text();
          } 
          else if (['openai', 'groq', 'deepseek', 'mistral', 'together'].includes(provider.name)) {
            let baseURL = undefined;
            let defaultModel = "gpt-4o-mini";

            if (provider.name === 'groq') {
              baseURL = "https://api.groq.com/openai/v1";
              defaultModel = "llama3-8b-8192";
            } else if (provider.name === 'deepseek') {
              baseURL = "https://api.deepseek.com";
              defaultModel = "deepseek-chat";
            } else if (provider.name === 'mistral') {
              baseURL = "https://api.mistral.ai/v1";
              defaultModel = "mistral-tiny";
            } else if (provider.name === 'together') {
              baseURL = "https://api.together.xyz/v1";
              defaultModel = "mistralai/Mixtral-8x7B-Instruct-v0.1";
            }

            const openai = new OpenAI({ 
              apiKey: provider.key, 
              baseURL,
              dangerouslyAllowBrowser: true 
            });

            const completion = await openai.chat.completions.create({
              model: provider.model || defaultModel,
              messages: [
                { role: "system", content: systemInstruction },
                ...currentMessages.map(m => ({
                  role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
                  content: m.content
                }))
              ],
              max_tokens: 150 // Limitar tamanho da resposta
            });
            responseText = completion.choices[0].message.content || '';
          }
          else if (provider.name === 'claude') {
            const anthropic = new Anthropic({ apiKey: provider.key, dangerouslyAllowBrowser: true });
            const message = await anthropic.messages.create({
              model: provider.model || "claude-3-5-sonnet-20240620",
              max_tokens: 150,
              system: systemInstruction,
              messages: currentMessages.map(m => ({
                role: m.role === 'bot' ? 'assistant' : 'user' as const,
                content: m.content
              }))
            });
            responseText = (message.content[0] as any).text || '';
          }

          if (responseText) {
            console.log(`[AI] Resposta gerada com sucesso via ${provider.name.toUpperCase()}`);
            // Atualizar status para online
            await supabase.from('api_keys').update({ status: 'online', last_error_at: null }).eq('service', provider.name).eq('key_value', provider.key);
            return responseText;
          }
        } catch (err: any) {
          console.error(`[AI] Falha no provedor ${provider.name.toUpperCase()}:`, err.message);
          // Marcar API como offline no banco
          await supabase.from('api_keys')
            .update({ status: 'offline', last_error_at: new Date().toISOString() })
            .eq('service', provider.name)
            .eq('key_value', provider.key);
        }
      }

      throw new Error('Todos os provedores de IA falharam.');
    } catch (error: any) {
      console.error('[AI] Erro crítico no processamento:', error.message);
      return 'Desculpe, estou com uma instabilidade momentânea. Posso te ajudar com outra coisa ou você prefere falar com um atendente humano?';
    }
  }
};
