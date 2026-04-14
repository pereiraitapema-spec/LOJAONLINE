import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, User, Bot, Sparkles, LogIn } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { aiService, Message as AiMessage } from '../services/aiService';
import { leadService } from '../services/leadService';
import { chatService } from '../services/chatService';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface SmartChatProps {
  source?: 'vendas' | 'afiliados';
}

export default function SmartChat({ source = 'vendas' }: SmartChatProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Olá! Sou a consultora da G-FitLif. Como posso te ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [aiSettings, setAiSettings] = useState({ rules: '', memory: '', triggers: '', autoLearning: false });
  const [agentPhoto, setAgentPhoto] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchAgentData = async () => {
      if (!session) return;
      
      const { data: affiliateData } = await supabase.from('affiliates').select('id, code, commission_rate').eq('user_id', session.user.id).maybeSingle();
      const agentType = affiliateData ? 'afiliados' : 'vendas';
      
      const settings = await aiService.getSettings(agentType);
      setAiSettings(settings);

      // Fetch agent photo (from admin profile)
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('email', 'pereira.itapema@gmail.com')
        .maybeSingle();
      
      if (adminProfile?.avatar_url) {
        setAgentPhoto(adminProfile.avatar_url);
      } else {
        // Default human photo if admin hasn't set one
        setAgentPhoto("https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100&h=100");
      }

      // Fetch user photo
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      
      const googleAvatar = session.user.user_metadata.avatar_url || session.user.user_metadata.picture;
      setUserPhoto(userProfile?.avatar_url || googleAvatar || null);
    };
    fetchAgentData();
  }, [session]);

  const loadHistory = async (userId: string) => {
    const saved = localStorage.getItem(`gfitlif_chat_history_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        console.error('Error loading chat history from localStorage:', e);
      }
    }

    try {
      const data = await chatService.fetchUserHistory(userId);
      if (data && data.length > 0) {
        const dbMessages: Message[] = data.map(msg => ({
          role: msg.is_human && msg.sender_id === userId ? 'user' : 'bot',
          content: msg.message
        }));
        setMessages(dbMessages);
        localStorage.setItem(`gfitlif_chat_history_${userId}`, JSON.stringify(dbMessages));

        const lastMessage = dbMessages[dbMessages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          setTimeout(() => {
            processAiResponse(dbMessages);
          }, 1500);
        }
      }
    } catch (e) {
      console.error('Error loading chat history from DB:', e);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoadingSession(false);
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setMessages([{ role: 'bot', content: 'Olá! Sou a consultora da G-FitLif. Como posso te ajudar hoje?' }]);
      }
      setLoadingSession(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadHistory(session.user.id);
      
      const msgSubscription = chatService.subscribeToMessages(session.user.id, (payload) => {
        const newMessage = payload.new;
        if (newMessage && newMessage.message && !newMessage.is_human) {
          setMessages(prev => {
            if (prev.some(m => m.content === newMessage.message && m.role === 'bot')) return prev;
            return [...prev, { role: 'bot', content: newMessage.message }];
          });
          setShowNotification(true);
        }
      });

      return () => {
        if (msgSubscription) msgSubscription.unsubscribe();
      };
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => setShowNotification(true), 10000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setShowNotification(false);
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!session) {
      console.log('❌ [CHAT] Tentativa de envio sem sessão');
      toast.error('Você precisa estar logado para enviar mensagens.');
      navigate('/login');
      return;
    }

    const userMessage = input.trim();
    console.log('[CHAT] Enviando mensagem:', userMessage);
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(updatedMessages);
    localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(updatedMessages));
    
    try {
      console.log('[CHAT] Salvando mensagem no banco...');
      await chatService.sendMessage({
        sender_id: session.user.id,
        receiver_id: null,
        message: userMessage,
        is_human: true,
        is_read: false,
        source: source
      });
      
      if (session.user.email !== 'pereira.itapema@gmail.com') {
        console.log('[LEADS] Garantindo criação/atualização do lead...');
        // Create/Update lead with the correct source
        await leadService.updateStatus('frio', { source });
      }

      console.log('[AI] Solicitando resposta da IA...');
      processAiResponse(updatedMessages);
    } catch (e) {
      console.error('❌ [CHAT] Erro ao enviar mensagem:', e);
    }
  };

  const processAiResponse = async (currentMessages: Message[]) => {
    if (loading || !session?.user?.id) {
      console.log('[AI] Processamento cancelado: carregando ou sem usuário', { loading, userId: session?.user?.id });
      return;
    }
    setLoading(true);

    try {
      console.log('[AI] Verificando se auto-reply está ativo...');
      const { data: leadData } = await supabase.from('leads').select('ai_auto_reply').eq('id', session.user.id).maybeSingle();
      const { data: affiliateData } = await supabase.from('affiliates').select('ai_auto_reply').eq('user_id', session.user.id).maybeSingle();
      
      const isAffiliate = source === 'afiliados';
      const autoReplyEnabled = isAffiliate ? (affiliateData?.ai_auto_reply !== false) : (leadData?.ai_auto_reply !== false);

      if (!autoReplyEnabled) {
        console.log('[AI] Auto-reply desativado para este usuário.');
        setLoading(false);
        return;
      }

      console.log('[AI] Preparando mensagens para o Gemini...');
      const aiMessages: AiMessage[] = currentMessages.map(m => ({
        role: m.role === 'bot' ? 'bot' : 'user',
        content: m.content
      }));

      console.log('[AI] Chamando processResponse...');
      const botResponse = await aiService.processResponse(session.user.id, aiMessages, isAffiliate);
      console.log('[AI] Resposta recebida do Gemini');

      const parts = botResponse.split('[SPLIT]').filter(p => p.trim());
      
      let latestMessages = currentMessages;
      for (const part of parts) {
        const botPart = part.trim();
        console.log('[AI] Enviando parte da resposta:', botPart.substring(0, 30) + '...');
        latestMessages = [...latestMessages, { role: 'bot' as const, content: botPart }];
        setMessages(latestMessages);
        localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(latestMessages));
        
        await chatService.sendMessage({
          sender_id: null,
          receiver_id: session.user.id,
          message: botPart,
          is_human: false,
          is_read: true,
          source: source
        });
        
        if (parts.indexOf(part) < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      console.log('[AI] Fluxo de resposta finalizado com sucesso.');
    } catch (error) {
      console.error('❌ [AI] Erro no processamento da resposta:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[380px] h-[600px] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-emerald-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                    {agentPhoto ? (
                      <img src={agentPhoto} alt="Agente" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Bot size={24} />
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-emerald-600 rounded-full" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Suporte G-FitLif</h3>
                  <p className="text-[10px] text-emerald-100">Online agora</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className="w-8 h-8 rounded-full flex-shrink-0 mt-auto overflow-hidden bg-slate-200 flex items-center justify-center">
                      {msg.role === 'bot' ? (
                        agentPhoto ? <img src={agentPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Bot size={16} className="text-emerald-600" />
                      ) : (
                        userPhoto ? <img src={userPhoto} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <User size={16} className="text-slate-600" />
                      )}
                    </div>
                    <div className={`p-3 rounded-2xl text-sm shadow-sm ${
                      msg.role === 'user' 
                        ? 'bg-emerald-600 text-white rounded-br-none' 
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                    }`}>
                      <div className="markdown-body prose prose-sm max-w-none prose-p:leading-relaxed prose-a:text-emerald-500">
                        <ReactMarkdown>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
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
                  className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                >
                  <LogIn size={18} />
                  Fazer Login para Conversar
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-200"
                  >
                    <Send size={20} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle Button */}
      <div className="relative">
        <AnimatePresence>
          {showNotification && !isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-20 right-0 w-64 p-4 bg-white rounded-2xl shadow-xl border border-slate-100 mb-2"
            >
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">Suporte G-FitLif</p>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {aiSettings.triggers || 'Olá! Como posso ajudar você hoje?'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(true)}
                className="w-full mt-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors"
              >
                Conversar Agora
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
            isOpen ? 'bg-slate-800 rotate-90' : 'bg-emerald-600 hover:scale-110'
          }`}
        >
          {isOpen ? (
            <X size={32} className="text-white" />
          ) : (
            <div className="relative">
              <MessageSquare size={32} className="text-white" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 border-2 border-emerald-600 rounded-full animate-pulse" />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
