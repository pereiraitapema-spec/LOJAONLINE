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
  Sparkles,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ReactMarkdown from 'react-markdown';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface Lead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  status_lead: string;
  ai_auto_reply: boolean;
  score?: number;
  tags?: string[];
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  created_at: string;
}

interface GroupedLead {
  email: string;
  nome: string;
  whatsapp: string;
  leads: Lead[];
  last_message?: string;
  last_message_time?: string;
  unread_count?: number;
  ai_auto_reply: boolean;
  status_lead: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  message: string;
  is_human: boolean;
  created_at: string;
  is_read?: boolean;
}

export default function LeadsChat() {
  const [groupedLeads, setGroupedLeads] = useState<GroupedLead[]>([]);
  const groupedLeadsRef = useRef<GroupedLead[]>([]);

  const updateGroupedLeads = (newGroups: GroupedLead[] | ((prev: GroupedLead[]) => GroupedLead[])) => {
    setGroupedLeads(prev => {
      const next = typeof newGroups === 'function' ? newGroups(prev) : newGroups;
      groupedLeadsRef.current = next;
      return next;
    });
  };
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [globalAiMode, setGlobalAiMode] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'single' | 'bulk'>('single');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const selectedGroupRef = useRef<GroupedLead | undefined>(undefined);
  const selectedGroupKeyRef = useRef<string | null>(null);

  const selectedGroup = groupedLeads.find(g => {
    const key = g.email && g.email !== 'sem-email' ? g.email : (g.whatsapp || g.leads[0]?.id);
    return key === selectedGroupKey;
  });

  useEffect(() => {
    selectedGroupRef.current = selectedGroup;
    selectedGroupKeyRef.current = selectedGroupKey;
  }, [groupedLeads, selectedGroupKey, selectedGroup]);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const init = async () => {
      try {
        await getCurrentUser();
        await fetchLeads(true);
      } catch (err) {
        console.error('❌ Erro na inicialização do LeadsChat:', err);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 Tentando novamente (${retryCount}/${maxRetries})...`);
          setTimeout(init, 2000 * retryCount);
        }
      }
    };

    init();

    const channel = supabase
      .channel('chat_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMessage = payload.new as Message;
        
        // Update messages if it's for the selected lead(s)
        const currentGroup = selectedGroupRef.current;
        if (currentGroup) {
          const leadIds = currentGroup.leads.map(l => l.id);
          const isRelevant = leadIds.includes(newMessage.sender_id) || leadIds.includes(newMessage.receiver_id);
          
          if (isRelevant) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMessage.id)) return prev;
              const updated = [...prev, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
              return updated;
            });
          }
        }

        // Update groupedLeads state locally without fetching from DB
        const groupExists = groupedLeadsRef.current.some(g => 
          g.leads.some(l => l.id === newMessage.sender_id || l.id === newMessage.receiver_id)
        );

        if (groupExists) {
          updateGroupedLeads(prevGroups => {
            const updatedGroups = [...prevGroups];
            
            // Find the group that this message belongs to
            const groupIndex = updatedGroups.findIndex(g => 
              g.leads.some(l => l.id === newMessage.sender_id || l.id === newMessage.receiver_id)
            );

            if (groupIndex !== -1) {
              const group = updatedGroups[groupIndex];
              const leadIds = group.leads.map(l => l.id);
              
              // Check if it's a new unread message from the lead
              const isUnreadFromLead = leadIds.includes(newMessage.sender_id) && newMessage.is_read === false;
              
              updatedGroups[groupIndex] = {
                ...group,
                last_message: newMessage.message,
                last_message_time: newMessage.created_at,
                unread_count: isUnreadFromLead ? (group.unread_count || 0) + 1 : group.unread_count
              };

              // Re-sort groups so the one with the new message goes to the top
              return updatedGroups.sort((a, b) => {
                const timeA = new Date(a.last_message_time).getTime();
                const timeB = new Date(b.last_message_time).getTime();
                return timeB - timeA;
              });
            }
            return prevGroups;
          });
        } else {
          // Se não encontrou o grupo, é um lead novo.
          fetchLeads(false);
        }
      })
      .subscribe((status) => {
        console.log('📡 Status da Conexão Realtime:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro Crítico no Realtime. Verifique se a tabela chat_messages está na publicação supabase_realtime.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Only run once on mount

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const getCurrentUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        if (error.message.includes('Lock broken')) {
          console.warn('Auth lock broken, retrying...');
          return;
        }
        throw error;
      }
      setCurrentUser(session?.user || null);
    } catch (error: any) {
      console.error('Error getting user:', error);
    }
  };

  const [activeTab, setActiveTab] = useState<'leads' | 'affiliates'>('leads');
  const activeTabRef = useRef<'leads' | 'affiliates'>('leads');

  useEffect(() => {
    activeTabRef.current = activeTab;
    fetchLeads(true, activeTab);
    setSelectedGroupKey(null);
    setMessages([]);
  }, [activeTab]);

  const fetchLeads = async (isInitial = false, currentTab = activeTabRef.current) => {
    try {
      if (isInitial) setLoading(true);
      
      let leadsData: any[] = [];
      
      if (currentTab === 'leads') {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        leadsData = data || [];
      } else {
        const { data, error } = await supabase
          .from('affiliates')
          .select('*')
          .eq('status', 'approved')
          .not('user_id', 'is', null)
          .order('created_at', { ascending: false });
        if (error) throw error;
        
        // Map affiliates to match Lead interface for the chat
        leadsData = (data || []).map(aff => ({
          id: aff.user_id || aff.id, // Use user_id for chat messages
          nome: aff.name,
          email: aff.email,
          whatsapp: aff.whatsapp,
          status_lead: aff.status,
          ai_auto_reply: aff.ai_auto_reply !== undefined ? aff.ai_auto_reply : true, // Use from DB or default to true
          created_at: aff.created_at
        }));
      }

      // Fetch last messages and unread counts for each lead
      // Using specific columns and handling potential missing columns gracefully
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('sender_id, receiver_id, message, created_at, is_read, is_human')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (messagesError) {
        console.error('Initial messages fetch error:', messagesError);
        // If it's a Bad Request, it might be a missing column. Try without is_human and is_read
        if (messagesError.message === 'Bad Request' || messagesError.code === 'PGRST204' || messagesError.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chat_messages')
            .select('sender_id, receiver_id, message, created_at')
            .order('created_at', { ascending: false })
            .limit(1000);
          
          if (fallbackError) throw fallbackError;
          // Use fallback data
          processMessages(leadsData, fallbackData || []);
        } else {
          throw messagesError;
        }
      } else {
        processMessages(leadsData, messagesData || []);
      }
    } catch (error: any) {
      console.error('Error in fetchLeads:', error);
      if (isInitial) toast.error('Erro ao carregar leads: ' + (error.message || 'Erro de conexão'));
    } finally {
      if (isInitial) setLoading(false);
    }
  };

  const processMessages = (leadsData: any[], messagesData: any[]) => {
    // Group by email or whatsapp if email is missing
    const groups: Record<string, GroupedLead> = {};
    leadsData.forEach(lead => {
      const groupKey = lead.email && lead.email !== 'sem-email' ? lead.email : (lead.whatsapp || lead.id);
      if (!groups[groupKey]) {
        groups[groupKey] = {
          email: lead.email || 'sem-email',
          nome: lead.nome,
          whatsapp: lead.whatsapp,
          leads: [],
          ai_auto_reply: lead.ai_auto_reply,
          status_lead: lead.status_lead
        };
      }
      groups[groupKey].leads.push(lead);
    });

    // Map last messages and unread counts
    const finalGroups = Object.values(groups).map(group => {
      const leadIds = group.leads.map(l => l.id);
      const groupMessages = messagesData.filter(m => leadIds.includes(m.sender_id) || leadIds.includes(m.receiver_id));
      const lastMsg = groupMessages[0];
      
      // Count unread messages from the lead (where lead is sender and is_read is false)
      const unreadCount = groupMessages.filter(m => leadIds.includes(m.sender_id) && m.is_read === false).length;
      
      return {
        ...group,
        last_message: lastMsg?.message || 'Nenhuma mensagem',
        last_message_time: lastMsg?.created_at || group.leads[0].created_at,
        unread_count: unreadCount
      };
    });

    // Sort by last message time
    const sortedGroups = finalGroups.sort((a, b) => {
      const timeA = new Date(a.last_message_time).getTime();
      const timeB = new Date(b.last_message_time).getTime();
      return timeB - timeA;
    });

    updateGroupedLeads(sortedGroups);
  };

  const fetchMessages = async (leadIds: string[]) => {
    try {
      if (!currentUser || leadIds.length === 0) return;
      
      console.log(`Buscando mensagens para ${leadIds.length} IDs de leads:`, leadIds);

      // Usamos CHUNKS para evitar o erro de URL muito longa (Bad Request)
      const CHUNK_SIZE = 50;
      const chunks = [];
      for (let i = 0; i < leadIds.length; i += CHUNK_SIZE) {
        chunks.push(leadIds.slice(i, i + CHUNK_SIZE));
      }

      let allMessages: any[] = [];

      for (const chunk of chunks) {
        // Busca mensagens onde o lead é o remetente OU o destinatário
        const { data, error } = await supabase
          .from('chat_messages')
          .select('id, sender_id, receiver_id, message, created_at, is_read, is_human')
          .or(`sender_id.in.(${chunk.join(',')}),receiver_id.in.(${chunk.join(',')})`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Erro ao buscar chunk de mensagens:', error);
          continue;
        }
        if (data) allMessages = [...allMessages, ...data];
      }

      // Remover duplicatas e ordenar
      const unique = Array.from(new Map(allMessages.map(m => [m.id, m])).values());
      const sorted = unique.sort((a: any, b: any) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(sorted as Message[]);
      console.log(`Total de mensagens carregadas: ${sorted.length}`);
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar histórico.');
    }
  };

  const handleSelectGroup = async (group: GroupedLead) => {
    const groupKey = group.email && group.email !== 'sem-email' ? group.email : (group.whatsapp || group.leads[0]?.id);
    setSelectedGroupKey(groupKey);
    const leadIds = group.leads.map(l => l.id);
    fetchMessages(leadIds);
    
    // Mark messages as read in chunks to avoid URL length limits
    try {
      const CHUNK_SIZE = 30;
      for (let i = 0; i < leadIds.length; i += CHUNK_SIZE) {
        const chunk = leadIds.slice(i, i + CHUNK_SIZE);
        await supabase
          .from('chat_messages')
          .update({ is_read: true })
          .in('sender_id', chunk)
          .eq('is_read', false);
      }
      
      // Clear unread count locally
      updateGroupedLeads(prev => prev.map(g => {
        const key = g.email && g.email !== 'sem-email' ? g.email : (g.whatsapp || g.leads[0]?.id);
        return key === groupKey ? { ...g, unread_count: 0 } : g;
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    console.log('handleSendMessage disparado. Input:', input);
    if (!input.trim() || !selectedGroup || !currentUser) {
      console.log('handleSendMessage cancelado: input vazio, sem grupo ou sem usuário.');
      return;
    }

    // Use the most recent lead ID for this email
    const mainLead = selectedGroup.leads[0];
    console.log(`Enviando mensagem para Lead ID: ${mainLead.id} (${selectedGroup.nome})`);

    const newMessage: Message = {
      id: crypto.randomUUID(), // ID temporário para atualização otimista
      sender_id: currentUser.id,
      receiver_id: mainLead.id,
      message: input,
      is_human: true,
      created_at: new Date().toISOString(),
      is_read: true
    };

    // Atualização Otimista: Mostra na tela antes mesmo de salvar no banco
    setMessages(prev => [...prev, newMessage]);
    setInput('');

    try {
      console.log('Inserindo mensagem no Supabase:', newMessage);
      const { error } = await supabase.from('chat_messages').insert({
        sender_id: newMessage.sender_id,
        receiver_id: newMessage.receiver_id,
        message: newMessage.message,
        is_human: newMessage.is_human
      });

      if (error) {
        console.error('Erro no insert do Supabase:', error);
        // Remove a mensagem se deu erro
        setMessages(prev => prev.filter(m => m.id !== newMessage.id));
        throw error;
      }
      
      console.log('Mensagem salva com sucesso no banco.');
      
      // AI Learning: Save human response to knowledge base if AI auto-reply is off
      if (!selectedGroup?.ai_auto_reply) {
        await supabase.from('ai_knowledge_base').insert({
          topic: `Atendimento: ${selectedGroup.nome}`,
          content: input
        });
      }

      // Update lead status to 'morno' if it was 'frio'
      if (selectedGroup.status_lead === 'frio') {
        await supabase.from('leads').update({ status_lead: 'morno' }).eq('id', mainLead.id);
      }

      setInput('');
    } catch (error: any) {
      toast.error('Erro ao enviar mensagem: ' + error.message);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedLeads.length === 0) return;
    setDeleteType('bulk');
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const leadsToDelete = deleteType === 'bulk' 
      ? selectedLeads 
      : (selectedGroup ? selectedGroup.leads.map(l => l.id) : []);

    if (leadsToDelete.length === 0) return;

    try {
      setLoading(true);
      
      // Process deletion in chunks to avoid URL length limits (Bad Request)
      const CHUNK_SIZE = 30;
      for (let i = 0; i < leadsToDelete.length; i += CHUNK_SIZE) {
        const chunk = leadsToDelete.slice(i, i + CHUNK_SIZE);
        
        // Delete messages first (separate calls for robustness)
        await supabase
          .from('chat_messages')
          .delete()
          .in('sender_id', chunk);
        
        await supabase
          .from('chat_messages')
          .delete()
          .in('receiver_id', chunk);
        
        // Delete leads
        const { error } = await supabase.from('leads').delete().in('id', chunk);
        if (error) throw error;
      }

      toast.success('Conversas excluídas com sucesso!');
      setSelectedLeads([]);
      fetchLeads();
      
      if (deleteType === 'single' || (selectedGroup && selectedGroup.leads.some(l => leadsToDelete.includes(l.id)))) {
        setSelectedGroupKey(null);
      }
    } catch (error: any) {
      console.error('Error deleting conversations:', error);
      toast.error('Erro ao excluir conversas: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleUnifyLeads = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.rpc('unify_leads_by_email');
      if (error) throw error;
      toast.success('Conversas unificadas com sucesso!');
      fetchLeads();
    } catch (error: any) {
      toast.error('Erro ao unificar conversas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleAiMode = async (leadId: string, currentMode: boolean) => {
    try {
      if (activeTab === 'affiliates') {
        const { error } = await supabase
          .from('affiliates')
          .update({ ai_auto_reply: !currentMode })
          .eq('user_id', leadId);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('leads')
          .update({ ai_auto_reply: !currentMode })
          .eq('id', leadId);
        
        if (error) throw error;
      }
      
      if (selectedGroup && selectedGroup.leads.some(l => l.id === leadId)) {
        updateGroupedLeads(prev => prev.map(g => {
          const key = g.email && g.email !== 'sem-email' ? g.email : (g.whatsapp || g.leads[0]?.id);
          const selectedKey = selectedGroup.email && selectedGroup.email !== 'sem-email' ? selectedGroup.email : (selectedGroup.whatsapp || selectedGroup.leads[0]?.id);
          return key === selectedKey ? { ...g, ai_auto_reply: !currentMode } : g;
        }));
      }
      
      toast.success(`IA ${!currentMode ? 'Ativada' : 'Desativada'} para este ${activeTab === 'affiliates' ? 'afiliado' : 'lead'}`);
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

  const filteredLeads = groupedLeads.filter(g => 
    (g.nome || '').toLowerCase().includes((searchTerm || '').toLowerCase()) || 
    (g.whatsapp || '').includes(searchTerm) ||
    (g.email || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100 overflow-hidden">
      {/* Sidebar - Leads List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col ${selectedGroupKey ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-800 italic uppercase">Conversas</h1>
            <div className="flex gap-2">
              <button 
                onClick={handleUnifyLeads}
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
                title="Unificar Duplicatas"
              >
                <Zap size={20} />
              </button>
              {selectedLeads.length > 0 && (
                <button 
                  onClick={handleDeleteSelected}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Excluir selecionados"
                >
                  <Trash2 size={20} />
                </button>
              )}
              <button className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors">
                <Filter size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('leads')}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
                activeTab === 'leads' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Leads
            </button>
            <button
              onClick={() => setActiveTab('affiliates')}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-colors ${
                activeTab === 'affiliates' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              Afiliados
            </button>
          </div>
          
          {/* Global AI Toggle Placeholder */}
          <div className="flex items-center justify-between bg-emerald-50 p-3 rounded-xl mb-4 border border-emerald-100">
            <div className="flex items-center gap-2">
              <img 
                src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100" 
                alt="Agente" 
                className="w-6 h-6 rounded-full object-cover border-2 border-emerald-500"
                referrerPolicy="no-referrer"
              />
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
              placeholder="Pesquisar conversas..." 
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
              <p>Nenhuma conversa encontrada.</p>
            </div>
          ) : (
            filteredLeads.map(group => {
              const groupKey = group.email && group.email !== 'sem-email' ? group.email : (group.whatsapp || group.leads[0]?.id);
              return (
                <div
                  key={groupKey}
                  className={`w-full flex items-center gap-2 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedGroupKey === groupKey ? 'bg-emerald-50' : ''}`}
                >
                <div className="pl-4">
                  <input 
                    type="checkbox"
                    checked={group.leads.every(l => selectedLeads.includes(l.id))}
                    onChange={() => {
                      const leadIds = group.leads.map(l => l.id);
                      const allSelected = leadIds.every(id => selectedLeads.includes(id));
                      if (allSelected) {
                        setSelectedLeads(prev => prev.filter(id => !leadIds.includes(id)));
                      } else {
                        setSelectedLeads(prev => [...new Set([...prev, ...leadIds])]);
                      }
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>
                <button
                  onClick={() => handleSelectGroup(group)}
                  className="flex-1 p-4 flex gap-3 text-left min-w-0"
                >
                  <div className="relative">
                    <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                      {(group.nome || group.email || group.whatsapp || 'U').charAt(0).toUpperCase()}
                    </div>
                    {group.unread_count && group.unread_count > 0 ? (
                      <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                        {group.unread_count}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-slate-800 truncate text-sm">{group.nome}</h3>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">
                        {group.last_message_time ? formatTime(group.last_message_time) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 truncate flex items-center gap-1">
                      {group.last_message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                        group.status_lead === 'quente' ? 'bg-rose-100 text-rose-600' :
                        group.status_lead === 'morno' ? 'bg-amber-100 text-amber-600' :
                        group.status_lead === 'cliente' ? 'bg-emerald-100 text-emerald-600' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {group.status_lead}
                      </span>
                      {!group.ai_auto_reply && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-bold uppercase flex items-center gap-1">
                          <User size={8} /> Humano
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className={`flex-1 flex flex-col bg-white ${!selectedGroupKey ? 'hidden md:flex' : 'flex'}`}>
        {selectedGroup ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedGroupKey(null)}
                  className="p-2 text-slate-500 hover:bg-slate-200 rounded-full md:hidden"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold">
                  {(selectedGroup.nome || selectedGroup.email || selectedGroup.whatsapp || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 text-sm">{selectedGroup.nome}</h2>
                  <p className="text-[10px] text-slate-500 flex items-center gap-2">
                    <span className="flex items-center gap-1"><Phone size={10} /> {selectedGroup.whatsapp}</span>
                    <span className="flex items-center gap-1"><Mail size={10} /> {selectedGroup.email}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                  <img 
                    src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100" 
                    alt="Agente" 
                    className={`w-6 h-6 rounded-full object-cover border-2 ${selectedGroup.ai_auto_reply ? 'border-emerald-500' : 'border-slate-300 grayscale'}`}
                    referrerPolicy="no-referrer"
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">IA Ativa</span>
                  <button 
                    onClick={() => toggleAiMode(selectedGroup.leads[0].id, selectedGroup.ai_auto_reply)}
                    className={`w-8 h-4 rounded-full relative transition-colors ${selectedGroup.ai_auto_reply ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedGroup.ai_auto_reply ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </div>
                <button 
                  onClick={() => {
                    setDeleteType('single');
                    setShowDeleteModal(true);
                  }}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Excluir Conversa"
                >
                  <Trash2 size={20} />
                </button>
                <button 
                  onClick={() => setShowDetails(!showDetails)}
                  className={`p-2 rounded-full transition-colors ${showDetails ? 'bg-emerald-100 text-emerald-600' : 'text-slate-500 hover:bg-slate-200'}`}
                >
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#e5ddd5] bg-opacity-50">
                {messages.map((msg) => {
                  // Uma mensagem é do admin se o sender_id for o admin E o receiver_id NÃO for null.
                  // Se receiver_id for null, significa que a mensagem foi enviada do chat da loja (mesmo que o admin esteja testando).
                  const isFromAdmin = msg.sender_id === currentUser?.id && msg.receiver_id !== null;
                  const isFromAI = msg.sender_id === null;
                  const isFromLead = !isFromAdmin && !isFromAI;
                  
                  const adminAvatarUrl = currentUser?.user_metadata?.avatar_url;
                  const aiAvatarUrl = "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100";
                  
                  return (
                  <div 
                    key={msg.id} 
                    className={`flex ${isFromAdmin || isFromAI ? 'justify-end' : 'justify-start'} mb-4`}
                  >
                    {isFromLead && (
                      <div className="flex-shrink-0 mr-2 mt-auto">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs shadow-sm">
                          {(selectedGroup.nome || selectedGroup.email || selectedGroup.whatsapp || 'U').charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}
                    <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm relative ${
                      isFromAdmin 
                        ? 'bg-[#dcf8c6] text-slate-800 rounded-br-none' 
                        : isFromAI
                          ? 'bg-blue-50 text-slate-800 rounded-br-none border border-blue-100'
                          : 'bg-white text-slate-800 rounded-bl-none'
                    }`}>
                      {/* Label para identificar quem enviou */}
                      <div className="text-[9px] font-bold mb-1 opacity-50 flex justify-between">
                        <span>
                          {isFromAdmin 
                            ? 'VOCÊ (ADMIN)' 
                            : isFromAI 
                              ? 'AGENTE VIRTUAL' 
                              : (activeTab === 'affiliates' ? 'AFILIADO' : 'LEAD')}
                        </span>
                      </div>

                      <div className="prose prose-sm max-w-none mb-1">
                        <ReactMarkdown>{msg.message}</ReactMarkdown>
                      </div>
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-[9px] text-slate-500">
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </span>
                        {isFromAdmin && (
                          <CheckCheck size={12} className="text-blue-500" />
                        )}
                        {isFromAdmin && (
                          <button 
                            onClick={() => {
                              supabase.from('ai_knowledge_base').insert({
                                topic: `Manual: ${selectedGroup.nome}`,
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
                    </div>
                    {(isFromAdmin || isFromAI) && (
                      <div className="flex-shrink-0 ml-2 mt-auto">
                        {isFromAdmin ? (
                          adminAvatarUrl ? (
                            <img src={adminAvatarUrl} alt="Admin" className="w-8 h-8 rounded-full object-cover shadow-sm" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs shadow-sm">
                              {(currentUser?.user_metadata?.full_name || currentUser?.email || 'A').charAt(0).toUpperCase()}
                            </div>
                          )
                        ) : (
                          <img src={aiAvatarUrl} alt="Agente Virtual" className="w-8 h-8 rounded-full object-cover shadow-sm border-2 border-emerald-500" referrerPolicy="no-referrer" />
                        )}
                      </div>
                    )}
                  </div>
                )})}
                <div ref={messagesEndRef} />
              </div>

              {/* Details Sidebar */}
              <AnimatePresence>
                {showDetails && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 300, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-white border-l border-slate-200 overflow-y-auto"
                  >
                    <div className="p-6 space-y-6">
                      <div className="text-center">
                        <div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-2xl mx-auto mb-4">
                          {(selectedGroup.nome || selectedGroup.email || selectedGroup.whatsapp || 'U').charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-bold text-slate-800">{selectedGroup.nome}</h3>
                        <p className="text-xs text-slate-500">{selectedGroup.email}</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Informações do {activeTab === 'leads' ? 'Lead' : 'Afiliado'}</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Status:</span>
                              <span className="font-bold text-slate-800 uppercase">{selectedGroup.status_lead}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">WhatsApp:</span>
                              <span className="font-bold text-slate-800">{selectedGroup.whatsapp}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Total de {activeTab === 'leads' ? 'Leads' : 'Afiliados'}:</span>
                              <span className="font-bold text-slate-800">{selectedGroup.leads.length}</span>
                            </div>
                          </div>
                        </div>

                        {activeTab === 'leads' && (
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tags</h4>
                            <div className="flex flex-wrap gap-1">
                              {selectedGroup.leads.flatMap(l => l.tags || []).map((tag, i) => (
                                <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {activeTab === 'leads' && (
                          <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Configurações</h4>
                            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-100">
                              <div className="flex items-center gap-2">
                                <img 
                                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=100&h=100" 
                                  alt="Agente" 
                                  className={`w-5 h-5 rounded-full object-cover border-2 ${selectedGroup.ai_auto_reply ? 'border-emerald-500' : 'border-slate-300 grayscale'}`}
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-xs font-bold text-slate-700">IA Atende Automático</span>
                              </div>
                              <button 
                                onClick={() => toggleAiMode(selectedGroup.leads[0].id, selectedGroup.ai_auto_reply)}
                                className={`w-10 h-5 rounded-full relative transition-colors ${selectedGroup.ai_auto_reply ? 'bg-emerald-500' : 'bg-slate-300'}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${selectedGroup.ai_auto_reply ? 'right-1' : 'left-1'}`} />
                              </button>
                            </div>
                          </div>
                        )}

                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ações Rápidas</h4>
                          <div className="grid grid-cols-1 gap-2">
                            <button 
                              onClick={() => {
                                if (confirm('Excluir toda a conversa?')) {
                                  setSelectedLeads(selectedGroup.leads.map(l => l.id));
                                  handleDeleteSelected();
                                }
                              }}
                              className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                            >
                              <Trash2 size={14} /> Excluir Conversa
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmDelete}
        title={deleteType === 'bulk' ? 'Excluir Conversas Selecionadas' : 'Excluir Conversa'}
        message={deleteType === 'bulk' 
          ? `Tem certeza que deseja excluir as ${selectedLeads.length} conversas selecionadas? Esta ação não pode ser desfeita.`
          : `Tem certeza que deseja excluir toda a conversa com "${selectedGroup?.nome}"? Esta ação não pode ser desfeita.`
        }
        confirmText="Excluir"
        variant="danger"
      />
    </div>
  );
}
