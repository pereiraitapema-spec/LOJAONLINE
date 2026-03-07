import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { 
  ShoppingBag, DollarSign, Link as LinkIcon, Copy, 
  LogOut, User, BarChart, Tag, Percent, ArrowRight,
  ChevronRight, Package, Grid, Trash2, CheckCircle
} from 'lucide-react';
import { motion } from 'motion/react';

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
  commission_rate: number;
  status: string;
  balance: number;
  total_paid?: number;
  pix_key?: string;
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

export default function AffiliateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'coupons' | 'sales' | 'payments'>('products');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estado para criação de cupom
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(5);
  const [creatingCoupon, setCreatingCoupon] = useState(false);

  useEffect(() => {
    checkAffiliateStatus();
  }, []);

  const checkAffiliateStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // Buscar dados do afiliado
      const { data: affiliateData, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error || !affiliateData) {
        toast.error('Conta de afiliado não encontrada.');
        navigate('/');
        return;
      }

      if (affiliateData.status !== 'approved') {
        toast.error('Sua conta ainda está em análise.');
        navigate('/'); // Ou uma página de "Em análise"
        return;
      }

      setAffiliate(affiliateData);

      // Carregar produtos e categorias
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').eq('active', true),
        supabase.from('categories').select('*')
      ]);

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);

      // Carregar cupons
      fetchCoupons(affiliateData.id);
      
      // Carregar vendas (orders)
      fetchOrders(affiliateData.id);

      // Carregar pagamentos
      fetchPayments(affiliateData.id);

      setLoading(false);

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
      setLoading(false);
    }
  };

  const fetchCoupons = async (affiliateId: string) => {
    const { data } = await supabase
      .from('affiliate_coupons')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    
    if (data) setCoupons(data);
  };

  const fetchOrders = async (affiliateId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    
    if (data) {
      const mappedOrders = data.map((order: any) => ({
        id: order.id,
        created_at: order.created_at,
        customer_name: order.customer_name || 'Cliente',
        total: order.total,
        commission_value: order.commission_value || 0,
        status: order.status
      }));
      setOrders(mappedOrders);
    }
  };

  const fetchPayments = async (affiliateId: string) => {
    const { data } = await supabase
      .from('affiliate_payments')
      .select('*')
      .eq('affiliate_id', affiliateId)
      .order('created_at', { ascending: false });
    
    if (data) setPayments(data);
  };

  const generateLink = (type: 'product' | 'category' | 'store', id?: string) => {
    if (!affiliate) return;
    
    const baseUrl = window.location.origin;
    let url = `${baseUrl}/?ref=${affiliate.id}`;

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
          code: couponCode,
          discount_percentage: couponDiscount,
          active: true
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success(`Cupom ${couponCode} criado com sucesso!`);
      setCoupons([data, ...coupons]);
      setCouponCode('');
      
      // Gerar link com cupom automaticamente
      const baseUrl = window.location.origin;
      const url = `${baseUrl}/?ref=${affiliate.id}&coupon=${couponCode}`;
      navigator.clipboard.writeText(url);
      toast.success('Link com cupom copiado!');

    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar cupom.');
    } finally {
      setCreatingCoupon(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cupom?')) return;

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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Carregando painel...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Sidebar / Mobile Menu */}
      <div className="bg-emerald-900 text-white pb-8 md:pb-0">
        <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-800 p-2 rounded-lg">
              <User size={24} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Painel do Afiliado</h1>
              <p className="text-xs text-emerald-400">Bem-vindo, {affiliate?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-emerald-800/50 px-6 py-3 rounded-2xl border border-emerald-700">
            <div className="text-center">
              <span className="block text-xs text-emerald-300 uppercase tracking-wider">A Receber</span>
              <span className="block font-black text-xl">R$ {affiliate?.balance?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="w-px h-8 bg-emerald-700"></div>
            <div className="text-center">
              <span className="block text-xs text-emerald-300 uppercase tracking-wider">Já Recebido</span>
              <span className="block font-black text-xl">R$ {affiliate?.total_paid?.toFixed(2) || '0.00'}</span>
            </div>
            <div className="w-px h-8 bg-emerald-700"></div>
            <div className="text-center">
              <span className="block text-xs text-emerald-300 uppercase tracking-wider">Comissão</span>
              <span className="block font-black text-xl">{affiliate?.commission_rate}%</span>
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
                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(product => {
                  const price = product.discount_price || product.price;
                  // Use product specific commission or 0
                  const rate = product.affiliate_commission || 0;
                  const commission = (price * rate) / 100;
                  
                  return (
                    <div key={product.id} className="border border-slate-100 rounded-2xl p-4 flex gap-4 hover:shadow-md transition-shadow">
                      <div className="w-20 h-20 bg-slate-50 rounded-xl flex-shrink-0">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-sm line-clamp-2 mb-1">{product.name}</h3>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-slate-500">Preço: R$ {price.toFixed(2)}</span>
                          <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Comissão: {rate}% (R$ {commission.toFixed(2)})
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
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-black text-slate-900 text-lg">{coupon.code}</span>
                              <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded-full">
                                {coupon.discount_percentage}% OFF
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Criado em {new Date(coupon.created_at).toLocaleDateString()}</p>
                          </div>
                          <button 
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir Cupom"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
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
                            {new Date(order.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">
                            {order.customer_name}
                          </td>
                          <td className="py-4 px-4 text-sm text-slate-600">
                            R$ {order.total.toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-emerald-600">
                            R$ {order.commission_value.toFixed(2)}
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
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-6">Histórico de Pagamentos</h2>
              
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
                            {new Date(payment.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-4 px-4 text-sm font-bold text-slate-900">
                            R$ {payment.amount.toFixed(2)}
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
                            {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '-'}
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
    </div>
  );
}
