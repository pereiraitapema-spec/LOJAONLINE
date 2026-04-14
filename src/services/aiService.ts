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
        .select('service, key_value, active')
        .eq('active', true);

      const envGeminiKey = process.env.GEMINI_API_KEY;
      const keys = allKeys || [];
      
      if (envGeminiKey && !keys.some(k => k.service === 'gemini' && k.key_value === envGeminiKey)) {
        keys.push({ service: 'gemini', key_value: envGeminiKey, active: true });
      }

      console.log(`[AI] Chaves encontradas: ${keys.map(k => k.service).join(', ')}`);

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

      const systemInstruction = `Você é uma consultora de vendas e suporte da G-FitLif, uma pessoa real e empática.
          
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
          3. Responda com no máximo 4 linhas por mensagem.
          4. PADRÃO DE RESPOSTA HUMANIZADA:
             - Se o cliente perguntar sobre produtos, liste-os e explique um por um usando [SPLIT].
             - Para cada produto, informe o que é, como tomar e o valor mensal.
          `}
          
          REGRAS GERAIS:
          - RESPONDA SEMPRE EM PORTUGUÊS.
          - Use o contexto fornecido abaixo.
          - Se não souber, peça para falar com um atendente humano.
          - Use [SPLIT] para separar mensagens longas ou diferentes produtos.
          
          Contexto:\n${context}`;

      // 3. Try APIs in order: Gemini -> OpenAI -> Claude
      const providers = [
        { name: 'gemini', key: keys.find(k => k.service === 'gemini')?.key_value },
        { name: 'openai', key: keys.find(k => k.service === 'openai')?.key_value },
        { name: 'claude', key: keys.find(k => k.service === 'claude')?.key_value }
      ].filter(p => !!p.key);

      if (providers.length === 0) {
        console.error('[AI] Nenhuma chave de API ativa encontrada.');
        throw new Error('Nenhuma chave de API configurada.');
      }

      for (const provider of providers) {
        try {
          console.log(`[AI] Testando provedor: ${provider.name.toUpperCase()}`);
          let responseText = '';

          if (provider.name === 'gemini') {
            // Tentar gemini-1.5-flash, se falhar tentar gemini-1.5-flash-latest
            const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest"];
            let lastGeminiError = null;

            for (const modelName of modelsToTry) {
              try {
                console.log(`[AI] Tentando modelo Gemini: ${modelName}`);
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
                
                if (responseText) {
                  // Se funcionou, garante que o status está online
                  await supabase.from('api_keys').update({ status: 'online' }).eq('service', 'gemini').eq('key_value', provider.key);
                  break; 
                }
              } catch (geminiErr: any) {
                console.warn(`[AI] Falha no modelo ${modelName}:`, geminiErr.message);
                lastGeminiError = geminiErr;
              }
            }
            
            if (!responseText && lastGeminiError) throw lastGeminiError;
          } 
          else if (provider.name === 'openai') {
            const openai = new OpenAI({ apiKey: provider.key, dangerouslyAllowBrowser: true });
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemInstruction },
                ...currentMessages.map(m => ({
                  role: (m.role === 'bot' ? 'assistant' : 'user') as 'assistant' | 'user',
                  content: m.content
                }))
              ]
            });
            responseText = completion.choices[0].message.content || '';
            if (responseText) {
              await supabase.from('api_keys').update({ status: 'online' }).eq('service', 'openai').eq('key_value', provider.key);
            }
          }
          else if (provider.name === 'claude') {
            const anthropic = new Anthropic({ apiKey: provider.key, dangerouslyAllowBrowser: true });
            const message = await anthropic.messages.create({
              model: "claude-3-5-sonnet-20240620",
              max_tokens: 1024,
              system: systemInstruction,
              messages: currentMessages.map(m => ({
                role: m.role === 'bot' ? 'assistant' : 'user' as const,
                content: m.content
              }))
            });
            responseText = (message.content[0] as any).text || '';
            if (responseText) {
              await supabase.from('api_keys').update({ status: 'online' }).eq('service', 'claude').eq('key_value', provider.key);
            }
          }

          if (responseText) {
            console.log(`[AI] Resposta gerada com sucesso via ${provider.name.toUpperCase()}`);
            return responseText;
          }
        } catch (err: any) {
          console.error(`[AI] Falha no provedor ${provider.name.toUpperCase()}:`, err.message);
          // Marcar API como offline no banco
          await supabase.from('api_keys')
            .update({ status: 'offline' })
            .eq('service', provider.name)
            .eq('key_value', provider.key);
          
          // Continue to next provider
        }
      }

      throw new Error('Todos os provedores de IA falharam.');
    } catch (error: any) {
      console.error('[AI] Erro crítico no processamento:', error.message);
      return 'Desculpe, estou com uma instabilidade momentânea. Posso te ajudar com outra coisa ou você prefere falar com um atendente humano?';
    }
  }
};
