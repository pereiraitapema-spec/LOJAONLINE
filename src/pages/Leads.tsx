import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  Search, 
  Filter, 
  Mail, 
  Phone, 
  Calendar, 
  TrendingUp,
  ArrowLeft,
  MoreHorizontal,
  ExternalLink,
  MessageCircle,
  Zap,
  Star,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  status_lead: 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';
  score: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interactionStartDate, setInteractionStartDate] = useState('');
  const [interactionEndDate, setInteractionEndDate] = useState('');
  const [stats, setStats] = useState({
    total: 0,
    hot: 0,
    warm: 0,
    cold: 0,
    customers: 0
  });
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    leadId: string | null;
    leadName: string;
  }>({
    isOpen: false,
    leadId: null,
    leadName: ''
  });
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showSendMessageModal, setShowSendMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [expandedEmails, setExpandedEmails] = useState<string[]>([]);
  const [bulkDeleteModal, setBulkDeleteModal] = useState(false);

  const toggleExpand = (email: string) => {
    setExpandedEmails(prev => 
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', selectedLeads);

      if (error) throw error;
      
      // Update local state immediately
      setLeads(prev => {
        const updatedLeads = prev.filter(l => !selectedLeads.includes(l.id));
        calculateStats(updatedLeads);
        return updatedLeads;
      });
      
      toast.success(`${selectedLeads.length} leads excluídos permanentemente!`);
      setSelectedLeads([]);
      setBulkDeleteModal(false);
    } catch (error: any) {
      toast.error('Erro ao excluir leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleLeadSelection = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const toggleAllLeads = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id));
    }
  };

  const sendMessageToSelected = async () => {
    if (!messageText.trim() || selectedLeads.length === 0) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const messages = selectedLeads.map(leadId => ({
      sender_id: user.id,
      receiver_id: leadId,
      message: messageText,
      is_human: true
    }));

    await supabase.from('chat_messages').insert(messages);
    toast.success('Mensagens enviadas!');
    setShowSendMessageModal(false);
    setMessageText('');
    setSelectedLeads([]);
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
      calculateStats(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar leads: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (data: Lead[]) => {
    setStats({
      total: data.length,
      hot: data.filter(l => l.status_lead === 'quente').length,
      warm: data.filter(l => l.status_lead === 'morno').length,
      cold: data.filter(l => l.status_lead === 'frio').length,
      customers: data.filter(l => l.status_lead === 'cliente').length
    });
  };

  const updateLeadStatus = async (id: string, newStatus: Lead['status_lead']) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status_lead: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state immediately for better UX
      setLeads(prev => {
        const updatedLeads = prev.map(l => l.id === id ? { ...l, status_lead: newStatus, updated_at: new Date().toISOString() } : l);
        calculateStats(updatedLeads);
        return updatedLeads;
      });
      toast.success('Status do lead atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update local state immediately to ensure it doesn't "come back"
      setLeads(prev => {
        const updatedLeads = prev.filter(l => l.id !== id);
        calculateStats(updatedLeads);
        return updatedLeads;
      });
      setSelectedLeads(prev => prev.filter(leadId => leadId !== id));
      
      toast.success('Lead excluído com sucesso!');
      setConfirmModal({ isOpen: false, leadId: null, leadName: '' });
    } catch (error: any) {
      toast.error('Erro ao excluir lead: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.whatsapp?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || lead.status_lead === statusFilter;

    const matchesTags = !tagFilter || lead.tags?.some(tag => tag.toLowerCase().includes(tagFilter.toLowerCase()));

    const leadDate = new Date(lead.created_at);
    const matchesDate = (!startDate || leadDate >= new Date(startDate)) && 
                        (!endDate || leadDate <= new Date(endDate + 'T23:59:59'));

    const interactionDate = new Date(lead.updated_at);
    const matchesInteraction = (!interactionStartDate || interactionDate >= new Date(interactionStartDate)) && 
                               (!interactionEndDate || interactionDate <= new Date(interactionEndDate + 'T23:59:59'));
    
    return matchesSearch && matchesStatus && matchesTags && matchesDate && matchesInteraction;
  });

  const getStatusBadge = (status: Lead['status_lead']) => {
    const styles = {
      frio: 'bg-blue-100 text-blue-700',
      morno: 'bg-amber-100 text-amber-700',
      quente: 'bg-rose-100 text-rose-700',
      cliente: 'bg-emerald-100 text-emerald-700',
      inativo: 'bg-slate-100 text-slate-700'
    };
    
    const labels = {
      frio: '❄️ Frio',
      morno: '🔥 Morno',
      quente: '⚡ Quente',
      cliente: '🛍️ Cliente',
      inativo: '💤 Inativo'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  // Group leads by email
  const groupedLeads = filteredLeads.reduce((acc, lead) => {
    const email = lead.email || 'sem-email';
    if (!acc[email]) acc[email] = [];
    acc[email].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);

  if (loading) return <Loading message="Carregando CRM de Leads..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-3">
                <Users className="text-indigo-600" size={32} />
                CRM de Leads
              </h1>
              <p className="text-slate-500 font-medium">Gerencie seus potenciais clientes e funil de vendas.</p>
            </div>
          </div>
          
    <div className="flex items-center gap-2">
            {selectedLeads.length > 0 && (
              <>
                <button 
                  onClick={() => setShowSendMessageModal(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
                >
                  <MessageCircle size={18} />
                  Enviar ({selectedLeads.length})
                </button>
                <button 
                  onClick={() => setBulkDeleteModal(true)}
                  className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-all flex items-center gap-2"
                >
                  <Trash2 size={18} />
                  Excluir ({selectedLeads.length})
                </button>
              </>
            )}
            <button 
              onClick={fetchLeads}
              className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Zap size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total de Leads</span>
          <p className="text-3xl font-black text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Leads Quentes</span>
          <p className="text-3xl font-black text-slate-900">{stats.hot}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-amber-500">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">Leads Mornos</span>
          <p className="text-3xl font-black text-slate-900">{stats.warm}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-blue-500">
          <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Leads Frios</span>
          <p className="text-3xl font-black text-slate-900">{stats.cold}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Clientes</span>
          <p className="text-3xl font-black text-slate-900">{stats.customers}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por nome, email ou whatsapp..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <Filter size={20} className="text-slate-400" />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 md:w-48 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-slate-600"
              >
                <option value="all">Todos os Status</option>
                <option value="quente">⚡ Quente</option>
                <option value="morno">🔥 Morno</option>
                <option value="frio">❄️ Frio</option>
                <option value="cliente">🛍️ Cliente</option>
                <option value="inativo">💤 Inativo</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tags</label>
              <input 
                type="text" 
                placeholder="Filtrar por tag..."
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Criação (De)</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Criação (Até)</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interação (De)</label>
              <input 
                type="date" 
                value={interactionStartDate}
                onChange={(e) => setInteractionStartDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Interação (Até)</label>
              <input 
                type="date" 
                value={interactionEndDate}
                onChange={(e) => setInteractionEndDate(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Score</th>
                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Última Atividade</th>
                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(groupedLeads).map(([email, leads]) => {
                const allSelected = leads.every(l => selectedLeads.includes(l.id));
                const someSelected = leads.some(l => selectedLeads.includes(l.id));
                const isExpanded = expandedEmails.includes(email);
                
                return (
                  <tr key={email} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4" colSpan={6}>
                      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                        {/* Header do Card Unificado */}
                        <div 
                          className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100/50 transition-colors"
                          onClick={() => toggleExpand(email)}
                        >
                          <div className="flex items-center gap-4">
                            <div onClick={(e) => e.stopPropagation()}>
                              <input 
                                type="checkbox" 
                                checked={allSelected}
                                ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                                onChange={() => {
                                  if (allSelected) {
                                    setSelectedLeads(prev => prev.filter(id => !leads.map(l => l.id).includes(id)));
                                  } else {
                                    setSelectedLeads(prev => [...new Set([...prev, ...leads.map(l => l.id)])]);
                                  }
                                }}
                                className="w-5 h-5 rounded-lg border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>
                            <div>
                              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                <Mail size={18} className="text-indigo-500" />
                                {email}
                              </h3>
                              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                                {leads.length} {leads.length === 1 ? 'Registro encontrado' : 'Registros encontrados'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter">
                              Lead Unificado
                            </span>
                            {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                          </div>
                        </div>

                        {/* Lista de Leads dentro do Card (Collapsible) */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="divide-y divide-slate-50">
                                {leads.map(lead => (
                                  <div key={lead.id} className="p-6 hover:bg-slate-50/30 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                                    <div className="flex items-center gap-4 flex-1">
                                      <input 
                                        type="checkbox" 
                                        checked={selectedLeads.includes(lead.id)} 
                                        onChange={() => toggleLeadSelection(lead.id)}
                                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                      />
                                      <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-sm">
                                        {lead.nome?.charAt(0).toUpperCase() || '?'}
                                      </div>
                                      <div>
                                        <p className="font-black text-slate-900 text-base">{lead.nome || 'Sem nome'}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                          {getStatusBadge(lead.status_lead)}
                                          <span className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                                            <Calendar size={12} />
                                            {format(new Date(lead.created_at), "dd MMM yyyy", { locale: ptBR })}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-8 flex-[2]">
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">WhatsApp</span>
                                        <div className="flex items-center gap-2 text-slate-600 font-bold text-sm">
                                          <Phone size={14} className="text-emerald-500" />
                                          {lead.whatsapp || 'Não informado'}
                                        </div>
                                      </div>
                                      
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Score</span>
                                        <div className="flex items-center gap-2 text-slate-900 font-black text-sm">
                                          <Star size={14} className="text-amber-400 fill-amber-400" />
                                          {lead.score || 0} pts
                                        </div>
                                      </div>

                                      <div className="space-y-1">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Tags</span>
                                        <div className="flex flex-wrap gap-1">
                                          {lead.tags && lead.tags.length > 0 ? (
                                            lead.tags.map(tag => (
                                              <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold">
                                                {tag}
                                              </span>
                                            ))
                                          ) : (
                                            <span className="text-[10px] text-slate-300 font-medium italic">Nenhuma tag</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 justify-end">
                                      <button 
                                        onClick={() => setConfirmModal({ isOpen: true, leadId: lead.id, leadName: lead.nome || 'este lead' })}
                                        className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                        title="Excluir Lead"
                                      >
                                        <Trash2 size={20} />
                                      </button>
                                      <button 
                                        className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                                        title="Ver Detalhes"
                                      >
                                        <ExternalLink size={20} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">Nenhum lead encontrado com os filtros atuais.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => confirmModal.leadId && handleDeleteLead(confirmModal.leadId)}
        title="Excluir Lead"
        message={`Tem certeza que deseja excluir o lead "${confirmModal.leadName}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={bulkDeleteModal}
        onClose={() => setBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Excluir Leads Selecionados"
        message={`Tem certeza que deseja excluir os ${selectedLeads.length} leads selecionados? Esta ação não pode ser desfeita.`}
        confirmText="Excluir Tudo"
        variant="danger"
      />

      {showSendMessageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-3xl shadow-xl w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Enviar Mensagem</h2>
            <textarea 
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl mb-4"
              rows={4}
              placeholder="Digite sua mensagem..."
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSendMessageModal(false)} className="px-4 py-2 text-slate-600">Cancelar</button>
              <button onClick={sendMessageToSelected} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold">Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
