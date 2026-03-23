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
  const [aiSettings, setAiSettings] = useState({ rules: '', triggers: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const loadHistory = (userId: string) => {
    const saved = localStorage.getItem(`gfitlif_chat_history_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) {}
    }
    setMessages([{ role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }]);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadHistory(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadHistory(session.user.id);
      } else {
        setMessages([{ role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }]);
      }
    });

    // Fetch AI Settings
    const fetchAiSettings = async () => {
      const { data } = await supabase.from('store_settings').select('ai_chat_rules, ai_chat_triggers').maybeSingle();
      if (data) {
        setAiSettings({
          rules: data.ai_chat_rules || '',
          triggers: data.ai_chat_triggers || 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?'
        });
      }
    };
    fetchAiSettings();

    // Subscription for real-time messages
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `receiver_id=eq.${session?.user?.id}`
      }, (payload) => {
        const newMessage = payload.new;
        setMessages(prev => [...prev, { role: 'bot', content: newMessage.message }]);
        setShowNotification(true);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(channel);
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
    if (!input.trim() || loading) return;

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
    await supabase.from('chat_messages').insert({
      sender_id: session.user.id,
      receiver_id: '00000000-0000-0000-0000-000000000000', // Placeholder
      message: userMessage
    });
    
    setLoading(true);

    // Marcar como lead morno ao interagir no chat
    leadService.updateStatus('morno');

    try {
      // 1. Fetch API Key
      const { data: keys } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('service', 'gemini')
        .eq('active', true)
        .maybeSingle();

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
        supabase.from('products').select('id, name, description, composition, price, discount_price, stock, quantity_info, usage_instructions, category:categories(name)').eq('active', true),
        supabase.from('store_settings').select('*').maybeSingle(),
        supabase.from('site_content').select('*'),
        supabase.from('ai_knowledge_base').select('*')
      ]);

      if (prodError) console.error('Error fetching products:', prodError);
      if (settingsError) console.error('Error fetching settings:', settingsError);
      if (contentError) console.error('Error fetching content:', contentError);
      if (knowledgeError) console.error('Error fetching knowledge:', knowledgeError);

      let context = 'Informações da Loja:\n';
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
              
              return `Nome: [${p.name}](${productLink})\nPreço Atual: R$ ${currentPrice}${discountText}${stockText}\nConteúdo: ${p.quantity_info || 'Não informado'}\nComo Tomar: ${p.usage_instructions || 'Não informado'}\nDescrição: ${p.description}\nComposição: ${p.composition}`;
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

      const rawHistory = updatedMessages.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
        rawHistory.shift();
      }
      
      const alternatingHistory: any[] = [];
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
        config: {
          systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
          
          REGRAS OBRIGATÓRIAS DE VENDAS E ATENDIMENTO:
          1. Responda com no máximo 4 linhas, a menos que precise listar produtos.
          2. Finalize SEMPRE com uma pergunta para continuar a conversa.
          3. Use APENAS informações dos produtos fornecidos no contexto. É PROIBIDO inventar nomes, preços, descrições, composições ou links.
          4. Ao recomendar, mencione o nome exato do produto e o link de compra fornecido.
          5. Aplique os gatilhos e regras de vendas configurados: ${aiSettings.rules || 'Siga as instruções padrão de atendimento.'}
          
          LÓGICA DE EMAGRECIMENTO:
          - Se o cliente perguntar "quero emagrecer" ou sobre "emagrecimento", você DEVE listar TODAS as opções de produtos para emagrecer disponíveis no contexto, mostrando o NOME e o VALOR (Preço Atual) de cada um lado a lado.
          
          LÓGICA DE "COMO TOMAR" E DURAÇÃO:
          - Informe SEMPRE como tomar o produto conforme o campo "Como Tomar".
          - Calcule a duração do produto (quantos meses dura) baseando-se no "Conteúdo" (ex: 60 cápsulas) e "Como Tomar" (ex: 2 cápsulas ao dia). Ex: 60/2 = 30 dias = 1 mês.
          - Se o cliente achar CARO, faça as contas para ele: "Este produto dura [X] meses, então o seu investimento mensal é de apenas R$ [Preço/X]". Mostre que o custo-benefício é alto.
          
          LÓGICA DE MEMÓRIA E PESQUISA:
          - Se o usuário perguntar a diferença entre produtos e você não tiver a resposta completa no contexto, use a ferramenta 'googleSearch' para pesquisar.
          - Após pesquisar ou chegar a uma conclusão importante sobre diferenças, use a ferramenta 'save_knowledge' para salvar essa informação. Na próxima vez, ela estará no seu contexto de "Memória".
          
          Contexto dos Produtos (Conhecimento da IA):\n${context}
          
          Lembre-se do histórico recente do usuário.`,
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [saveKnowledge] }
          ],
          toolConfig: { includeServerSideToolInvocations: true }
        },
        contents: alternatingHistory
      });

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

      const finalMessages = [...updatedMessages, { role: 'bot' as const, content: botResponse }].slice(-40);
      setMessages(finalMessages);
      localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(finalMessages));
    } catch (error: any) {
      console.error('Chat Error:', error);
      const errorMessages = [...updatedMessages, { role: 'bot' as const, content: 'Ops! Tive um problema técnico. Pode tentar novamente?' }].slice(-40);
      setMessages(errorMessages);
      localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(errorMessages));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
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
              {messages.slice(-10).map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}>
                    <ReactMarkdown 
                      components={{
                        a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold" />
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
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
              {!session ? (
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
                    disabled={!input.trim() || loading}
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
