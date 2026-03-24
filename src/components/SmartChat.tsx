import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, User, Bot, Sparkles, LogIn } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { leadService } from '../services/leadService';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export default function SmartChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [aiSettings, setAiSettings] = useState({ rules: '', triggers: '', autoLearning: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadHistory = (userId: string) => {
    const saved = localStorage.getItem(`gfitlif_chat_history_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate each message has content
          const validMessages = parsed.filter(msg => msg && typeof msg.content === 'string');
          if (validMessages.length > 0) {
            setMessages(validMessages);
            return;
          }
        }
      } catch (e) {
        console.error('Error loading chat history:', e);
      }
    }
    setMessages([{ role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }]);
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.includes('Lock broken')) {
            console.warn('Auth lock broken in SmartChat, retrying...');
            return;
          }
          throw error;
        }
        setSession(session);
        if (session) loadHistory(session.user.id);
      } catch (e) {
        console.error('Error getting session in SmartChat:', e);
      } finally {
        setLoadingSession(false);
      }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadHistory(session.user.id);
      } else {
        setMessages([{ role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }]);
      }
      setLoadingSession(false);
    });

    // Fetch AI Settings
    const fetchAiSettings = async () => {
      const { data } = await supabase.from('store_settings').select('ai_chat_rules, ai_chat_triggers, ai_auto_learning').maybeSingle();
      if (data) {
        setAiSettings({
          rules: data.ai_chat_rules || '',
          triggers: data.ai_chat_triggers || 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?',
          autoLearning: !!data.ai_auto_learning
        });
      }
    };
    fetchAiSettings();

    // Subscription for real-time messages
    let channel: any = null;
    if (session?.user?.id) {
      channel = supabase
        .channel('chat_messages')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `receiver_id=eq.${session.user.id}`
        }, (payload) => {
          const newMessage = payload.new;
          if (newMessage && newMessage.message) {
            setMessages(prev => [...prev, { role: 'bot', content: newMessage.message }]);
            setShowNotification(true);
          }
        })
        .subscribe();
    }

    return () => {
      subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    // Simular notificação após 5 segundos
    const timer = setTimeout(() => {
      if (!isOpen) setShowNotification(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setShowNotification(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    if (!session) {
      toast.error('Você precisa estar logado para enviar mensagens.');
      navigate('/login');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }].slice(-40);
    setMessages(updatedMessages);
    localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(updatedMessages));
    
    // Save to DB
    try {
      supabase.from('chat_messages').insert({
        sender_id: session.user.id,
        receiver_id: session.user.id, // Use own ID as receiver for AI chat to avoid FK issues
        message: userMessage,
        is_human: true,
        is_read: false
      }).then(({ error }) => {
        if (error) console.warn('⚠️ Erro ao salvar mensagem no DB:', error);
        else console.log('✅ Mensagem do usuário salva no DB');
      });
    } catch (e) {
      console.warn('⚠️ Erro ao salvar mensagem no DB:', e);
    }
    
    // Marcar como lead morno ao interagir no chat
    leadService.updateStatus('morno');
  };

  // Effect to trigger AI response when there are new user messages
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === 'user' && !loading && session) {
      processAiResponse(messages);
    }
  }, [messages, loading, session]);

  const processAiResponse = async (currentMessages: Message[]) => {
    if (loading) return;
    setLoading(true);

    let keys: any = null;
    let context = '';
    let alternatingHistory: any[] = [];

    const maxLinesMatch = aiSettings.rules.match(/(\d+)\s*linhas/i);
    const maxLines = maxLinesMatch ? parseInt(maxLinesMatch[1]) : 4;

    try {
      // 0. Check if AI auto-reply is enabled for this lead
      const { data: leadData } = await supabase
        .from('leads')
        .select('ai_auto_reply')
        .eq('id', session.user.id)
        .maybeSingle();
      
      if (leadData && leadData.ai_auto_reply === false) {
        console.log('🤖 AI Auto-reply is disabled for this lead.');
        return;
      }

      // 1. Fetch API Key
      const { data: keysData } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('service', 'gemini')
        .eq('active', true)
        .maybeSingle();

      keys = keysData;

      if (!keys?.key_value) {
        throw new Error('Assistente indisponível no momento.');
      }

      // 2. Fetch Context for "Memory"
      const [
        { data: products, error: prodError },
        { data: settings, error: settingsError },
        { data: siteContent, error: contentError },
        { data: knowledge, error: knowledgeError }
      ] = await Promise.all([
        supabase.from('products').select('id, name, description, composition, price, discount_price, stock, quantity_info, usage_instructions, category:categories(name), tiers:product_tiers(*)').eq('active', true),
        supabase.from('store_settings').select('*').maybeSingle(),
        supabase.from('site_content').select('*'),
        supabase.from('ai_knowledge_base').select('*')
      ]);

      if (prodError) console.error('Error fetching products:', prodError);
      if (settingsError) console.error('Error fetching settings:', settingsError);
      if (contentError) console.error('Error fetching content:', contentError);
      if (knowledgeError) console.error('Error fetching knowledge:', knowledgeError);

      context = 'Informações da Loja:\n';
      if (settings) {
        context += `Nome: ${settings.company_name}\nEndereço: ${settings.address}\nWhatsApp: ${settings.whatsapp}\nHorário: ${settings.business_hours}\n`;
      }
      if (siteContent) {
        context += 'Conteúdo do Site:\n' + siteContent.map(c => `${c.key}: ${c.value}`).join('\n') + '\n';
      }
      if (knowledge && knowledge.length > 0) {
        context += '\nConhecimento Adicional (Memória):\n' + knowledge.map(k => `${k.topic}: ${k.content}`).join('\n') + '\n';
      }

      context += '\nProdutos:\n' + (products && products.length > 0 
        ? Object.entries(products.reduce((acc, p) => {
            const cat = (p.category as any)?.name || 'Sem Categoria';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
          }, {} as Record<string, any[]>)).map(([cat, prods]) => {
            return `Categoria: ${cat}\n\n` + prods.map(p => {
              const currentPrice = p.discount_price || p.price;
              const hasDiscount = p.discount_price && p.discount_price < p.price;
              const discountText = hasDiscount ? ` (EM PROMOÇÃO! De R$ ${p.price} por R$ ${p.discount_price})` : '';
              const stockText = p.stock <= 5 ? ` - APENAS ${p.stock} UNIDADES EM ESTOQUE!` : '';
              const productLink = `${window.location.origin}/?product=${p.id}`;
              const checkoutLink = `${window.location.origin}/checkout?product=${p.id}`;
              const tiersText = p.tiers && p.tiers.length > 0 
                ? `\nDescontos Progressivos: ${p.tiers.map((t: any) => `${t.quantity} unidades com ${t.discount_percentage}% de desconto`).join(', ')}`
                : '';
              
              return `Nome: [${p.name}](${productLink})\nPreço Atual: R$ ${currentPrice}${discountText}${stockText}${tiersText}\nLink Direto para Pagamento: [Comprar Agora](${checkoutLink})\nConteúdo: ${p.quantity_info || 'Não informado'}\nComo Tomar: ${p.usage_instructions || 'Não informado'}\nDescrição: ${p.description}\nComposição: ${p.composition}`;
            }).join('\n\n');
          }).join('\n\n---\n\n')
        : 'Nenhum produto encontrado no catálogo no momento.');

      // 3. Call Gemini
      const ai = new GoogleGenAI({ apiKey: keys.key_value });
      
      const saveKnowledge: FunctionDeclaration = {
        name: "save_knowledge",
        description: "Salva uma informação ou diferença entre produtos no banco de dados para uso futuro.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "O tópico ou nome do produto/comparação." },
            content: { type: Type.STRING, description: "A informação detalhada para salvar." }
          },
          required: ["topic", "content"]
        }
      };

      const rawHistory = currentMessages.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
        rawHistory.shift();
      }
      
      alternatingHistory = [];
      for (const msg of rawHistory) {
        if (alternatingHistory.length === 0) {
          if (msg.role === 'user') alternatingHistory.push(msg);
        } else {
          const lastRole = alternatingHistory[alternatingHistory.length - 1].role;
          if (msg.role !== lastRole) {
            alternatingHistory.push(msg);
          } else {
            alternatingHistory[alternatingHistory.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
          }
        }
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: alternatingHistory,
        tools: aiSettings.autoLearning ? [
          { googleSearch: {} },
          { functionDeclarations: [saveKnowledge] }
        ] : [],
        toolConfig: aiSettings.autoLearning ? { 
          includeServerSideToolInvocations: true,
          include_server_side_tool_invocations: true
        } : undefined,
        config: {
          toolConfig: aiSettings.autoLearning ? { 
            includeServerSideToolInvocations: true,
            include_server_side_tool_invocations: true
          } : undefined,
          tool_config: aiSettings.autoLearning ? { 
            include_server_side_tool_invocations: true 
          } : undefined,
          systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
          
          REGRAS OBRIGATÓRIAS DE VENDAS E ATENDIMENTO (EXECUÇÃO RÍGIDA):
          1. RESPONDA SEMPRE EM PORTUGUÊS.
          2. Responda com no máximo ${maxLines} linhas por mensagem.
          3. PADRÃO DE RESPOSTA HUMANIZADA:
             - Se o cliente perguntar sobre produtos ou opções, você DEVE seguir esta sequência usando [SPLIT]:
             - Mensagem 1: Liste TODOS os produtos relevantes de forma resumida (Nome e Preço).
             - Mensagens Seguintes: Explique UM produto de cada vez (uma mensagem para cada produto).
             - Para CADA produto explicado, você DEVE obrigatoriamente informar:
               a) O que é e para que serve.
               b) Como tomar (conforme usage_instructions).
               c) CÁLCULO DE DURAÇÃO E VALOR MENSAL ESPECÍFICO: 
                  - Leia o campo "Conteúdo" (quantity_info) e "Como Tomar" (usage_instructions).
                  - Calcule: Conteúdo / Dose Diária = Dias de duração.
                  - Exemplo MOOD SLIM: 120 cápsulas / 1 por dia = 120 dias = 4 meses.
                  - Exemplo MOOD SLIM (Dose 2/dia): 120 cápsulas / 2 por dia = 60 dias = 2 meses.
                  - NUNCA invente doses. Se o campo diz 1 por dia, use 1 por dia como base.
               d) REGRA DA INSULINA: Explique que sem resistência à insulina, a dose é menor (ex: 1 por dia) e o produto dura mais (ex: 4 meses para o MOOD SLIM). Mostre o valor mensal exato para esse cenário (Preço / 4).
               e) EXPLICAÇÃO DE EFICÁCIA: Se a pessoa tiver resistência à insulina, ela DEVE aumentar a dosagem conforme o limite máximo informado no campo "Como Tomar" (usage_instructions). Explique que esse aumento é necessário para que o produto faça efeito e traga resultados reais.
          4. NUNCA envie mais de ${maxLines} linhas em um único bloco de texto. Use [SPLIT] para separar os produtos.
          5. Use o separador [SPLIT] sempre que atingir o limite de ${maxLines} linhas ou para separar a explicação de cada produto.
          6. Finalize SEMPRE com uma pergunta para continuar a conversa.
          7. FONTES DE INFORMAÇÃO:
             - PRODUTOS DA LOJA (Catálogo): Use APENAS o contexto fornecido. É PROIBIDO inventar produtos.
             - INTERNET (Google Search): Use APENAS para detalhes técnicos de ingredientes ou benefícios científicos.
          8. APLIQUE RIGIDAMENTE as regras da memória:
             --- REGRAS DA MEMÓRIA ---
             ${aiSettings.rules || 'Siga as instruções padrão de atendimento.'}
             --- FIM DAS REGRAS ---
          
          LÓGICA DE OBJETIVOS E ESCOLHA:
          - Apresente TODOS os produtos que atendem ao objetivo do cliente.
          - Explique a diferença entre eles e deixe o cliente escolher.
          
          LÓGICA DE "COMO TOMAR" E DURAÇÃO:
          - Seja específico para cada produto. Se um pote tem 60 cápsulas e toma 1 por dia, dura 2 meses. Se toma 2, dura 1 mês.
          - Calcule o investimento mensal: "Sai por apenas R$ XX por mês no tratamento de X meses".
          
          LÓGICA DE MEMÓRIA E PESQUISA:
          ${aiSettings.autoLearning ? `
          - Use 'googleSearch' para composições não detalhadas no contexto.
          - Use 'save_knowledge' para salvar fatos relevantes.
          - Se a pergunta for fora de contexto (não relacionado a saúde/loja), diga: "Esta informação não procede do produto/marca." e force a venda de um produto do catálogo.
          ` : `
          - Use APENAS o conhecimento fornecido.
          `}
          
          Contexto dos Produtos (Conhecimento da IA):\n${context}
          
          Lembre-se do histórico recente do usuário.`,
        }
      } as any);

      // Handle Function Calls
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'save_knowledge') {
            const { topic, content } = call.args as any;
            await supabase.from('ai_knowledge_base').upsert({ topic, content }, { onConflict: 'topic' });
            console.log('🧠 IA salvou novo conhecimento:', topic);
          }
        }
      }

      const botResponse = response.text || 'Desculpe, não consegui processar sua solicitação.';

      // Split response into multiple messages if needed
      // First split by [SPLIT]
      const rawParts = botResponse.split('[SPLIT]').filter(p => p.trim());
      
      // Further split any part that has more than maxLines or is too long
      const parts: string[] = [];
      for (const part of rawParts) {
        const lines = part.split('\n').filter(l => l.trim());
        if (lines.length > maxLines) {
          // If the part is too long in terms of lines, split it into chunks of maxLines
          for (let i = 0; i < lines.length; i += maxLines) {
            const chunk = lines.slice(i, i + maxLines).join('\n').trim();
            if (chunk) parts.push(chunk);
          }
        } else if (part.length > 500) {
          // Fallback for very long single lines
          const chunks = part.match(/.{1,500}(\s|$)/g) || [part];
          chunks.forEach(c => parts.push(c.trim()));
        } else {
          parts.push(part.trim());
        }
      }
      
      let latestMessages = currentMessages;
      for (const part of parts) {
        const botPart = part.trim();
        latestMessages = [...latestMessages, { role: 'bot' as const, content: botPart }];
        setMessages(latestMessages);
        localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(latestMessages));
        
        // Salvar resposta da IA no banco
        try {
          supabase.from('chat_messages').insert({
            sender_id: null, // AI sender
            receiver_id: session.user.id,
            message: botPart,
            is_human: false,
            is_read: true
          }).then(({ error }) => {
            if (error) console.warn('⚠️ Erro ao salvar resposta da IA no DB:', error);
            else console.log('✅ Resposta da IA salva no DB');
          });
        } catch (e) {
          console.warn('⚠️ Erro ao salvar resposta da IA no DB:', e);
        }
        
        // Small delay between messages for more natural feel
        if (parts.indexOf(part) < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error: any) {
      console.error('Chat Error:', error);
      
      // Fallback if tool hybrid mode fails
      if (error.message?.includes('include_server_side_tool_invocations') || error.message?.includes('INVALID_ARGUMENT') || error.message?.includes('tool_config')) {
        try {
          const ai = new GoogleGenAI({ apiKey: keys.key_value });
          const retryResponse = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            config: {
              systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
              (RETRY MODE - SEM FERRAMENTAS)
              Responda com base APENAS no contexto fornecido abaixo.
              
              REGRAS DE LINHAS:
              Responda com no máximo ${maxLines} linhas por mensagem.
              
              Contexto:\n${context}`,
            },
            contents: alternatingHistory
          });
          
          const botResponse = retryResponse.text || 'Desculpe, tive um problema ao processar sua pergunta.';
          const finalMessages = [...currentMessages, { role: 'bot' as const, content: botResponse }].slice(-40);
          setMessages(finalMessages);
          localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(finalMessages));
          
          // Salvar resposta da IA no banco (Retry Mode)
          supabase.from('chat_messages').insert({
            sender_id: null,
            receiver_id: session.user.id,
            message: botResponse,
            is_human: false,
            is_read: true
          }).then(({ error }) => {
            if (error) console.warn('⚠️ Erro ao salvar resposta da IA (Retry) no DB:', error);
          });

          return;
        } catch (retryError) {
          console.error('Retry Error:', retryError);
        }
      }

      const errorMessages = [...currentMessages, { role: 'bot' as const, content: 'Ops! Tive um problema técnico. Pode tentar novamente?' }].slice(-40);
      setMessages(errorMessages);
      localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(errorMessages));
    } finally {
      setLoading(false);
    }
  };

  const isInternalLink = (url: string) => {
    try {
      if (!url) return false;
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (e) {
      return url.startsWith('/') || url.startsWith('?');
    }
  };

  const handleInternalLink = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const path = parsed.pathname + parsed.search;
      navigate(path);
    } catch (e) {
      navigate(url);
    }
  };

  return (
    <div className="fixed bottom-36 right-6 md:bottom-12 md:right-12 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-[350px] md:w-[400px] h-[500px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Bot size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">G-FitLif AI</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] opacity-80">Online agora</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.slice(-20).map((msg, idx) => (
                <div key={`${idx}-${msg.role}-${msg.content.substring(0, 10)}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown 
                        components={{
                          a: ({node, ...props}) => {
                            const isInternal = isInternalLink(props.href || '');
                            if (isInternal) {
                              return (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleInternalLink(props.href || '');
                                  }}
                                  className="text-emerald-700 underline font-bold hover:text-emerald-800 transition-colors inline-block"
                                >
                                  {props.children}
                                </button>
                              );
                            }
                            return <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold" />;
                          }
                        }}
                      >
                        {msg.content || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              {loadingSession ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-400 rounded-xl text-xs">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                  Verificando conexão...
                </div>
              ) : !session ? (
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  <LogIn size={18} />
                  Entre para conversar
                </button>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Tire suas dúvidas..."
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles size={10} /> Powered by G-FitLif Intelligence
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group relative"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && (
          <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">
            IA ON
          </span>
        )}
        {showNotification && !isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-20 bottom-2 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 w-48 text-left"
          >
            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Novidade!</p>
            <p className="text-xs text-slate-600 font-medium leading-tight">{aiSettings.triggers || 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?'}</p>
            <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-r border-b border-slate-100 rotate-[-45deg]"></div>
          </motion.div>
        )}
      </button>
    </div>
  );
}
