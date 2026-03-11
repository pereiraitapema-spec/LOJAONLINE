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
  Trash2
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
      toast.success('Status do lead atualizado!');
      fetchLeads();
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const handleDeleteLead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Lead excluído com sucesso!');
      fetchLeads();
    } catch (error: any) {
      toast.error('Erro ao excluir lead: ' + error.message);
    }
  };

  // Group leads by email
  const groupedLeads = filteredLeads.reduce((acc, lead) => {
    const email = lead.email || 'sem-email';
    if (!acc[email]) acc[email] = [];
    acc[email].push(lead);
    return acc;
  }, {} as Record<string, Lead[]>);
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
              <button 
                onClick={() => setShowSendMessageModal(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2"
              >
                <MessageCircle size={18} />
                Enviar Mensagem ({selectedLeads.length})
              </button>
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
              {Object.entries(groupedLeads).map(([email, leads]) => (
                <tr key={email} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4" colSpan={6}>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <input 
                          type="checkbox" 
                          checked={selectedLeads.includes(leads[0].id)} 
                          onChange={() => toggleLeadSelection(leads[0].id)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <h3 className="font-bold text-slate-900">{email}</h3>
                      </div>
                      <div className="space-y-2">
                        {leads.map(lead => (
                          <div key={lead.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={selectedLeads.includes(lead.id)} 
                                onChange={() => toggleLeadSelection(lead.id)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center font-black text-xs">
                                {lead.nome?.charAt(0).toUpperCase() || '?'}
                              </div>
                              <p className="font-bold text-slate-900 text-sm">{lead.nome || 'Sem nome'}</p>
                              {getStatusBadge(lead.status_lead)}
                            </div>
                            <button 
                              onClick={() => setConfirmModal({ isOpen: true, leadId: lead.id, leadName: lead.nome || 'este lead' })}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir Lead"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
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
