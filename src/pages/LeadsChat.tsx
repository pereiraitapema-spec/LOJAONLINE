import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Search, 
  MessageSquare, 
  User, 
  Bot, 
  Send, 
  Clock, 
  MoreVertical, 
  Check, 
  CheckCheck,
  Zap,
  ArrowLeft,
  Phone,
  Mail,
  Filter,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';

interface Lead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  status_lead: string;
  ai_auto_reply: boolean;
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_human: boolean;
  created_at: string;
}

export default function LeadsChat() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalAiMode, setGlobalAiMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    fetchLeads();
    getCurrentUser();

    const channel = supabase
      .channel('chat_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMessage = payload.new as Message;
        
        // Update messages if it's for the selected lead
        if (selectedLead && (newMessage.sender_id === selectedLead.id || newMessage.receiver_id === selectedLead.id)) {
          setMessages(prev => [...prev, newMessage]);
        }

        // Update leads list with last message
        setLeads(prev => {
          const updated = prev.map(l => {
            if (l.id === newMessage.sender_id || l.id === newMessage.receiver_id) {
              return {
                ...l,
                last_message: newMessage.message,
                last_message_time: newMessage.created_at,
                unread_count: (l.id !== selectedLead?.id && newMessage.sender_id === l.id) ? (l.unread_count || 0) + 1 : l.unread_count
              };
            }
            return l;
          });
          return updated.sort((a, b) => {
            const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
            const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
            return timeB - timeA;
          });
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedLead]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      // Fetch all leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Fetch last messages for each lead
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (messagesError) throw messagesError;

      const leadsWithMessages = leadsData.map(lead => {
        const leadMessages = messagesData.filter(m => m.sender_id === lead.id || m.receiver_id === lead.id);
        const lastMsg = leadMessages[0];
        return {
          ...lead,
          last_message: lastMsg?.message || 'Nenhuma mensagem',
          last_message_time: lastMsg?.created_at || lead.created_at,
          unread_count: 0 // Placeholder
        };
      });

      // Sort by last message time
      const sortedLeads = leadsWithMessages.sort((a, b) => {
        const timeA = new Date(a.last_message_time).getTime();
        const timeB = new Date(b.last_message_time).getTime();
        return timeB - timeA;
      });

      setLeads(sortedLeads);
    } catch (error: any) {
      toast.error('Erro ao carregar leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (leadId: string) => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${leadId},receiver_id.eq.${leadId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar mensagens: ' + error.message);
    }
  };

  const handleSelectLead = (lead: Lead) => {
    setSelectedLead(lead);
    fetchMessages(lead.id);
    // Clear unread count
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, unread_count: 0 } : l));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !selectedLead || !currentUser) return;

    const newMessage = {
      sender_id: currentUser.id,
      receiver_id: selectedLead.id,
      message: input,
      is_human: true,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('chat_messages').insert(newMessage);
      if (error) throw error;
      
      // AI Learning: Save human response to knowledge base if AI auto-reply is off
      if (!selectedLead.ai_auto_reply) {
        await supabase.from('ai_knowledge_base').insert({
          topic: `Atendimento: ${selectedLead.nome}`,
          content: input
        });
      }

      // Update lead status to 'morno' if it was 'frio'
      if (selectedLead.status_lead === 'frio') {
        await supabase.from('leads').update({ status_lead: 'morno' }).eq('id', selectedLead.id);
      }

      setInput('');
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem: ' + error.message);
    }
  };

  const toggleAiMode = async (leadId: string, currentMode: boolean) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ ai_auto_reply: !currentMode })
        .eq('id', leadId);

      if (error) throw error;
      
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, ai_auto_reply: !currentMode });
      }
      
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ai_auto_reply: !currentMode } : l));
      toast.success(`IA ${!currentMode ? 'Ativada' : 'Desativada'} para este lead`);
    } catch (error: any) {
      toast.error('Erro ao alterar modo da IA: ' + error.message);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Ontem';
    return format(date, 'dd/MM/yy');
  };

  const filteredLeads = leads.filter(l => 
    l.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.whatsapp.includes(searchTerm)
  );

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100 overflow-hidden">
      {/* Sidebar - Leads List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col ${selectedLead ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-800">Leads Chat</h1>
            <div className="flex gap-2">
              <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                <Filter size={20} />
              </button>
            </div>
          </div>
          
          {/* Global AI Toggle Placeholder */}
          <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl mb-4 border border-emerald-100">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 uppercase">IA Atende Automático</span>
            </div>
            <button 
              onClick={() => setGlobalAiMode(!globalAiMode)}
              className={`w-10 h-5 rounded-full relative transition-colors ${globalAiMode ? 'bg-emerald-500' : 'bg-slate-300'}`}
            >
              <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${globalAiMode ? 'right-1' : 'left-1'}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Pesquisar leads..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Carregando conversas...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p>Nenhum lead encontrado.</p>
            </div>
          ) : (
            filteredLeads.map(lead => (
              <button
                key={lead.id}
                onClick={() => handleSelectLead(lead)}
                className={`w-full p-4 flex gap-3 border-b border-slate-50 hover:bg-slate-50 transition-colors text-left ${selectedLead?.id === lead.id ? 'bg-emerald-50' : ''}`}
              >
                <div className="relative">
                  <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                    {lead.nome.charAt(0).toUpperCase()}
                  </div>
                  {lead.unread_count && lead.unread_count > 0 ? (
                    <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                      {lead.unread_count}
                    </span>
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="font-bold text-slate-800 truncate text-sm">{lead.nome}</h3>
                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                      {lead.last_message_time ? formatTime(lead.last_message_time) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                    {lead.last_message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                      lead.status_lead === 'quente' ? 'bg-rose-100 text-rose-600' :
                      lead.status_lead === 'morno' ? 'bg-amber-100 text-amber-600' :
                      lead.status_lead === 'cliente' ? 'bg-emerald-100 text-emerald-600' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {lead.status_lead}
                    </span>
                    {!lead.ai_auto_reply && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold uppercase flex items-center gap-1">
                        <User size={8} /> Humano
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className={`flex-1 flex flex-col bg-white ${!selectedLead ? 'hidden md:flex' : 'flex'}`}>
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedLead(null)}
                  className="p-2 text-slate-500 hover:bg-slate-200 rounded-full md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                  {selectedLead.nome.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">{selectedLead.nome}</h2>
                  <p className="text-[10px] text-slate-500 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Phone size={10} /> {selectedLead.whatsapp}</span>
                    <span className="flex items-center gap-1"><Mail size={10} /> {selectedLead.email}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  <Bot size={16} className={selectedLead.ai_auto_reply ? 'text-emerald-500' : 'text-slate-300'} />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">IA Ativa</span>
                  <button 
                    onClick={() => toggleAiMode(selectedLead.id, selectedLead.ai_auto_reply)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${selectedLead.ai_auto_reply ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedLead.ai_auto_reply ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5] bg-opacity-50">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative ${
                    msg.sender_id === currentUser?.id 
                      ? 'bg-[#dcf8c6] text-slate-800 rounded-tr-none' 
                      : 'bg-white text-slate-800 rounded-tl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none mb-1">
                      <ReactMarkdown>{msg.message}</ReactMarkdown>
                    </div>
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-[9px] text-slate-500">
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {msg.sender_id === currentUser?.id && (
                        <CheckCheck size={12} className="text-blue-500" />
                      )}
                      {msg.sender_id === currentUser?.id && (
                        <button 
                          onClick={() => {
                            supabase.from('ai_knowledge_base').insert({
                              topic: `Manual: ${selectedLead.nome}`,
                              content: msg.message
                            }).then(({ error }) => {
                              if (!error) toast.success('IA aprendeu com esta resposta!');
                            });
                          }}
                          className="ml-2 text-emerald-600 hover:text-emerald-800"
                          title="IA Aprender com esta resposta"
                        >
                          <Sparkles size={12} />
                        </button>
                      )}
                    </div>
                    {!msg.is_human && msg.sender_id !== selectedLead.id && (
                      <span className="absolute -top-2 -left-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                        <Bot size={10} />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 items-center">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Digite uma mensagem..." 
                  className="w-full pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                />
                <button 
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600"
                >
                  <Zap size={20} />
                </button>
              </div>
              <button 
                type="submit"
                disabled={!input.trim()}
                className="p-3 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-lg"
              >
                <Send size={20} />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-8 text-center">
            <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
              <MessageSquare size={48} />
            </div>
            <h2 className="text-2xl font-bold text-slate-600 mb-2">Selecione uma conversa</h2>
            <p className="max-w-xs">Escolha um lead na lista ao lado para visualizar o histórico de mensagens e iniciar o atendimento.</p>
          </div>
        )}
      </div>
    </div>
  );
}
