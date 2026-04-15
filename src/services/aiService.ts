import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from '../lib/supabase';
import { orderService } from './orderService';

export interface Message {
  role: 'user' | 'bot';
  content: string;
}

export const apiTestService = {
  async testKey(key: { service: string; key_value: string; model?: string }) {
    try {
      if (key.service === 'gemini') {
        const genAI = new GoogleGenerativeAI(key.key_value);
        // Use gemini-1.5-flash-latest as it's often more reliable in some regions
        const modelName = key.model || 'gemini-1.5-flash';
        const model = genAI.getGenerativeModel({ model: modelName });
        await model.generateContent('ping');
        return { success: true };
      } else if (key.service === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${key.key_value}` }
        });
        if (!response.ok) throw new Error('Chave OpenAI inválida ou sem crédito.');
        return { success: true };
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  async runBackgroundCheck() {
    console.log('[AI-CHECK] 🔄 Iniciando verificação de APIs em segundo plano...');
    const { data: keys } = await supabase
      .from('api_keys')
      .select('*')
      .eq('active', true);

    if (!keys) return;

    for (const key of keys) {
      // Se a chave já está online, NÃO faz teste (para economizar crédito)
      if (key.status === 'online') {
        console.log(`[AI-CHECK] ✅ API ${key.name} já está online. Pulando teste.`);
        continue;
      }

      // Se não está online, testa para ver se voltou
      console.log(`[AI-CHECK] 🧪 Testando API ${key.name} (${key.status})...`);
      const result = await this.testKey(key);
      
      if (result.success) {
        console.log(`[AI-CHECK] ✨ API ${key.name} voltou a ficar ONLINE!`);
        await supabase.from('api_keys').update({ 
          status: 'online', 
          last_error_at: null 
        }).eq('id', key.id);
      } else {
        console.log(`[AI-CHECK] ❌ API ${key.name} continua com erro:`, result.error);
        await supabase.from('api_keys').update({ 
          last_error_at: new Date().toISOString() 
        }).eq('id', key.id);
      }
    }
  }
};

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

      // 1. Fetch API Keys sorted by priority
      console.log('[AI] Verificando APIs disponíveis...');
      const { data: allKeys } = await supabase
        .from('api_keys')
        .select('id, service, key_value, active, status, model, last_error_at, priority, last_used_at')
        .eq('active', true)
        .order('priority', { ascending: false });

      const stickyApiId = localStorage.getItem('sticky_api_id');
      let keys = (allKeys || []).filter(k => {
        // Se estiver com erro ou sem crédito, verifica se já passou 15 minutos para tentar de novo
        if (k.status !== 'online' && k.last_error_at) {
          const lastError = new Date(k.last_error_at).getTime();
          const now = new Date().getTime();
          const diffMinutes = (now - lastError) / (1000 * 60);
          if (diffMinutes < 15) {
            console.log(`[AI] Pulando API ${k.service.toUpperCase()} (${k.status} há ${Math.round(diffMinutes)}min)`);
            return false;
          }
        }
        return true;
      });

      // Se todas as chaves foram filtradas mas existem chaves ativas, usa as ativas (tentativa de recuperação)
      if (keys.length === 0 && allKeys && allKeys.length > 0) {
        console.log('[AI] Nenhuma chave online disponível no momento. Tentando chaves em recuperação...');
        keys = allKeys;
      }

      // Sticky logic: if we have a sticky API and it's still online, use it first
      if (stickyApiId) {
        const stickyKey = keys.find(k => k.id === stickyApiId && k.status === 'online');
        if (stickyKey) {
          keys = [stickyKey, ...keys.filter(k => k.id !== stickyApiId)];
        }
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
        supabase.from('products').select('id, name, description, composition, price, discount_price, stock, quantity_info, usage_instructions, category:categories(name, rules), tiers:product_tiers(*)').eq('active', true),
        supabase.from('store_settings').select('*').maybeSingle(),
        supabase.from('site_content').select('*'),
        supabase.from('ai_knowledge_base').select('*').eq('category', agentType) // Filter by category
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

      // Group products by category to avoid repeating category rules
      const categoryRulesMap = new Map();
      products?.forEach((p: any) => {
        if (p.category?.rules && !categoryRulesMap.has(p.category.name)) {
          categoryRulesMap.set(p.category.name, p.category.rules);
        }
      });

      if (categoryRulesMap.size > 0) {
        context += '\nRegras por Categoria:\n';
        categoryRulesMap.forEach((rules, catName) => {
          context += `${catName}: ${rules}\n`;
        });
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
          4. Se não souber algo ou precisar de ajuda, diga que um especialista irá atender, nunca diga "humano".
          
          ${wasError ? '4. IMPORTANTE: A última mensagem enviada foi um erro técnico. Peça desculpas pelo incômodo antes de responder.' : ''}

          ${isAffiliate ? `
          REGRAS ESPECÍFICAS PARA AFILIADOS (IA AFILIADOS):
          1. Você fala com parceiros da G-FitLif.
          2. Ajude com comissões, links e materiais.
          3. NÃO venda produtos para o afiliado.
          ` : `
          REGRAS PARA CLIENTES (IA COMPRAS):
          1. Você fala com clientes interessados em comprar.
          2. Foque em vendas e tirar dúvidas.
          3. REGRAS DE OURO (OBRIGATÓRIO):
             - MÁXIMO 2 LINHAS POR MENSAGEM.
             - APENAS 1 PRODUTO POR MENSAGEM.
             - Use [SPLIT] para separar produtos.
          `}
          
          REGRAS GERAIS:
          - RESPONDA SEMPRE EM PORTUGUÊS.
          - Use linguagem natural e empática.
          - Use [SPLIT] para separar mensagens longas.
          
          Contexto:\n${context}`;

      // 3. Try APIs in order
      const providers = keys.map(k => ({
        name: k.service,
        key: k.key_value,
        model: k.model,
        id: (k as any).id
      }));

      if (providers.length === 0) {
        console.error('[AI] Nenhuma chave de API ativa encontrada.');
        throw new Error('Nenhuma chave de API configurada.');
      }

      for (const provider of providers) {
        try {
          console.log(`[AI] Testando provedor: ${provider.name.toUpperCase()} (${provider.model})`);
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
              max_tokens: 150
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
            
            // Set as sticky API
            if (provider.id && provider.id !== 'env-gemini') {
              localStorage.setItem('sticky_api_id', provider.id);
            }

            // Post-processing: Enforce line limit and split logic
            let finalResponse = responseText;
            
            // Se não tiver [SPLIT] mas tiver muitas linhas, tenta forçar um split ou truncar
            const lines = finalResponse.split('\n').filter(l => l.trim());
            if (!finalResponse.includes('[SPLIT]') && lines.length > 2) {
              // Tenta quebrar em mensagens de 2 linhas
              const chunks = [];
              for (let i = 0; i < lines.length; i += 2) {
                chunks.push(lines.slice(i, i + 2).join('\n'));
              }
              finalResponse = chunks.join(' [SPLIT] ');
            }

            // Atualizar status para online e last_used_at
            if (provider.id && provider.id !== 'env-gemini') {
              await supabase.from('api_keys').update({ 
                status: 'online', 
                last_error_at: null,
                last_used_at: new Date().toISOString()
              }).eq('id', provider.id);
            }
            return finalResponse;
          }
        } catch (err: any) {
          console.error(`[AI] Falha no provedor ${provider.name.toUpperCase()}:`, err.message);
          
          // If sticky API failed, remove it
          if (provider.id === localStorage.getItem('sticky_api_id')) {
            localStorage.removeItem('sticky_api_id');
          }

          // Marcar API como error ou no_credit no banco
          if (provider.id && provider.id !== 'env-gemini') {
            const status = err.message.toLowerCase().includes('credit') || 
                          err.message.toLowerCase().includes('quota') || 
                          err.message.toLowerCase().includes('limit') ? 'no_credit' : 'error';
            
            await supabase.from('api_keys').update({ 
              status, 
              last_error_at: new Date().toISOString() 
            }).eq('id', provider.id);
          }
        }
      }

      throw new Error('Todos os provedores de IA falharam.');
    } catch (error: any) {
      console.error('[AI] Erro crítico no processamento:', error.message);
      return 'Desculpe, estou com uma instabilidade momentânea. Posso te ajudar com outra coisa ou você prefere falar com um especialista?';
    }
  }
};
