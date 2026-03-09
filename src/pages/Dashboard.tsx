import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { LogOut, User, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, Megaphone, Users, CreditCard, Truck, Zap, History, Eye, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    revenue: 0,
    cost: 0,
    profit: 0,
    stockValue: 0,
    affiliatesCount: 0,
    activeProducts: 0,
    newCustomers: 0,
    avgTicket: 0,
    avgTicketDirect: 0,
    avgTicketAffiliate: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }

        if (session.user.email !== 'pereira.itapema@gmail.com') {
          toast.error('Acesso negado.');
          navigate('/');
          return;
        }

        setUser(session.user);

        // Fetch all necessary data for stats
        const [ordersRes, productsRes, affiliatesRes, profilesRes] = await Promise.all([
          supabase.from('orders').select('*').eq('status', 'paid'),
          supabase.from('products').select('*'),
          supabase.from('affiliates').select('*'),
          supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
        ]);

        if (profilesRes.data) setProfile(profilesRes.data);

        const orders = ordersRes.data || [];
        const products = productsRes.data || [];
        const affiliates = affiliatesRes.data || [];

        // Calculate Revenue
        const revenue = orders.reduce((acc, o) => acc + o.total, 0);

        // Calculate Cost (COGS) - using current cost_price as fallback
        // In a real scenario, cost_price should be stored in order_items at time of purchase
        const totalCost = orders.reduce((acc, o) => acc + (o.cost_value || 0), 0); 
        // Note: if cost_value is not in orders, we might need to fetch order_items
        
        // Let's try to get a more accurate cost if possible
        let calculatedCost = 0;
        if (orders.length > 0) {
          const { data: items } = await supabase.from('order_items').select('*, product:products(cost_price)').in('order_id', orders.map(o => o.id));
          calculatedCost = (items || []).reduce((acc, item: any) => acc + (item.quantity * (item.product?.cost_price || 0)), 0);
        }

        const profit = revenue - calculatedCost;
        const stockValue = products.reduce((acc, p) => acc + (p.stock * (p.cost_price || 0)), 0);

        // Ticket Average
        const directOrders = orders.filter(o => !o.affiliate_id);
        const affiliateOrders = orders.filter(o => o.affiliate_id);

        const avgTicket = orders.length > 0 ? revenue / orders.length : 0;
        const avgTicketDirect = directOrders.length > 0 ? directOrders.reduce((acc, o) => acc + o.total, 0) / directOrders.length : 0;
        const avgTicketAffiliate = affiliateOrders.length > 0 ? affiliateOrders.reduce((acc, o) => acc + o.total, 0) / affiliateOrders.length : 0;

        setStats({
          revenue,
          cost: calculatedCost,
          profit,
          stockValue,
          affiliatesCount: affiliates.length,
          activeProducts: products.filter(p => p.active).length,
          newCustomers: new Set(orders.map(o => o.customer_email)).size,
          avgTicket,
          avgTicketDirect,
          avgTicketAffiliate
        });

      } catch (error) {
        console.error('❌ Dashboard Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada');
    navigate('/login');
  };

  if (loading) return <Loading message="Carregando painel..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl">
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => window.open('/', '_blank')}
            className="w-full flex items-center gap-3 px-4 py-3 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl font-bold transition-all border border-indigo-100 mb-4"
          >
            <Eye size={20} />
            Visualizar Loja
          </button>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-600 text-white rounded-xl font-medium shadow-lg shadow-indigo-100"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => navigate('/banners')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <ImageIcon size={20} />
            Banners
          </button>
          <button 
            onClick={() => navigate('/campaigns')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Megaphone size={20} />
            Campanhas
          </button>
          <button 
            onClick={() => navigate('/products')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Package size={20} />
            Produtos
          </button>
          <button 
            onClick={() => navigate('/inventory')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <History size={20} />
            Estoque & Custos
          </button>
          <button 
            onClick={() => navigate('/orders')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <ShoppingBag size={20} />
            Pedidos
          </button>
          <button 
            onClick={() => navigate('/affiliates')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Users size={20} />
            Afiliados
          </button>
          <button 
            onClick={() => navigate('/gateways')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <CreditCard size={20} />
            Gateways
          </button>
          <button 
            onClick={() => navigate('/shipping')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Truck size={20} />
            Transportadoras
          </button>
          <button 
            onClick={() => navigate('/integrations')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Zap size={20} />
            Integrações
          </button>
          <button 
            onClick={() => navigate('/inventory')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <History size={20} />
            Estoque
          </button>
          <button 
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Settings size={20} />
            Configurações
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.user_metadata?.full_name || user?.email}</h1>
            <p className="text-slate-500">Bem-vindo ao seu painel de controle.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider">
                Administrador
              </span>
            )}
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-200 transition-colors overflow-hidden"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={20} />
              )}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Faturamento Total</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">VENDAS PAGAS</p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Vendas</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">CUSTO DE PRODUTOS (COGS)</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lucro Bruto</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">R$ {stats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">RECEITA - CUSTO</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Package size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor em Estoque</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.stockValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">VALOR DE CUSTO TOTAL</p>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-sm font-bold mb-4 uppercase tracking-widest">Ticket Médio</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Geral</span>
                <span className="font-bold text-slate-900">R$ {stats.avgTicket.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Direto</span>
                <span className="font-bold text-slate-900">R$ {stats.avgTicketDirect.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Afiliados</span>
                <span className="font-bold text-indigo-600">R$ {stats.avgTicketAffiliate.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <Users className="text-indigo-600 mb-2" size={32} />
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Afiliados Cadastrados</h3>
            <p className="text-4xl font-black text-slate-900">{stats.affiliatesCount}</p>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center">
            <Zap className="text-amber-500 mb-2" size={32} />
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Produtos Ativos</h3>
            <p className="text-4xl font-black text-slate-900">{stats.activeProducts}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
