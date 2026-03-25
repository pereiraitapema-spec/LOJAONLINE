import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { LogOut, User, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, ShoppingCart, Megaphone, Users, CreditCard, Truck, Zap, History, Eye, TrendingUp, Calendar, DollarSign, FileText, Share2, MessageSquare, Bot, Play, ArrowLeft } from 'lucide-react';
import SmartChat from '../components/SmartChat';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { PurchaseSimulator } from '../components/PurchaseSimulator';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  const [stats, setStats] = useState({
    revenue: 0,
    cost: 0,
    cogs: 0,
    profit: 0,
    totalCommissions: 0,
    totalTaxes: 0,
    totalMarketing: 0,
    totalOperational: 0,
    totalShipping: 0,
    stockValue: 0,
    stockRetailValue: 0,
    projectedProfit: 0,
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

        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profileData?.role !== 'admin' && session.user.email !== 'pereira.itapema@gmail.com') {
          toast.error('Acesso negado.');
          navigate('/');
          return;
        }

        setUser(session.user);

        // Fetch all necessary data for stats
        const [ordersRes, productsRes, affiliatesRes, profilesRes] = await Promise.all([
          supabase.from('orders')
            .select('*')
            .eq('status', 'paid')
            .gte('created_at', `${dateRange.start}T00:00:00Z`)
            .lte('created_at', `${dateRange.end}T23:59:59Z`),
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

        // Calculate Costs
        const totalCommissions = orders.reduce((acc, o) => acc + (o.commission_value || 0), 0);
        const totalOperational = orders.reduce((acc, o) => acc + (o.operational_cost || 0), 0);
        const totalMarketing = orders.reduce((acc, o) => acc + (o.marketing_cost || 0), 0);
        const totalShipping = orders.reduce((acc, o) => acc + (o.shipping_cost || 0), 0);
        
        // Let's try to get a more accurate COGS (Cost of Goods Sold)
        let calculatedCOGS = 0;
        if (orders.length > 0) {
          const { data: items } = await supabase
            .from('order_items')
            .select('quantity, cost_price')
            .in('order_id', orders.map(o => o.id));
          
          calculatedCOGS = (items || []).reduce((acc, item: any) => acc + (item.quantity * (item.cost_price || 0)), 0);
        }

        // Simulating taxes (Nota Fiscal) for now, e.g., 6% of revenue
        const totalTaxes = revenue * 0.06;

        const totalExpenses = calculatedCOGS + totalCommissions + totalOperational + totalMarketing + totalShipping + totalTaxes;
        const profit = revenue - totalExpenses;
        
        // Stock Metrics
        const stockValue = products.reduce((acc, p) => acc + (p.stock * (p.cost_price || 0)), 0);
        const stockRetailValue = products.reduce((acc, p) => acc + (p.stock * (p.discount_price || p.price || 0)), 0);
        const projectedProfit = products.reduce((acc, p) => {
          const price = p.discount_price || p.price || 0;
          const cost = p.cost_price || 0;
          return acc + (p.stock * (price - cost));
        }, 0);

        // Ticket Average
        const directOrders = orders.filter(o => !o.affiliate_id);
        const affiliateOrders = orders.filter(o => o.affiliate_id);

        const avgTicket = orders.length > 0 ? revenue / orders.length : 0;
        const avgTicketDirect = directOrders.length > 0 ? directOrders.reduce((acc, o) => acc + o.total, 0) / directOrders.length : 0;
        const avgTicketAffiliate = affiliateOrders.length > 0 ? affiliateOrders.reduce((acc, o) => acc + o.total, 0) / affiliateOrders.length : 0;

        setStats({
          revenue,
          cost: totalExpenses,
          cogs: calculatedCOGS,
          profit,
          totalCommissions,
          totalTaxes,
          totalMarketing,
          totalOperational,
          totalShipping,
          stockValue,
          stockRetailValue,
          projectedProfit,
          affiliatesCount: affiliates.length,
          activeProducts: products.filter(p => p.active).length,
          newCustomers: new Set(orders.map(o => o.customer_email)).size,
          avgTicket,
          avgTicketDirect,
          avgTicketAffiliate
        });

      } catch (error) {
        console.error('❌ Dashboard Error detalhado:', error);
        toast.error('Erro ao carregar dados do dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, dateRange]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada');
    navigate('/login');
  };

  if (loading) return <Loading message="Carregando painel..." />;

  const menuGroups = [
    {
      title: "Faturamento",
      items: [
        { name: "Checkout", path: "/checkout", icon: ShoppingCart },
        { name: "Relatórios", path: "/reports", icon: FileText },
        { name: "Gateways", path: "/gateways", icon: CreditCard }
      ]
    },
    {
      title: "Vendas & Marketing",
      items: [
        { name: "Pedidos", path: "/orders", icon: ShoppingBag },
        { name: "Campanhas", path: "/campaigns", icon: Megaphone },
        { name: "Carrinhos Abandonados", path: "/abandoned-carts", icon: ShoppingCart },
        { name: "Afiliados", path: "/affiliates", icon: Users },
        { name: "Leads", path: "/leads", icon: Users }
      ]
    },
    {
      title: "Estoque",
      items: [
        { name: "Produtos", path: "/products", icon: Package },
        { name: "Estoque", path: "/inventory", icon: Package }
      ]
    },
    {
      title: "Sistema",
      items: [
        { name: "Banners", path: "/banners", icon: ImageIcon },
        { name: "Transportadoras", path: "/shipping", icon: Truck },
        { name: "Automações", path: "/automations", icon: Zap },
        { name: "Config. IA", path: "/ai-settings", icon: Bot },
        { name: "Configurações", path: "/settings", icon: Settings }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl">
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar para a Loja
          </button>

          {menuGroups.map((group) => (
            <div key={group.title}>
              <h3 className="px-4 text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{group.title}</h3>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => navigate(item.path)} 
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
                  >
                    <item.icon size={18} /> {item.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
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
      <main className="flex-1 p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.user_metadata?.full_name || user?.email}</h1>
            <p className="text-slate-500">Bem-vindo ao seu painel de controle.</p>
          </div>
          
          {/* Simulador de Compras */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
            <span className="text-sm font-bold text-slate-600">Área de Testes:</span>
            <PurchaseSimulator userId={user?.id} />
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 bg-white p-2 px-4 rounded-2xl shadow-sm border border-slate-100">
              <Calendar size={18} className="text-slate-400" />
              <div className="flex items-center gap-2">
                <input 
                  type="date" 
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="text-xs font-bold text-slate-600 bg-transparent border-none focus:ring-0 p-0"
                />
                <span className="text-slate-300">|</span>
                <input 
                  type="date" 
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="text-xs font-bold text-slate-600 bg-transparent border-none focus:ring-0 p-0"
                />
              </div>
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
        </div>
      </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/orders')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-200 transition-all"
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
            onClick={() => navigate('/inventory')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lucro Líquido</span>
            </div>
            <p className="text-2xl font-black text-indigo-600">R$ {stats.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">RECEITA - TODOS OS CUSTOS</p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/inventory')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Produtos</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.cogs.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">VALOR DE CUSTO (COGS)</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/affiliates')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Users size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Comissões (Afiliados)</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.totalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">TOTAL PAGO AOS AFILIADOS</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/settings')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <FileText size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Impostos (NF)</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.totalTaxes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">ESTIMATIVA DE IMPOSTOS</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/campaigns')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Megaphone size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Marketing (Ads)</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.totalMarketing.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">CUSTO DE AQUISIÇÃO (CAC)</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/orders')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Settings size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo Operacional</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.totalOperational.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">EMBALAGEM, MANUSEIO, ETC</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/shipping')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Truck size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Frete</span>
            </div>
            <p className="text-2xl font-black text-slate-900">R$ {stats.totalShipping.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">PAGO ÀS TRANSPORTADORAS</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/inventory')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-amber-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Package size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estoque (Custo)</span>
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

          <div 
            onClick={() => navigate('/affiliates')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-indigo-200 transition-all"
          >
            <Users className="text-indigo-600 mb-2" size={32} />
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Afiliados Cadastrados</h3>
            <p className="text-4xl font-black text-slate-900">{stats.affiliatesCount}</p>
          </div>

          <div 
            onClick={() => navigate('/products')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col justify-center items-center text-center cursor-pointer hover:border-amber-200 transition-all"
          >
            <Zap className="text-amber-500 mb-2" size={32} />
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">Produtos Ativos</h3>
            <p className="text-4xl font-black text-slate-900">{stats.activeProducts}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
