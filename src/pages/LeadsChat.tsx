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
}

export default function LeadsChat() {
  const [groupedLeads, setGroupedLeads] = useState<GroupedLead[]>([]);
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
        await fetchLeads();
      } catch (err) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(init, 1000 * retryCount);
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
          if (leadIds.includes(newMessage.sender_id) || leadIds.includes(newMessage.receiver_id)) {
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage].sort((a, b) => 
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
              );
            });
          }
        }

        // Refresh leads to update last message and sorting
        fetchLeads();
      })
      .subscribe();

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
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        if (error.message.includes('Lock broken')) {
          console.warn('Auth lock broken, retrying...');
          return;
        }
        throw error;
      }
      setCurrentUser(user);
    } catch (error: any) {
      console.error('Error getting user:', error);
    }
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

      // Fetch last messages and unread counts for each lead
      // Using specific columns and handling potential missing columns gracefully
      const { data: messagesData, error: messagesError } = await supabase
        .from('chat_messages')
        .select('sender_id, receiver_id, message, created_at, is_read, is_human')
        .order('created_at', { ascending: false })
        .limit(2000);

      if (messagesError) {
        console.error('Initial messages fetch error:', messagesError);
        // If it's a Bad Request, it might be a missing column. Try without is_human and is_read
        if (messagesError.message === 'Bad Request' || messagesError.code === 'PGRST204' || messagesError.code === '42703') {
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('chat_messages')
            .select('sender_id, receiver_id, message, created_at')
            .order('created_at', { ascending: false })
            .limit(2000);
          
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
      toast.error('Erro ao carregar leads: ' + (error.message || 'Erro de conexão'));
    } finally {
      setLoading(false);
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

    setGroupedLeads(sortedGroups);
  };

  const fetchMessages = async (leadIds: string[]) => {
    try {
      // Validate that all IDs are valid UUIDs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validLeadIds = leadIds.filter(id => id && uuidRegex.test(id));
      
      if (validLeadIds.length === 0) {
        console.warn('No valid lead IDs to fetch messages for');
        setMessages([]);
        return;
      }

      console.log(`Fetching messages for ${validLeadIds.length} leads in chunks...`);

      // PostgREST/Nginx has URL length limits. 
      // Using a smaller chunk size for maximum safety
      const CHUNK_SIZE = 30; 
      const idChunks = [];
      for (let i = 0; i < validLeadIds.length; i += CHUNK_SIZE) {
        idChunks.push(validLeadIds.slice(i, i + CHUNK_SIZE));
      }

      const columns = 'id, sender_id, receiver_id, message, created_at, is_read, is_human';
      let allMessages: any[] = [];

      // DEBUG: Check if admin can see ANY messages at all in the table
      const { data: debugMsgs, error: countError } = await supabase
        .from('chat_messages')
        .select('id, sender_id, receiver_id, message')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (countError) {
        console.error('RLS/Table Debug - Error fetching messages:', countError);
      } else {
        console.log(`RLS/Table Debug - Found ${debugMsgs?.length || 0} messages in table.`);
        if (debugMsgs && debugMsgs.length > 0) {
          const allMsgIds = [...new Set(debugMsgs.flatMap(m => [m.sender_id, m.receiver_id]))];
          const { data: leadCheck } = await supabase
            .from('leads')
            .select('id, nome, email')
            .in('id', allMsgIds);
          
          const { data: profileCheck } = await supabase
            .from('profiles')
            .select('id, email')
            .in('id', allMsgIds);

          console.log('--- DEBUG: IDs NO BANCO ---');
          debugMsgs.forEach((m, i) => {
            const senderLead = leadCheck?.find(l => l.id === m.sender_id);
            const receiverLead = leadCheck?.find(l => l.id === m.receiver_id);
            const senderProfile = profileCheck?.find(p => p.id === m.sender_id);
            const receiverProfile = profileCheck?.find(p => p.id === m.receiver_id);

            const senderLabel = senderLead ? `Lead:${senderLead.nome}` : (senderProfile ? `Admin:${senderProfile.email}` : 'Unknown');
            const receiverLabel = receiverLead ? `Lead:${receiverLead.nome}` : (receiverProfile ? `Admin:${receiverProfile.email}` : 'Unknown');

            console.log(`Msg ${i+1}: From=${senderLabel} (${m.sender_id}), To=${receiverLabel} (${m.receiver_id}), Text=${m.message?.substring(0, 15)}...`);
          });
          console.log('--- DEBUG: IDs QUE ESTAMOS PROCURANDO ---');
          console.log('Lead IDs in current group:', validLeadIds);
          console.log('Current Admin ID:', currentUser?.id);
        } else {
          console.log('A TABELA chat_messages ESTÁ VAZIA PARA VOCÊ.');
        }
      }

      for (let i = 0; i < idChunks.length; i++) {
        const chunk = idChunks[i];
        console.log(`Processing chunk ${i + 1}/${idChunks.length} (${chunk.length} IDs)`);
        
        let sentRes: any;
        let receivedRes: any;

        const results = await Promise.all([
          supabase
            .from('chat_messages')
            .select(columns)
            .in('sender_id', chunk),
          supabase
            .from('chat_messages')
            .select(columns)
            .in('receiver_id', chunk)
        ]);
        
        sentRes = results[0];
        receivedRes = results[1];

        // Fallback if columns are missing or query is rejected
        if (sentRes.error || receivedRes.error) {
          const err = sentRes.error || receivedRes.error;
          console.warn(`Chunk ${i + 1} failed with:`, err.message);
          
          if (err.message === 'Bad Request' || err.code === 'PGRST204' || err.code === '42703') {
            console.log('Attempting fallback with minimal columns...');
            const fallbackColumns = 'id, sender_id, receiver_id, message, created_at';
            const fallbackResults = await Promise.all([
              supabase
                .from('chat_messages')
                .select(fallbackColumns)
                .in('sender_id', chunk),
              supabase
                .from('chat_messages')
                .select(fallbackColumns)
                .in('receiver_id', chunk)
            ]);
            sentRes = fallbackResults[0];
            receivedRes = fallbackResults[1];
          }
        }

        if (sentRes.error) {
          console.error(`Final error in sent messages chunk ${i + 1}:`, sentRes.error);
          continue; // Skip this chunk instead of crashing everything
        }
        if (receivedRes.error) {
          console.error(`Final error in received messages chunk ${i + 1}:`, receivedRes.error);
          continue;
        }

        allMessages = [...allMessages, ...(sentRes.data || []), ...(receivedRes.data || [])];
      }

      // Remove duplicates
      const uniqueMessages: any[] = Array.from(new Map(allMessages.map((m: any) => [m.id, m])).values());

      // Sort chronologically
      const sortedMessages = uniqueMessages.sort((a: any, b: any) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || '').localeCompare(b.id || '');
      });
      
      setMessages(sortedMessages as Message[]);
      console.log(`Successfully loaded ${sortedMessages.length} messages.`);
    } catch (error: any) {
      console.error('Critical error fetching messages:', error);
      toast.error('Erro ao carregar mensagens. Verifique o console para detalhes.');
    }
  };

  const handleSelectGroup = async (group: GroupedLead) => {
    const groupKey = group.email && group.email !== 'sem-email' ? group.email : (group.whatsapp || group.leads[0]?.id);
    setSelectedGroupKey(groupKey);
    const leadIds = group.leads.map(l => l.id);
    fetchMessages(leadIds);
    
    // Mark messages as read
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .in('sender_id', leadIds)
        .eq('is_read', false);
      
      // Clear unread count locally
      setGroupedLeads(prev => prev.map(g => {
        const key = g.email && g.email !== 'sem-email' ? g.email : (g.whatsapp || g.leads[0]?.id);
        return key === groupKey ? { ...g, unread_count: 0 } : g;
      }));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || !selectedGroup || !currentUser) return;

    // Use the most recent lead ID for this email
    const mainLead = selectedGroup.leads[0];

    const newMessage = {
      sender_id: currentUser.id,
      receiver_id: mainLead.id,
      message: input,
      is_human: true,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('chat_messages').insert(newMessage);
      if (error) throw error;
      
      // The SQL trigger will handle pruning to 100 messages.
      // But we can also do a quick check here to ensure UI consistency if needed.
      
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
      // Delete messages first (separate calls for robustness)
      await supabase
        .from('chat_messages')
        .delete()
        .in('sender_id', leadsToDelete);
      
      await supabase
        .from('chat_messages')
        .delete()
        .in('receiver_id', leadsToDelete);
      
      // Delete leads
      const { error } = await supabase.from('leads').delete().in('id', leadsToDelete);
      if (error) throw error;

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
      const { error } = await supabase
        .from('leads')
        .update({ ai_auto_reply: !currentMode })
        .eq('id', leadId);

      if (error) throw error;
      
      if (selectedGroup && selectedGroup.leads.some(l => l.id === leadId)) {
        setGroupedLeads(prev => prev.map(g => {
          const key = g.email && g.email !== 'sem-email' ? g.email : (g.whatsapp || g.leads[0]?.id);
          const selectedKey = selectedGroup.email && selectedGroup.email !== 'sem-email' ? selectedGroup.email : (selectedGroup.whatsapp || selectedGroup.leads[0]?.id);
          return key === selectedKey ? { ...g, ai_auto_reply: !currentMode } : g;
        }));
      }
      
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

  const filteredLeads = groupedLeads.filter(g => 
    g.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    g.whatsapp.includes(searchTerm) ||
    g.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-100 overflow-hidden">
      {/* Sidebar - Leads List */}
      <div className={`w-full md:w-80 lg:w-96 bg-white border-r border-slate-200 flex flex-col ${selectedGroupKey ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-slate-800 italic uppercase">Unificado</h1>
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
                      {group.nome.charAt(0).toUpperCase()}
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
                  {selectedGroup.nome.charAt(0).toUpperCase()}
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
                  <Bot size={16} className={selectedGroup.ai_auto_reply ? 'text-emerald-500' : 'text-slate-300'} />
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
                      {!msg.is_human && !selectedGroup.leads.some(l => l.id === msg.sender_id) && (
                        <span className="absolute -top-2 -left-2 bg-emerald-500 text-white p-1 rounded-full shadow-md">
                          <Bot size={10} />
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
                          {selectedGroup.nome.charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-bold text-slate-800">{selectedGroup.nome}</h3>
                        <p className="text-xs text-slate-500">{selectedGroup.email}</p>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Informações do Lead</h4>
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
                              <span className="text-slate-500">Total de Leads:</span>
                              <span className="font-bold text-slate-800">{selectedGroup.leads.length}</span>
                            </div>
                          </div>
                        </div>

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
