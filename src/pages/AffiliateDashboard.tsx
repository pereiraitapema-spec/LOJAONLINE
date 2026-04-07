import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBag, DollarSign, Link as LinkIcon, Copy, 
  LogOut, User, BarChart, Tag, Percent, ArrowRight, ArrowLeft, Clock,
  ChevronRight, Package, Grid, Trash2, CheckCircle, Calendar, Info, TrendingUp, Filter, Users
} from 'lucide-react';
import { Loading } from '../components/Loading';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { motion, AnimatePresence } from 'motion/react';
import SmartChat from '../components/SmartChat';
import { formatCurrency, formatDate, withTimeout } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  price: number;
  discount_price: number | null;
  image_url: string;
  category_id: string;
  affiliate_commission?: number;
}

interface Category {
  id: string;
  name: string;
}

interface AffiliateData {
  id: string;
  name: string;
  email: string;
  whatsapp?: string;
  code?: string;
  commission_rate: number;
  status: string;
  balance: number;
  total_paid?: number;
  pix_key?: string;
  pix_name?: string;
  pix_cpf?: string;
  pix_bank?: string;
  pix_account?: string;
  pix_agency?: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  receipt_url?: string;
  created_at: string;
  paid_at?: string;
}

interface Coupon {
  id: string;
  code: string;
  discount_percentage: number;
  active: boolean;
  created_at: string;
}

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  total: number;
  commission_value: number;
  status: string;
}

