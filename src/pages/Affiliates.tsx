import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Users, 
  Link as LinkIcon, 
  DollarSign, 
  Copy, 
  CheckCircle2, 
  ArrowLeft,
  Wallet,
  TrendingUp,
  Settings,
  Check,
  X,
  Edit2,
  Save,
  Upload,
  FileText,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  code: string;
  commission_rate: number;
  balance: number;
  total_paid?: number;
  pix_key: string;
  active: boolean;
  status: string;
  created_at: string;
}

interface Payment {
  id: string;
  affiliate_id: string;
  amount: number;
  status: string;
  receipt_url?: string;
  pix_key?: string;
  created_at: string;
  paid_at?: string;
  affiliate_name?: string;
}

interface Lead {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  status_lead: 'frio' | 'morno' | 'quente' | 'cliente' | 'inativo';
  score: number;
  created_at: string;
  updated_at: string;
}

export default function Affiliates() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Admin State
  const [affiliatesList, setAffiliatesList] = useState<AffiliateData[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRate, setEditRate] = useState<number>(0);
  const [selectedAffiliateForSales, setSelectedAffiliateForSales] = useState<string | null>(null);
  const [affiliateSales, setAffiliateSales] = useState<any[]>([]);
  const [salesFilter, setSalesFilter] = useState<'all' | '30days' | '7days'>('all');
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [leadsList, setLeadsList] = useState<Lead[]>([]);
  const [showPayments, setShowPayments] = useState(false);
  const [showLeads, setShowLeads] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState<string | null>(null);

  // User State
  const [affiliateData, setAffiliateData] = useState<AffiliateData | null>(null);
  const [copied, setCopied] = useState(false);
  const [pixKey, setPixKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [storeUrl, setStoreUrl] = useState(window.location.origin);

  useEffect(() => {
    checkUserRole();
  }, []);

  const checkUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Check if admin
      if (session.user.email === 'pereira.itapema@gmail.com') {
        setIsAdmin(true);
        fetchAllAffiliates();
        fetchPayments();
        fetchLeads();
      } else {
        fetchAffiliateData(session.user.id);
      }
    } catch (error) {
      console.error('Error checking role:', error);
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeadsList(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar leads:', error);
    }
  };

  const fetchAllAffiliates = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAffiliatesList(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar afiliados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAffiliateData = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setAffiliateData(data);
        setPixKey(data.pix_key || '');
        // Se aprovado, redirecionar para dashboard? 
        // Não, aqui é a página de "Status" ou "Cadastro". 
        // Mas se ele já é aprovado, talvez queira ver o dashboard.
        if (data.status === 'approved') {
            // Opcional: navigate('/affiliate-dashboard');
        }
      }
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Admin Actions
  const handleApprove = async (id: string, email: string) => {
    try {
      // Gerar código único se não existir
      const code = email.split('@')[0].toUpperCase().substring(0, 5) + Math.floor(Math.random() * 1000);

      const { error } = await supabase
        .from('affiliates')
        .update({ 
          status: 'approved', 
          active: true,
          code: code // Atribuir código ao aprovar
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Afiliado aprovado com sucesso!');
      fetchAllAffiliates();
    } catch (error: any) {
      toast.error('Erro ao aprovar: ' + error.message);
    }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Tem certeza que deseja reprovar este afiliado?')) return;
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ status: 'rejected', active: false })
        .eq('id', id);

      if (error) throw error;
      toast.success('Afiliado reprovado.');
      fetchAllAffiliates();
    } catch (error: any) {
      toast.error('Erro ao reprovar: ' + error.message);
    }
  };

  const handleUpdateRate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ commission_rate: editRate })
        .eq('id', id);

      if (error) throw error;
      toast.success('Comissão atualizada!');
      setEditingId(null);
      fetchAllAffiliates();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    }
  };

  const fetchAffiliateSales = async (affiliateId: string, filter: 'all' | '30days' | '7days' = 'all') => {
    try {
      let query = supabase
        .from('orders')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .order('created_at', { ascending: false });

      if (filter === '30days') {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        query = query.gte('created_at', date.toISOString());
      } else if (filter === '7days') {
        const date = new Date();
        date.setDate(date.getDate() - 7);
        query = query.gte('created_at', date.toISOString());
      }

      const { data, error } = await query;
      if (error) throw error;
      setAffiliateSales(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar vendas: ' + error.message);
    }
  };

  const handleViewSales = (affiliateId: string) => {
    if (selectedAffiliateForSales === affiliateId) {
      setSelectedAffiliateForSales(null);
      setAffiliateSales([]);
    } else {
      setSelectedAffiliateForSales(affiliateId);
      setSalesFilter('all');
      fetchAffiliateSales(affiliateId, 'all');
    }
  };

  const fetchPayments = async () => {
    try {
      const { data, error } = await supabase
        .from('affiliate_payments')
        .select(`
          *,
          affiliates (
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const mapped = data.map((p: any) => ({
        ...p,
        affiliate_name: p.affiliates?.name || 'Desconhecido'
      }));
      
      setPaymentsList(mapped);
    } catch (error: any) {
      console.error('Erro ao carregar pagamentos:', error);
    }
  };

  const handleUploadReceipt = async (paymentId: string, affiliateId: string, file: File) => {
    setUploadingReceipt(paymentId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `receipts/${paymentId}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('banners') // Usando o bucket existente 'banners' como solicitado
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      // Atualizar pagamento
      const { error: updateError } = await supabase
        .from('affiliate_payments')
        .update({
          status: 'paid',
          receipt_url: publicUrl,
          paid_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) throw updateError;

      // Atualizar saldo do afiliado
      const payment = paymentsList.find(p => p.id === paymentId);
      if (payment) {
        const { data: aff } = await supabase
          .from('affiliates')
          .select('balance, total_paid')
          .eq('id', affiliateId)
          .single();
        
        if (aff) {
          await supabase
            .from('affiliates')
            .update({
              balance: (aff.balance || 0) - payment.amount,
              total_paid: (aff.total_paid || 0) + payment.amount
            })
            .eq('id', affiliateId);
        }
      }

      toast.success('Pagamento realizado e comprovante enviado!');
      fetchPayments();
      fetchAllAffiliates();
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setUploadingReceipt(null);
    }
  };

  const handleUpdateLeadStatus = async (leadId: string, newStatus: Lead['status_lead']) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status_lead: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);

      if (error) throw error;
      
      setLeadsList(leadsList.map(l => l.id === leadId ? { ...l, status_lead: newStatus } : l));
      toast.success('Status do lead atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar lead: ' + error.message);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      
      setLeadsList(leadsList.filter(l => l.id !== leadId));
      toast.success('Lead excluído!');
    } catch (error: any) {
      toast.error('Erro ao excluir lead: ' + error.message);
    }
  };

  // User Actions
  const handleCreateAffiliate = async () => {
    // Redirecionar para o novo fluxo de cadastro
    navigate('/affiliate-register');
  };

  const handleUpdatePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliateData) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ pix_key: pixKey })
        .eq('id', affiliateData.id);

      if (error) throw error;
      
      setAffiliateData({ ...affiliateData, pix_key: pixKey });
      toast.success('Chave PIX atualizada!');
    } catch (error: any) {
      toast.error('Erro ao atualizar PIX: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!affiliateData || affiliateData.balance <= 0) {
      toast.error('Você não possui saldo disponível para saque.');
      return;
    }

    if (!affiliateData.pix_key) {
      toast.error('Por favor, cadastre sua chave PIX antes de solicitar o saque.');
      return;
    }

    if (!confirm(`Deseja solicitar o saque de R$ ${affiliateData.balance.toFixed(2)}?`)) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('affiliate_payments')
        .insert([{
          affiliate_id: affiliateData.id,
          amount: affiliateData.balance,
          status: 'pending',
          pix_key: affiliateData.pix_key
        }]);

      if (error) throw error;

      // Descontar saldo para evitar múltiplas solicitações
      const { error: updateError } = await supabase
        .from('affiliates')
        .update({ balance: 0 })
        .eq('id', affiliateData.id);
        
      if (updateError) throw updateError;

      setAffiliateData({ ...affiliateData, balance: 0 });
      toast.success('Solicitação de saque enviada com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao solicitar saque: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <Loading message="Carregando..." />;

  // --- ADMIN VIEW ---
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
              >
                <ArrowLeft size={18} />
                Voltar ao Dashboard
              </button>
              <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
                <Users className="text-indigo-600" />
                Gestão de Afiliados
              </h1>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => { setShowLeads(true); setShowPayments(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${showLeads ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}
              >
                <TrendingUp size={18} />
                CRM / Leads
              </button>
              <button 
                onClick={() => { setShowPayments(!showPayments); setShowLeads(false); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${showPayments ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200'}`}
              >
                <Wallet size={18} />
                {showPayments ? 'Ver Afiliados' : 'Gerenciar Pagamentos'}
              </button>
              <div className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
                <span className="text-sm font-bold text-slate-500">Total: {affiliatesList.length}</span>
              </div>
            </div>
          </div>

          {showLeads ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={24} className="text-indigo-600" />
                  Gestão de Leads (CRM)
                </h2>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-400"></span>
                    <span className="text-xs font-bold text-slate-500">Frio</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                    <span className="text-xs font-bold text-slate-500">Morno</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-400"></span>
                    <span className="text-xs font-bold text-slate-500">Quente</span>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Lead</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">WhatsApp</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Score</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Última Atividade</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {leadsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhum lead encontrado.
                        </td>
                      </tr>
                    ) : (
                      leadsList.map(lead => (
                        <tr key={lead.id} className="hover:bg-slate-50">
                          <td className="p-4">
                            <div className="font-bold text-slate-900">{lead.nome || 'Sem nome'}</div>
                            <div className="text-xs text-slate-500">{lead.email}</div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">{lead.whatsapp || '-'}</td>
                          <td className="p-4">
                            <select 
                              value={lead.status_lead}
                              onChange={(e) => handleUpdateLeadStatus(lead.id, e.target.value as Lead['status_lead'])}
                              className={`px-2 py-1 rounded-lg text-xs font-bold border-none outline-none cursor-pointer ${
                                lead.status_lead === 'frio' ? 'bg-blue-100 text-blue-800' :
                                lead.status_lead === 'morno' ? 'bg-amber-100 text-amber-800' :
                                lead.status_lead === 'quente' ? 'bg-red-100 text-red-800' :
                                lead.status_lead === 'cliente' ? 'bg-emerald-100 text-emerald-800' :
                                'bg-slate-100 text-slate-800'
                              }`}
                            >
                              <option value="frio">Lead Frio (Curioso)</option>
                              <option value="morno">Lead Morno (Formulário)</option>
                              <option value="quente">Lead Quente (Interesse Real)</option>
                              <option value="cliente">Cliente (Fechou)</option>
                              <option value="inativo">Inativo</option>
                            </select>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${
                                    lead.score >= 80 ? 'bg-emerald-500' :
                                    lead.score >= 40 ? 'bg-amber-500' : 'bg-blue-500'
                                  }`}
                                  style={{ width: `${Math.min(100, lead.score)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-bold text-slate-600">{lead.score}</span>
                            </div>
                          </td>
                          <td className="p-4 text-xs text-slate-500">
                            {new Date(lead.updated_at || lead.created_at).toLocaleString()}
                          </td>
                          <td className="p-4">
                            <button 
                              onClick={() => handleDeleteLead(lead.id)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                              title="Excluir Lead"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : !showPayments ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Nome / Email</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">WhatsApp</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Comissão (%)</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">A Receber</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Total Pago</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {affiliatesList.map(aff => (
                      <tr key={aff.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{aff.name}</div>
                          <div className="text-xs text-slate-500">{aff.email}</div>
                        </td>
                        <td className="p-4 text-sm text-slate-600">{aff.whatsapp || '-'}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                            aff.status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                            aff.status === 'rejected' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-800'
                          }`}>
                            {aff.status === 'approved' ? 'Aprovado' : 
                             aff.status === 'rejected' ? 'Reprovado' : 'Pendente'}
                          </span>
                        </td>
                        <td className="p-4">
                          {editingId === aff.id ? (
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" 
                                value={editRate}
                                onChange={(e) => setEditRate(Number(e.target.value))}
                                className="w-16 p-1 border rounded"
                              />
                              <button onClick={() => handleUpdateRate(aff.id)} className="text-emerald-600"><Save size={16} /></button>
                              <button onClick={() => setEditingId(null)} className="text-red-600"><X size={16} /></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{aff.commission_rate}%</span>
                              <button onClick={() => { setEditingId(aff.id); setEditRate(aff.commission_rate); }} className="text-slate-400 hover:text-indigo-600">
                                <Edit2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-sm text-indigo-600 font-bold">R$ {aff.balance.toFixed(2)}</td>
                        <td className="p-4 font-mono text-sm text-slate-500">R$ {(aff.total_paid || 0).toFixed(2)}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {aff.status === 'pending' && (
                              <>
                                <button 
                                  onClick={() => handleApprove(aff.id, aff.email)}
                                  className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200"
                                  title="Aprovar"
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  onClick={() => handleReject(aff.id)}
                                  className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                                  title="Reprovar"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                            {aff.status === 'approved' && (
                              <>
                                <button 
                                  onClick={() => handleViewSales(aff.id)}
                                  className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200"
                                  title="Ver Vendas"
                                >
                                  <DollarSign size={16} />
                                </button>
                                <button 
                                  onClick={() => handleReject(aff.id)}
                                  className="text-xs text-red-600 hover:underline ml-2"
                                >
                                  Suspender
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Wallet size={24} className="text-indigo-600" />
                  Solicitações de Pagamento
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Afiliado</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Valor</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Chave PIX</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paymentsList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhuma solicitação de pagamento encontrada.
                        </td>
                      </tr>
                    ) : (
                      paymentsList.map(payment => (
                        <tr key={payment.id} className="hover:bg-slate-50">
                          <td className="p-4 text-sm text-slate-600">
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-bold text-slate-900">
                            {payment.affiliate_name}
                          </td>
                          <td className="p-4 font-bold text-indigo-600">
                            R$ {payment.amount.toFixed(2)}
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {payment.pix_key || 'Não informada'}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                              payment.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {payment.status === 'paid' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="p-4">
                            {payment.status === 'pending' ? (
                              <div className="flex items-center gap-2">
                                <label className={`cursor-pointer p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-xs font-bold ${uploadingReceipt === payment.id ? 'opacity-50 pointer-events-none' : ''}`}>
                                  <Upload size={14} />
                                  {uploadingReceipt === payment.id ? 'Enviando...' : 'Pagar & Enviar Comprovante'}
                                  <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleUploadReceipt(payment.id, payment.affiliate_id, file);
                                    }}
                                  />
                                </label>
                              </div>
                            ) : (
                              <a 
                                href={payment.receipt_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-indigo-600 hover:underline text-xs font-bold"
                              >
                                <FileText size={14} /> Ver Comprovante
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tabela de Vendas do Afiliado Selecionado */}
          {selectedAffiliateForSales && (
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-indigo-50">
                <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                  <DollarSign size={24} />
                  Vendas do Afiliado: {affiliatesList.find(a => a.id === selectedAffiliateForSales)?.name}
                </h2>
                <div className="flex gap-2">
                  <select 
                    value={salesFilter}
                    onChange={(e) => {
                      const filter = e.target.value as 'all' | '30days' | '7days';
                      setSalesFilter(filter);
                      fetchAffiliateSales(selectedAffiliateForSales, filter);
                    }}
                    className="px-4 py-2 bg-white border border-indigo-200 rounded-lg text-sm font-bold text-indigo-700 outline-none"
                  >
                    <option value="all">Todo o Período</option>
                    <option value="30days">Últimos 30 dias</option>
                    <option value="7days">Últimos 7 dias</option>
                  </select>
                  <button 
                    onClick={() => setSelectedAffiliateForSales(null)}
                    className="p-2 bg-white text-slate-500 rounded-lg border border-slate-200 hover:bg-slate-50"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Data</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Cliente</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Valor Total</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Comissão Gerada</th>
                      <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status do Pedido</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {affiliateSales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          Nenhuma venda encontrada para este período.
                        </td>
                      </tr>
                    ) : (
                      affiliateSales.map(sale => (
                        <tr key={sale.id} className="hover:bg-slate-50">
                          <td className="p-4 text-sm text-slate-600">
                            {new Date(sale.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4 font-bold text-slate-900">
                            {sale.customer_name}
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            R$ {sale.total.toFixed(2)}
                          </td>
                          <td className="p-4 font-bold text-emerald-600">
                            R$ {(sale.commission_value || 0).toFixed(2)}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${
                              sale.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              sale.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {sale.status === 'paid' ? 'Pago' : sale.status === 'pending' ? 'Pendente' : sale.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- USER VIEW ---
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
          >
            <ArrowLeft size={18} />
            Voltar ao Painel
          </button>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="text-indigo-600" />
            Painel de Afiliados
          </h1>
          <p className="text-slate-500 mt-2">Gerencie seus links, comissões e pagamentos.</p>
        </div>

        {!affiliateData ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-8 md:p-12 text-center shadow-sm border border-slate-100"
          >
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-10 h-10 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Torne-se um Afiliado</h2>
            <p className="text-slate-600 mb-8 max-w-lg mx-auto">
              Ganhe comissões indicando nossos produtos. Crie sua conta de afiliado agora mesmo e comece a compartilhar seu link exclusivo.
            </p>
            <button
              onClick={handleCreateAffiliate}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              Quero ser um Afiliado
            </button>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {/* Status Warning if Pending */}
            {affiliateData.status === 'pending' && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-center gap-4">
                <div className="bg-amber-100 p-3 rounded-full text-amber-600">
                  <Settings size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-amber-800 text-lg">Conta em Análise</h3>
                  <p className="text-amber-700">Sua conta de afiliado está sendo analisada por nossa equipe. Você será notificado assim que for aprovada.</p>
                </div>
              </div>
            )}

            {/* Cards de Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saldo Disponível</p>
                    <h3 className="text-2xl font-black text-slate-900">R$ {affiliateData.balance.toFixed(2)}</h3>
                  </div>
                </div>
                <button 
                  onClick={handleRequestWithdrawal}
                  disabled={saving || affiliateData.balance <= 0}
                  className="w-full py-2 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-colors text-sm disabled:opacity-50"
                >
                  {saving ? 'Processando...' : 'Solicitar Saque'}
                </button>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Taxa de Comissão</p>
                    <h3 className="text-2xl font-black text-slate-900">{affiliateData.commission_rate}%</h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium">Por cada venda aprovada</p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
                    <Users size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Status da Conta</p>
                    <h3 className="text-2xl font-black text-slate-900">
                      {affiliateData.status === 'approved' ? 'Ativa' : 'Pendente'}
                    </h3>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium">Código: <span className="font-bold text-slate-900">{affiliateData.code || '...'}</span></p>
              </motion.div>
            </div>

            {affiliateData.status === 'approved' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Link de Afiliado */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <LinkIcon className="text-indigo-600" size={24} />
                    <h3 className="text-xl font-bold text-slate-900">Seu Link Exclusivo</h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    Compartilhe este link em suas redes sociais. Qualquer compra feita através dele gerará comissão para você.
                  </p>
                  
                  <div className="flex items-center gap-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                    <code className="flex-1 text-sm text-slate-800 break-all">
                      {storeUrl}/?ref={affiliateData.code}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`${storeUrl}/?ref=${affiliateData.code}`)}
                      className="p-3 bg-white rounded-xl text-indigo-600 hover:bg-indigo-50 shadow-sm transition-colors flex-shrink-0"
                      title="Copiar Link"
                    >
                      {copied ? <CheckCircle2 size={20} className="text-emerald-500" /> : <Copy size={20} />}
                    </button>
                  </div>
                  
                  <div className="mt-6">
                     <button
                        onClick={() => navigate('/affiliate-dashboard')}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                     >
                        Acessar Painel Completo de Afiliado
                     </button>
                  </div>
                </motion.div>

                {/* Configurações de Pagamento */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Settings className="text-indigo-600" size={24} />
                    <h3 className="text-xl font-bold text-slate-900">Dados de Pagamento</h3>
                  </div>
                  <p className="text-slate-600 mb-6">
                    Cadastre sua chave PIX para receber suas comissões quando solicitar o saque.
                  </p>
                  
                  <form onSubmit={handleUpdatePix} className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Chave PIX</label>
                      <input
                        type="text"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="CPF, E-mail, Telefone ou Chave Aleatória"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={saving || pixKey === affiliateData.pix_key}
                      className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {saving ? 'Salvando...' : 'Salvar Chave PIX'}
                    </button>
                  </form>
                </motion.div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
