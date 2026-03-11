import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, User, Bot, Sparkles, LogIn } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
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

    return () => subscription.unsubscribe();
  }, []);

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
    
    const updatedMessages = [...messages, { role: 'user', content: userMessage }].slice(-40);
    setMessages(updatedMessages);
    localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(updatedMessages));
    
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

      // 2. Fetch Product Context for "Memory"
      const { data: products } = await supabase
        .from('products')
        .select('id, name, description, composition, price, discount_price, stock_quantity')
        .eq('active', true);

      const context = products?.map(p => {
        const currentPrice = p.discount_price || p.price;
        const hasDiscount = p.discount_price && p.discount_price < p.price;
        const discountText = hasDiscount ? ` (EM PROMOÇÃO! De R$ ${p.price} por R$ ${p.discount_price})` : '';
        const stockText = p.stock_quantity <= 5 ? ` - APENAS ${p.stock_quantity} UNIDADES EM ESTOQUE!` : '';
        const productLink = `${window.location.origin}/?product=${p.id}`;
        
        return `Produto ID: ${p.id}\nNome: ${p.name}\nPreço Atual: R$ ${currentPrice}${discountText}${stockText}\nDescrição: ${p.description}\nComposição: ${p.composition}\nLink para compra: ${productLink}`;
      }).join('\n\n') || '';

      // 3. Call Gemini
      const ai = new GoogleGenAI({ apiKey: keys.key_value });
      
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
          systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif, especialista em vendas e saúde.
          Seu objetivo é converter curiosos em clientes e clientes em fãs.
          
          REGRAS DE OURO E GATILHOS (Configurados pelo Admin):
          ${aiSettings.rules || 'Seja prestativo, use gatilhos mentais de escassez e urgência, e sempre tente converter a venda.'}
          
          REGRAS DE RESPOSTA OBRIGATÓRIAS:
          1. Responda com no máximo 4 linhas.
          2. Finalize SEMPRE sua resposta com uma pergunta para continuar a conversa.
          3. Use APENAS as informações dos produtos fornecidas abaixo.
          4. Ao mencionar um produto, cite o NOME EXATO do produto, descreva brevemente sua função baseada na descrição e composição fornecidas, e forneça o LINK PARA COMPRA.
          5. NÃO invente nomes de produtos, preços ou benefícios. Se o produto não estiver na lista, diga que não temos esse produto ou ofereça uma alternativa similar da lista.
          
          Contexto dos Produtos (Conhecimento da IA):\n${context}
          
          Lembre-se do histórico recente do usuário para entender o que ele gosta e o que ele quer.`
        },
        contents: alternatingHistory
      });

      const botResponse = response.text || 'Desculpe, não consegui processar sua solicitação.';

      const finalMessages = [...updatedMessages, { role: 'bot', content: botResponse }].slice(-40);
      setMessages(finalMessages);
      localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(finalMessages));
    } catch (error: any) {
      console.error('Chat Error:', error);
      const errorMessages = [...updatedMessages, { role: 'bot', content: 'Ops! Tive um problema técnico. Pode tentar novamente?' }].slice(-40);
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
                    {msg.content}
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