interface Lead {
  id: string;
  email: string;
  nome: string | null;
  phone?: string | null;
  status_lead: string;
  score: number;
  ultimo_produto_comprado?: string;
  valor_total_gasto?: number;
  created_at: string;
  updated_at: string;
}

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'coupons' | 'sales' | 'payments' | 'leads'>('products');
  
  const [productStats, setProductStats] = useState<any[]>([]);
  
  const stats = useMemo(() => {
    const validOrders = orders.filter(o => ['paid', 'processing', 'shipped', 'delivered'].includes(o.status));
    const totalSales = validOrders.reduce((acc, o) => acc + o.total, 0);
    const totalCommission = validOrders.reduce((acc, o) => acc + (o.commission_value || 0), 0);
    const avgTicketCommission = validOrders.length > 0 ? totalCommission / validOrders.length : 0;
    const avgTicketSale = validOrders.length > 0 ? totalSales / validOrders.length : 0;

    const topProduct = productStats.length > 0 ? productStats[0] : null;

    return {
      totalSales,
      totalCommission,
      avgTicketCommission,
      avgTicketSale,
      topProduct,
      validOrdersCount: validOrders.length
    };
  }, [orders, productStats]);

  const leadsStats = useMemo(() => {
    return {
      total: leads.length,
      paid: leads.filter(l => l.status_lead === 'cliente').length,
      unpaid: leads.filter(l => l.status_lead !== 'cliente').length
    };
  }, [leads]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<'7' | '30' | '90' | 'all' | 'custom'>('30');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  
  // Estado para criação de cupom
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(5);
  const [creatingCoupon, setCreatingCoupon] = useState(false);
  
  // Estado para PIX
  const [pixData, setPixData] = useState({
    key: '',
    name: '',
    cpf: '',
    bank: '',
    account: '',
    agency: ''
  });
  const [savingPix, setSavingPix] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Helper para timeout em chamadas Supabase
  // Helper for timeouts

  useEffect(() => {
    checkAffiliateStatus();
    
    // Safety timeout to release loading state
    const safetyTimeout = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => clearTimeout(safetyTimeout);
  }, []);

  const checkAffiliateStatus = async () => {
    try {
      console.log('🛡️ Verificando status do afiliado...');
      const { data: { session } } = await withTimeout(supabase.auth.getSession());
      if (!session) {
        console.log('🚫 Sem sessão, redirecionando para login');
        navigate('/login');
        return;
      }

      // Buscar dados do afiliado em paralelo (por user_id e e-mail)
      console.log('⏱️ Buscando dados do afiliado em paralelo...');
      const [affById, affByEmail] = await Promise.all([
        withTimeout(supabase.from('affiliates').select('*').eq('user_id', session.user.id).maybeSingle(), 8000),
        session.user.email ? withTimeout(supabase.from('affiliates').select('*').eq('email', session.user.email).maybeSingle(), 8000) : Promise.resolve({ data: null, error: null })
      ]);

      let affiliateData = affById.data || affByEmail.data;

      if (affById.error) {
        console.error('❌ Erro ao buscar dados do afiliado:', affById.error);
        toast.error('Erro ao carregar dados da conta.');
        navigate('/');
        return;
      }

      if (!affiliateData) {
        console.log('🚫 Registro de afiliado não encontrado para o usuário:', session.user.id);
        toast.error('Conta de afiliado não encontrada.');
        navigate('/');
        return;
      }

      // Vincular o user_id se estiver faltando (background)
      if (!affiliateData.user_id) {
        console.log('🔗 Vinculando user_id ao registro de afiliado no dashboard...');
        supabase.from('affiliates').update({ user_id: session.user.id }).eq('id', affiliateData.id).then();
      }

      const isMasterAdmin = session.user.email === 'pereira.itapema@gmail.com';
      console.log('📊 Status do afiliado:', affiliateData.status, 'Ativo:', affiliateData.active, 'Master:', isMasterAdmin);
      
      const isApproved = affiliateData.status === 'approved' || affiliateData.active === true;
      
      if (!isApproved && !isMasterAdmin) {
        console.warn('⏳ Afiliado aguardando aprovação:', affiliateData.status);
        setIsPending(true);
        setAffiliate(affiliateData);
        setLoading(false);
        return;
      }

      setAffiliate(affiliateData);
      setPixData({
        key: affiliateData.pix_key || '',
        name: affiliateData.pix_name || '',
        cpf: affiliateData.pix_cpf || '',
        bank: affiliateData.pix_bank || '',
        account: affiliateData.pix_account || '',
        agency: affiliateData.pix_agency || ''
      });

      // Carregar dados iniciais em paralelo
      console.log('📦 Carregando dados iniciais em paralelo...');
      const [prodRes, catRes] = await Promise.all([
        withTimeout(supabase.from('products').select('*').eq('active', true), 8000),
        withTimeout(supabase.from('categories').select('*'), 8000)
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);

      // Carregar outros dados (não bloqueantes para a UI principal se possível, mas aqui mantemos o padrão)
      fetchCoupons(affiliateData.id);
      fetchOrders(affiliateData.id, dateRange);
      fetchPayments(affiliateData.id, dateRange);
      fetchLeads(affiliateData.id, dateRange);

    } catch (error: any) {
      console.error('❌ Erro crítico no dashboard:', error);
      toast.error('Erro ao carregar dashboard: ' + error.message);
      navigate('/');
    } finally {
      console.log('🏁 Finalizando carregamento do dashboard');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (affiliate) {
      fetchOrders(affiliate.id, dateRange);
      fetchPayments(affiliate.id, dateRange);
      fetchLeads(affiliate.id, dateRange);
    }
  }, [dateRange, startDate, endDate]);

  const fetchCoupons = async (affiliateId: string) => {
    const { data } = await supabase
      .from('affiliate_coupons')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    
    if (data) setCoupons(data);
  };

  const fetchOrders = async (affiliateId: string, range: string) => {
    let query = supabase
      .from('orders')
      .select('id, created_at, customer_name, total, commission_value, status, order_items(product_id, product_name, quantity, price)')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (range !== 'all') {
      if (range === 'custom') {
        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }
      } else {
        const days = parseInt(range);
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte('created_at', date.toISOString());
      }
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao buscar vendas:', error);
      return;
    }

    if (data) {
      const mappedOrders = data.map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        customer_name: order.customer_name || 'Cliente',
        total: order.total,
        commission_value: order.commission_value || 0,
        status: order.status,
        items: order.order_items || []
      }));
      setOrders(mappedOrders);

      // Calcular estatísticas por produto (Apenas pedidos válidos)
      const validStatuses = ['paid', 'processing', 'shipped', 'delivered'];
      const statsMap = new Map();
      data.forEach((order: any) => {
        if (validStatuses.includes(order.status)) {
          (order.order_items || []).forEach((item: any) => {
            const existing = statsMap.get(item.product_id) || { 
              id: item.product_id, 
              name: item.product_name, 
              quantity: 0, 
              total_value: 0, 
              total_commission: 0 
            };
            
            // Estimar comissão do item se não estiver gravada no item
            // (Idealmente a comissão deveria estar gravada no order_item ou order)
            // Como temos commission_value na order, vamos ratear ou usar a taxa do produto
            const itemCommission = (item.price * item.quantity * (affiliate?.commission_rate || 0)) / 100;

            existing.quantity += item.quantity;
            existing.total_value += (item.price * item.quantity);
            existing.total_commission += itemCommission;
            statsMap.set(item.product_id, existing);
          });
        }
      });
      setProductStats(Array.from(statsMap.values()).sort((a, b) => b.total_commission - a.total_commission));
    }
  };

  const fetchPayments = async (affiliateId: string, range: string) => {
    let query = supabase
      .from('affiliate_payments')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (range !== 'all') {
      if (range === 'custom') {
        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }
      } else {
        const days = parseInt(range);
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte('created_at', date.toISOString());
      }
    }

    const { data } = await query;
    if (data) setPayments(data);
  };

  const fetchLeads = async (affiliateId: string, range: string) => {
    let query = supabase
      .from('leads')
      .select('id, created_at, updated_at, nome, email, status_lead, score, ultimo_produto_comprado, valor_total_gasto')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });

    if (range !== 'all') {
      if (range === 'custom') {
        if (startDate) query = query.gte('created_at', new Date(startDate).toISOString());
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          query = query.lte('created_at', end.toISOString());
        }
      } else {
        const days = parseInt(range);
        const date = new Date();
        date.setDate(date.getDate() - days);
        query = query.gte('created_at', date.toISOString());
      }
    }

    const { data } = await query;
    if (data) setLeads(data);
  };

  const generateLink = (type: 'product' | 'category' | 'store', id?: string) => {
    if (!affiliate) return;
    
    const baseUrl = window.location.origin;
    // Usar o código do afiliado em vez do ID para o link ser mais amigável
    const ref = affiliate?.code || affiliate?.id;
    let url = `${baseUrl}/?ref=${ref}`;

    if (type === 'product' && id) {
      url += `&product=${id}`;
    } else if (type === 'category' && id) {
      url += `&category=${id}`;
    }

    navigator.clipboard.writeText(url);
    toast.success('Link copiado para a área de transferência!');
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliate) return;

    if (couponDiscount > 10) {
      toast.error('O desconto máximo permitido é 10%.');
      return;
    }

    setCreatingCoupon(true);
    
    try {
      const { data, error } = await supabase
        .from('affiliate_coupons')
        .insert([{
          affiliate_id: affiliate.id,
          code: couponCode.toUpperCase(),
          discount_percentage: couponDiscount,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Cupom ${couponCode.toUpperCase()} criado com sucesso!`);
      setCoupons([data, ...coupons]);
      setCouponCode('');
      
      // Gerar link com cupom automaticamente
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/?ref=${affiliate.code || affiliate.id}&coupon=${couponCode.toUpperCase()}`;
      navigator.clipboard.writeText(url);
      toast.success('Link com cupom copiado!');

    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar cupom.');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Cupom',
      message: 'Tem certeza que deseja excluir este cupom? Ele deixará de funcionar imediatamente.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const { error } = await supabase
            .from('affiliate_coupons')
            .delete()
            .eq('id', id);

          if (error) throw error;

          setCoupons(coupons.filter(c => c.id !== id));
          toast.success('Cupom excluído.');
        } catch (error: any) {
          toast.error('Erro ao excluir cupom.');
        }
      }
    });
  };

  const handleRequestWithdrawal = async () => {
    if (!affiliate || affiliate.balance <= 0) {
      toast.error('Você não possui saldo disponível para saque.');
      return;
    }

    if (!affiliate.pix_key) {
      toast.error('Por favor, cadastre sua chave PIX antes de solicitar o saque.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Solicitar Saque',
      message: `Deseja solicitar o saque de R$ ${affiliate.balance.toFixed(2)} para a chave PIX cadastrada?`,
      variant: 'info',
      onConfirm: async () => {
        setLoading(true);
        try {
          const { error } = await supabase
            .from('affiliate_payments')
            .insert([{
              affiliate_id: affiliate.id,
              amount: affiliate.balance,
              status: 'pending',
              pix_key: affiliate.pix_key,
              pix_name: affiliate.pix_name,
              pix_cpf: affiliate.pix_cpf,
              pix_bank: affiliate.pix_bank,
              pix_account: affiliate.pix_account,
              pix_agency: affiliate.pix_agency
            }]);

          if (error) throw error;

          // Descontar saldo
          const { error: updateError } = await supabase
            .from('affiliates')
            .update({ balance: 0 })
            .eq('id', affiliate.id);
            
          if (updateError) throw updateError;

          setAffiliate({ ...affiliate, balance: 0 });
          toast.success('Solicitação de saque enviada com sucesso!');
          fetchPayments(affiliate.id, dateRange);
        } catch (error: any) {
          toast.error('Erro ao solicitar saque: ' + error.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUpdatePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!affiliate) return;

    setSavingPix(true);
    try {
      const { error } = await supabase
        .from('affiliates')
        .update({ 
          pix_key: pixData.key,
          pix_name: pixData.name,
          pix_cpf: pixData.cpf,
          pix_bank: pixData.bank,
          pix_account: pixData.account,
          pix_agency: pixData.agency
        })
        .eq('id', affiliate.id);

      if (error) throw error;
      
      setAffiliate({ 
        ...affiliate, 
        pix_key: pixData.key,
        pix_name: pixData.name,
        pix_cpf: pixData.cpf,
        pix_bank: pixData.bank,
        pix_account: pixData.account,
        pix_agency: pixData.agency
      });
      toast.success('Dados PIX atualizados!');
    } catch (error: any) {
      toast.error('Erro ao atualizar PIX: ' + error.message);
    } finally {
      setSavingPix(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <Loading />;
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Clock size={40} className="text-amber-600" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Conta em Análise</h1>
          <p className="text-slate-600 mb-8">
            Olá, <span className="font-bold">{affiliate?.name}</span>! Sua solicitação para ser um afiliado está sendo analisada por nossa equipe. 
            Você receberá um e-mail assim que sua conta for aprovada.
          </p>
          <div className="space-y-4">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Voltar para a Loja
            </button>
            <button
              onClick={handleLogout}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={20} />
              Sair da Conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!affiliate) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Sidebar / Mobile Menu */}
      <div className="bg-emerald-900 text-white pb-8 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="bg-emerald-800 hover:bg-emerald-700 p-2 rounded-lg transition-colors flex items-center justify-center"
              title="Voltar para a Loja"
            >
              <ArrowLeft size={24} className="text-emerald-400" />
            </button>
            <div className="flex items-center gap-2">
              <div className="bg-emerald-800 p-2 rounded-lg">
                <User size={24} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="font-bold text-lg leading-tight">Painel do Afiliado</h1>
                <p className="text-xs text-emerald-400">Bem-vindo, {affiliate?.name}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-emerald-800/50 px-6 py-3 rounded-2xl border border-emerald-700">
            <div className="text-center">
              <span className="block text-[10px] text-emerald-300 uppercase tracking-wider font-bold">A Receber</span>
              <span className="block font-black text-lg">R$ {affiliate?.balance?.toFixed(2) || '0.00'}</span>
              <button 
                onClick={handleRequestWithdrawal}
                disabled={!affiliate || affiliate.balance <= 0}
                className="text-[9px] bg-emerald-700 hover:bg-emerald-600 px-2 py-0.5 rounded mt-1 transition-colors disabled:opacity-50 font-bold uppercase"
              >
                Solicitar Saque
              </button>
            </div>
            <div className="w-px h-8 bg-emerald-700 hidden sm:block"></div>
            <div className="text-center">
              <span className="block text-[10px] text-emerald-300 uppercase tracking-wider font-bold">Já Recebido</span>
              <span className="block font-black text-lg">R$ {affiliate?.total_paid?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="w-px h-8 bg-emerald-700 hidden sm:block"></div>
            <div className="text-center cursor-pointer hover:bg-emerald-700/50 p-1 rounded-lg transition-all" onClick={() => setShowCommissionModal(true)}>
              <span className="block text-[10px] text-emerald-300 uppercase tracking-wider font-bold flex items-center justify-center gap-1">
                Comissão <Info size={10} />
              </span>
              <span className="block font-black text-lg">{affiliate?.commission_rate}%</span>
            </div>
          </div>

          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm font-bold text-emerald-300 hover:text-white transition-colors"
          >
            <LogOut size={18} />
            Sair
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Link Geral de Afiliado */}
        {affiliate && (
          <div className="mb-8 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-6 text-white shadow-xl shadow-emerald-600/20 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                <LinkIcon size={24} />
              </div>
              <div>
                <h2 className="font-black text-xl uppercase italic tracking-tighter">Seu Link Geral da Loja</h2>
                <p className="text-emerald-100 text-sm">Divulgue a loja inteira e ganhe comissões em qualquer compra.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-1 md:w-64 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-3 text-sm font-mono truncate">
                {window.location.origin}/?ref={affiliate?.code || affiliate?.id}
              </div>
              <button 
                onClick={() => generateLink('store')}
                className="bg-white text-emerald-600 px-6 py-3 rounded-xl font-black uppercase tracking-wider hover:bg-emerald-50 transition-all flex items-center gap-2 shrink-0"
              >
                <Copy size={18} /> Copiar
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Top Product */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Top Produto (Comissão)</span>
            </div>
            {stats.topProduct ? (
              <div>
                <h3 className="font-black text-slate-900 text-lg truncate mb-1">{stats.topProduct.name}</h3>
                <p className="text-xs text-emerald-600 font-bold">R$ {stats.topProduct.total_commission.toFixed(2)} acumulados</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Sem vendas ainda</p>
            )}
          </div>

          {/* Ticket Médio Comissão */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <DollarSign size={20} />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio Comissão</span>
            </div>
            <h3 className="font-black text-slate-900 text-2xl">
              R$ {stats.avgTicketCommission.toFixed(2)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Média por venda paga</p>
          </div>

          {/* Ticket Médio Venda */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ticket Médio Venda</span>
            </div>
            <h3 className="font-black text-slate-900 text-2xl">
              R$ {stats.avgTicketSale.toFixed(2)}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold">Valor médio do pedido pago</p>
          </div>

      {/* Filtro de Período */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-center">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
            <Calendar size={20} />
          </div>
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex gap-1">
            {(['7', '30', '90', 'all', 'custom'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${dateRange === range ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                {range === 'all' ? 'Tudo' : range === 'custom' ? 'Personalizar' : `${range}D`}
              </button>
            ))}
          </div>
          
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <span className="text-slate-400 text-[10px]">até</span>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[10px] font-bold outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          )}
        </div>
      </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
          <button 
            onClick={() => setActiveTab('products')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'products' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <Package size={20} />
            Produtos
          </button>
          <button 
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'categories' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <Grid size={20} />
            Categorias
          </button>
          <button 
            onClick={() => setActiveTab('coupons')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'coupons' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <Tag size={20} />
            Meus Cupons
          </button>
          <button 
            onClick={() => setActiveTab('leads')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'leads' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <Users size={20} />
            Meus Leads
          </button>
          <button 
            onClick={() => setActiveTab('sales')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'sales' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <DollarSign size={20} />
            Minhas Vendas
          </button>
          <button 
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'payments' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
          >
            <CheckCircle size={20} />
            Pagamentos
          </button>
        </div>

        {/* Conteúdo */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 min-h-[500px]">
          
          {/* Aba Produtos */}
          {activeTab === 'products' && (
            <div>
              <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Gerar Links de Produtos</h2>
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    placeholder="Buscar produto..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-4 pr-10 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {products
                  .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                  .sort((a, b) => {
                    const rateA = a.affiliate_commission || affiliate?.commission_rate || 0;
                    const rateB = b.affiliate_commission || affiliate?.commission_rate || 0;
                    
                    // Primeiro ordena por maior taxa de comissão (%)
                    if (rateB !== rateA) return rateB - rateA;
                    
                    // Se as taxas forem iguais, ordena pelo maior ticket médio (preço)
                    const priceA = a.discount_price || a.price;
                    const priceB = b.discount_price || b.price;
                    return priceB - priceA;
                  })
                  .map(product => {
                    const price = product.discount_price || product.price;
                    // Use product specific commission or fallback to affiliate rate
                    const rate = product.affiliate_commission || affiliate?.commission_rate || 0;
                    const commission = (price * rate) / 100;
                    
                    return (
                      <div key={product.id} className="border border-slate-100 rounded-2xl p-4 flex gap-4 hover:shadow-md transition-shadow bg-white">
                        <div className="w-20 h-20 bg-slate-50 rounded-xl flex-shrink-0">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{product.name}</h3>
                          <div className="flex flex-col gap-1 mb-3">
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Preço: {formatCurrency(price)}</span>
                            <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg inline-block w-fit">
                              Comissão: {rate}% ({formatCurrency(commission)})
                            </span>
                          </div>
                          <button 
                            onClick={() => generateLink('product', product.id)}
                            className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                          >
                            <LinkIcon size={14} />
                            Copiar Link
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Aba Categorias */}
          {activeTab === 'categories' && (
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-6">Links por Categoria</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Link da Loja Inteira */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShoppingBag size={24} />
                  </div>
                  <h3 className="font-bold text-emerald-900 mb-2">Loja Completa</h3>
                  <p className="text-xs text-emerald-700 mb-4">Link para a página inicial da loja com seu código de afiliado.</p>
                  <button 
                    onClick={() => generateLink('store')}
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <LinkIcon size={14} />
                    Copiar Link
                  </button>
                </div>

                {categories.map(category => (
                  <div key={category.id} className="border border-slate-100 rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
                    <h3 className="font-bold text-slate-900 mb-4">{category.name}</h3>
                    <button 
                      onClick={() => generateLink('category', category.id)}
                      className="w-full bg-slate-900 text-white py-2 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <LinkIcon size={14} />
                      Copiar Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Aba Cupons */}
          {activeTab === 'coupons' && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl mb-8">
                <div className="flex gap-3">
                  <Info className="text-amber-600 shrink-0" size={20} />
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <strong>Regra de Comissão:</strong> Ao usar um cupom, metade da porcentagem de desconto é deduzida da sua comissão. 
                    <br />Ex: Cupom de 10% OFF → Desconto de 5% na sua taxa de comissão. O desconto máximo permitido é 10%.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Formulário de Criação */}
                <div>
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Criar Cupom</h2>
                    <p className="text-slate-500 text-sm">Crie cupons personalizados (Máx 10%).</p>
                  </div>

                  <form onSubmit={handleCreateCoupon} className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Código</label>
                        <div className="relative">
                          <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input 
                            type="text" 
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black uppercase tracking-widest text-lg"
                            placeholder="EX: DESCONTO10"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Desconto (%)</label>
                        <div className="relative">
                          <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input 
                            type="number" 
                            value={couponDiscount}
                            onChange={(e) => setCouponDiscount(Math.min(10, Math.max(1, parseInt(e.target.value) || 0)))}
                            className="w-full pl-12 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-bold text-lg"
                            min="1"
                            max="10"
                            required
                          />
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={creatingCoupon || !couponCode}
                        className="w-full bg-emerald-600 text-white py-3 rounded-xl font-black hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {creatingCoupon ? 'Gerando...' : 'Criar Cupom'} <ArrowRight size={20} />
                      </button>
                    </div>
                  </form>
                </div>

                {/* Lista de Cupons */}
                <div>
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Seus Cupons Ativos</h3>
                  <div className="space-y-3">
                    {coupons.length === 0 ? (
                      <p className="text-slate-500 text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        Nenhum cupom criado.
                      </p>
                    ) : (
                      coupons.map(coupon => (
                        <div key={coupon.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center hover:shadow-md transition-shadow">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-lg">{coupon.code}</span>
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">
                                {coupon.discount_percentage}% OFF
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1 font-mono truncate max-w-[200px]">
                              {window.location.origin}/?ref={affiliate.code || affiliate.id}&coupon={coupon.code}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                const url = `${window.location.origin}/?ref=${affiliate.code || affiliate.id}&coupon=${coupon.code}`;
                                navigator.clipboard.writeText(url);
                                toast.success('Link do cupom copiado!');
                              }}
                              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Copiar Link do Cupom"
                            >
                              <Copy size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteCoupon(coupon.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir Cupom"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Aba Leads */}
          {activeTab === 'leads' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Meus Leads</h2>
                <div className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-sm font-bold">
                  Total: {leads.length} leads
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Data</th>
                      <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Nome</th>
                      <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Produto</th>
                      <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Valor</th>
                      <th className="py-4 px-2 text-xs font-bold text-slate-400 uppercase tracking-wider">Status Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.length > 0 ? (
                      leads.map((lead) => (
                        <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-2 text-sm text-slate-600">{formatDate(lead.created_at)}</td>
                          <td className="py-4 px-2 text-sm font-bold text-slate-900">{lead.nome || 'N/A'}</td>
                          <td className="py-4 px-2 text-sm text-slate-600">{lead.ultimo_produto_comprado || '-'}</td>
                          <td className="py-4 px-2 text-sm font-bold text-slate-900">{formatCurrency(lead.valor_total_gasto || 0)}</td>
                          <td className="py-4 px-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                              lead.status_lead === 'cliente' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                            }`}>
                              {lead.status_lead === 'cliente' ? 'Pagou' : 'Não pagou'}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 italic">
                          Nenhum lead encontrado no período selecionado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aba Vendas */}
          {activeTab === 'sales' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Histórico de Vendas</h2>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">7 Dias</button>
                  <button className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">30 Dias</button>
                  <button className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold">Tudo</button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Cliente</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor Total</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sua Comissão</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Nenhuma venda registrada ainda.
                        </td>
                      </tr>
                    ) : (
                      orders.map(order => (
                        <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">
                            {order.customer_name}
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-emerald-600">
                            {formatCurrency(order.commission_value)}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                              order.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              'bg-slate-100 text-slate-800'
                            }`}>
                              {order.status === 'paid' ? 'Pago' : order.status === 'pending' ? 'Pendente' : order.status}
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

          {/* Aba Pagamentos */}
          {activeTab === 'payments' && (
            <div>
              <div className="mb-8">
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-6">Configuração de Recebimento</h2>
                
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 flex items-start gap-3">
                  <Info className="text-amber-600 shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="text-sm font-bold text-amber-900">Atenção aos Dados!</p>
                    <p className="text-xs text-amber-800">A conta bancária e a chave PIX devem estar obrigatoriamente no seu nome completo e CPF cadastrados. Não realizamos pagamentos para terceiros.</p>
                  </div>
                </div>

                <form onSubmit={handleUpdatePix} className="bg-slate-50 p-6 rounded-3xl border border-slate-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome Completo (Titular)</label>
                      <input 
                        type="text" 
                        value={pixData.name}
                        onChange={(e) => setPixData({ ...pixData, name: e.target.value })}
                        placeholder="Nome como consta no banco"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">CPF do Titular</label>
                      <input 
                        type="text" 
                        value={pixData.cpf}
                        onChange={(e) => setPixData({ ...pixData, cpf: e.target.value.replace(/\D/g, '') })}
                        placeholder="Apenas números"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        maxLength={11}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Banco</label>
                      <input 
                        type="text" 
                        value={pixData.bank}
                        onChange={(e) => setPixData({ ...pixData, bank: e.target.value })}
                        placeholder="Ex: Nubank, Itaú, Bradesco"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Chave PIX</label>
                      <input 
                        type="text" 
                        value={pixData.key}
                        onChange={(e) => setPixData({ ...pixData, key: e.target.value })}
                        placeholder="CPF, E-mail, Celular ou Aleatória"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Agência</label>
                      <input 
                        type="text" 
                        value={pixData.agency}
                        onChange={(e) => setPixData({ ...pixData, agency: e.target.value })}
                        placeholder="0001"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Conta com Dígito</label>
                      <input 
                        type="text" 
                        value={pixData.account}
                        onChange={(e) => setPixData({ ...pixData, account: e.target.value })}
                        placeholder="12345-6"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end">
                    <button 
                      type="submit"
                      disabled={savingPix}
                      className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {savingPix ? 'Salvando...' : 'Salvar Dados de Pagamento'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
                <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Histórico de Pagamentos</h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data Solicitação</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Valor</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Data Pagamento</th>
                      <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Nenhum pagamento registrado ainda.
                        </td>
                      </tr>
                    ) : (
                      payments.map(payment => (
                        <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {formatDate(payment.created_at)}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">
                            {formatCurrency(payment.amount)}
                          </td>
                          <td className="py-4 px-4">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase ${
                              payment.status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {payment.status === 'paid' ? 'Pago' : 'Pendente'}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            {payment.paid_at ? formatDate(payment.paid_at) : '-'}
                          </td>
                          <td className="py-4 px-4">
                            {payment.receipt_url ? (
                              <a 
                                href={payment.receipt_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-indigo-600 hover:underline text-xs font-bold flex items-center gap-1"
                              >
                                <LinkIcon size={14} /> Ver PIX
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Aguardando...</span>
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

        </div>
      </main>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />

      {/* Modal de Detalhes da Comissão */}
      <AnimatePresence>
        {showCommissionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto"
            onClick={() => setShowCommissionModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-600 text-white">
                <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">Detalhamento de Comissões</h2>
                  <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest">Baseado em vendas confirmadas</p>
                </div>
                <button onClick={() => setShowCommissionModal(false)} className="hover:rotate-90 transition-transform p-2 bg-white/10 rounded-xl">
                  <CheckCircle size={24} />
                </button>
              </div>

              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {productStats.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-500 font-bold">Nenhuma venda registrada no período.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-4 text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">
                      <div className="col-span-2">Produto</div>
                      <div className="text-center">Qtd</div>
                      <div className="text-right">Total Comissão</div>
                    </div>
                    {productStats.map((stat) => (
                      <div key={stat.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div className="col-span-2 flex-1">
                          <p className="font-bold text-slate-900 text-sm">{stat.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Venda Total: {formatCurrency(stat.total_value)}</p>
                        </div>
                        <div className="w-16 text-center">
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg text-xs font-black">
                            {stat.quantity}
                          </span>
                        </div>
                        <div className="w-32 text-right">
                          <p className="font-black text-emerald-600">{formatCurrency(stat.total_commission)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div>
                  <span className="block text-[10px] text-slate-400 font-black uppercase tracking-widest">Total Acumulado</span>
                  <span className="text-2xl font-black text-slate-900">
                    {formatCurrency(productStats.reduce((acc, s) => acc + s.total_commission, 0))}
                  </span>
                </div>
                <button
                  onClick={() => setShowCommissionModal(false)}
                  className="px-8 py-3 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
