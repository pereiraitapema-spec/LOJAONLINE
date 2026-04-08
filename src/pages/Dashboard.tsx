import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { LogOut, User, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, ShoppingCart, Megaphone, Users, CreditCard, Truck, Zap, History, Eye, TrendingUp, Calendar, DollarSign, FileText, Share2, MessageSquare, Bot, Play, ArrowLeft, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import SmartChat from '../components/SmartChat';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { checkPermission } from '../lib/rbac';
import { formatCurrency } from '../lib/utils';


export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
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
    totalGatewayFees: 0,
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
    avgTicketAffiliate: 0,
    ordersPrepared: 0,
    ordersShipped: 0,
    ordersDelivered: 0,
    abandonedCount: 0,
    abandonedValue: 0,
    leadsCold: 0,
    leadsWarm: 0,
    leadsHot: 0
  });
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [openGroups, setOpenGroups] = useState<string[]>(['Faturamento']);
  const navigate = useNavigate();

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => 
      prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
    );
  };

  const fetchData = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/login');
          return;
        }

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        const isMaster = session.user.email === 'pereira.itapema@gmail.com';
        if (!isMaster && (!profileData || profileData.role !== 'admin')) {
          toast.error('Acesso negado.');
          navigate('/');
          return;
        }

        setUser(session.user);
        setProfile(profileData);

        // Define permissions in parallel
        const [permFaturamento, permVendas, permEstoque, permSistema] = await Promise.all([
          checkPermission(session.user.id, 'manager'),
          checkPermission(session.user.id, 'sales'),
          checkPermission(session.user.id, 'stock'),
          checkPermission(session.user.id, 'admin')
        ]);

        setPermissions({
          faturamento: permFaturamento,
          vendas: permVendas,
          estoque: permEstoque,
          sistema: permSistema
        });

        // Fetch all necessary data for stats in parallel with a timeout
        const fetchWithTimeout = async (promise: Promise<any>, timeout = 5000) => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
          );
          return Promise.race([promise, timeoutPromise]);
        };

        const [ordersRes, productsRes, affiliatesRes, abandonedRes, leadsRes, labelsRes] = await Promise.all([
          fetchWithTimeout(Promise.resolve(supabase.from('orders')
            .select('*, order_items(*)')
            .in('status', ['paid', 'processing', 'shipped', 'delivered'])
            .gte('created_at', `${dateRange.start}T00:00:00Z`)
            .lte('created_at', `${dateRange.end}T23:59:59Z`))),
          fetchWithTimeout(Promise.resolve(supabase.from('products').select('*'))),
          fetchWithTimeout(Promise.resolve(supabase.from('affiliates').select('*'))),
          fetchWithTimeout(Promise.resolve(supabase.from('abandoned_carts')
            .select('*')
            .gte('created_at', `${dateRange.start}T00:00:00Z`)
            .lte('created_at', `${dateRange.end}T23:59:59Z`))),
          fetchWithTimeout(Promise.resolve(supabase.from('leads').select('*'))),
          fetchWithTimeout(Promise.resolve(supabase.from('shipping_labels')
            .select('valor, order_id')
            .gte('created_at', `${dateRange.start}T00:00:00Z`)
            .lte('created_at', `${dateRange.end}T23:59:59Z`)))
        ]);

        const orders = ordersRes.data || [];
        const products = productsRes.data || [];
        const affiliates = affiliatesRes.data || [];
        const abandoned = abandonedRes.data || [];
        const leads = leadsRes.data || [];
        const labels = labelsRes.data || [];

        // Calculate Revenue
        const revenue = orders.reduce((acc, o) => acc + o.total, 0);

        // Calculate Costs
        const totalCommissions = orders.reduce((acc, o) => {
          // Se o valor da comissão estiver faltando ou parecer excessivo (> 50% do total), 
          // recalculamos com base na taxa do afiliado para garantir a precisão no dashboard.
          const aff = affiliates.find(a => a.id === o.affiliate_id);
          const rate = aff?.commission_rate || 20;
          
          // Se o valor armazenado for muito diferente do esperado (mais de 5% de margem), usamos o esperado
          const expected = (o.total * rate / 100);
          const current = o.commission_value || 0;
          
          if (Math.abs(current - expected) > (o.total * 0.05)) {
            return acc + expected;
          }
          
          return acc + current;
        }, 0);
        const totalShipping = orders.reduce((acc, o) => {
          // Busca o valor real da etiqueta se existir
          const label = labels.find(l => l.order_id === o.id);
          if (label && label.valor > 0) return acc + Number(label.valor);
          
          // Fallback: se não houver etiqueta, mas o cliente pagou frete, usamos esse valor como estimativa de custo
          // (ou poderíamos usar um custo médio se o frete foi grátis)
          return acc + (o.shipping_cost || 0);
        }, 0);
        
        // Calculate COGS (Cost of Goods Sold) based on items in the filtered orders
        let calculatedCOGS = 0;
        orders.forEach(order => {
          (order.order_items || []).forEach((item: any) => {
            const product = products.find(p => p.id === item.product_id);
            // Use actual cost_price if available, otherwise fallback to 40% of selling price
            const unitCost = product?.cost_price || (item.price * 0.4);
            calculatedCOGS += (item.quantity * unitCost);
          });
        });

        // Simulating taxes (Nota Fiscal) for now, e.g., 6% of revenue
        const totalTaxes = revenue * 0.06;
        
        // Simulating Gateway Fees (e.g., 4% average)
        const totalGatewayFees = revenue * 0.04;

        // Total expenses (Operational and Marketing removed as they don't exist in schema)
        const totalExpenses = calculatedCOGS + totalCommissions + totalShipping + totalTaxes + totalGatewayFees;
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

        // Shipping Stats (from filtered orders)
        const ordersPrepared = orders.filter(o => o.status === 'paid' || o.status === 'processing').length;
        const ordersShipped = orders.filter(o => o.status === 'shipped').length;
        const ordersDelivered = orders.filter(o => o.status === 'delivered').length;

        // Abandoned Carts
        const abandonedCount = abandoned.filter(c => c.status === 'abandoned').length;
        const abandonedValue = abandoned.filter(c => c.status === 'abandoned').reduce((acc, c) => acc + (c.total || 0), 0);

        // Leads
        const leadsCold = leads.filter(l => l.status_lead === 'frio').length;
        const leadsWarm = leads.filter(l => l.status_lead === 'morno').length;
        const leadsHot = leads.filter(l => l.status_lead === 'quente' || l.status_lead === 'cliente').length;

        // Top Products (based on filtered orders)
        const productSales: Record<string, { name: string, quantity: number, revenue: number }> = {};
        orders.forEach(order => {
          (order.order_items || []).forEach((item: any) => {
            const productId = item.product_id;
            const product = products.find(p => p.id === productId);
            const productName = product?.name || item.product_name || 'Produto Desconhecido';
            
            if (!productSales[productId]) {
              productSales[productId] = { name: productName, quantity: 0, revenue: 0 };
            }
            productSales[productId].quantity += item.quantity;
            productSales[productId].revenue += item.quantity * item.price;
          });
        });

        const sortedProducts = Object.values(productSales)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);

        setTopProducts(sortedProducts);

        setStats({
          revenue,
          cost: totalExpenses,
          cogs: calculatedCOGS,
          profit,
          totalCommissions,
          totalTaxes,
          totalGatewayFees,
          totalMarketing: 0,
          totalOperational: 0,
          totalShipping,
          stockValue,
          stockRetailValue,
          projectedProfit,
          affiliatesCount: affiliates.length,
          activeProducts: products.filter(p => p.active).length,
          newCustomers: new Set(orders.map(o => o.customer_email)).size,
          avgTicket,
          avgTicketDirect,
          avgTicketAffiliate,
          ordersPrepared,
          ordersShipped,
          ordersDelivered,
          abandonedCount,
          abandonedValue,
          leadsCold,
          leadsWarm,
          leadsHot
        });

      } catch (error) {
        console.error('❌ Dashboard Error detalhado:', error);
        toast.error('Erro ao carregar dados do dashboard.');
      } finally {
        setLoading(false);
      }
  }, [dateRange, navigate]);

  useEffect(() => {
    fetchData();

    // Real-time listeners
    const ordersChannel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        console.log('🔄 Pedidos atualizados, recarregando dashboard...');
        fetchData();
      })
      .subscribe();

    const leadsChannel = supabase
      .channel('dashboard-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        console.log('🔄 Leads atualizados, recarregando dashboard...');
        fetchData();
      })
      .subscribe();

    const affiliatesChannel = supabase
      .channel('dashboard-affiliates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'affiliates' }, () => {
        console.log('🔄 Afiliados atualizados, recarregando dashboard...');
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(affiliatesChannel);
    };
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada');
    navigate('/login');
  };

  if (loading) return <Loading message="Carregando painel..." />;

  const menuGroups = [
    {
      title: "Faturamento",
      permission: permissions.faturamento,
      items: [
        { name: "Gateways", path: "/gateways", icon: CreditCard }
      ]
    },
    {
      title: "Vendas & Marketing",
      permission: permissions.vendas,
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
      permission: permissions.estoque,
      items: [
        { name: "Produtos", path: "/products", icon: Package },
        { name: "Estoque", path: "/inventory", icon: Package }
      ]
    },
    {
      title: "Sistema",
      permission: permissions.sistema,
      items: [
        { name: "Banners", path: "/banners", icon: ImageIcon },
        { name: "Transportadoras", path: "/shipping", icon: Truck },
        { name: "Logística CepCerto", path: "/shipping/cepcerto", icon: Zap },
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
            group.permission && (
              <div key={group.title}>
                <button 
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-4 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 hover:text-indigo-600 transition-colors"
                >
                  {group.title}
                  {openGroups.includes(group.title) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {openGroups.includes(group.title) && (
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
                )}
              </div>
            )
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
            onClick={() => navigate('/gateways')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-emerald-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <ShoppingBag size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Faturamento Total</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.revenue)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">VENDAS PAGAS</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/gateways')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-indigo-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <TrendingUp size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lucro Líquido</span>
            </div>
            <p className={`text-2xl font-black ${stats.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(stats.profit)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">RECEITA - TODOS OS CUSTOS</p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/products')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <CreditCard size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo de Produtos</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.cogs)}</p>
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
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalCommissions)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">TOTAL PAGO AOS AFILIADOS</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/gateways')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <FileText size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Taxas e Impostos</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalTaxes + stats.totalGatewayFees)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold uppercase">NF (6%) + GATEWAY (4%)</p>
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
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalMarketing)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">CUSTO DE AQUISIÇÃO (CAC)</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/settings')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Settings size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Custo Operacional</span>
            </div>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalOperational)}</p>
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
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalShipping)}</p>
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
            <p className="text-2xl font-black text-slate-900">{formatCurrency(stats.stockValue)}</p>
            <p className="text-[10px] text-slate-400 mt-1 font-bold">VALOR DE CUSTO TOTAL</p>
          </motion.div>
        </div>

        {/* Novos Cards: Pedidos, Produtos Mais Vendidos, Carrinhos Abandonados e Leads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Card de Pedidos */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Truck size={20} />
                </div>
                <h3 className="text-slate-900 font-bold uppercase tracking-widest text-sm">Status de Pedidos (Logística)</h3>
              </div>
              <button onClick={() => navigate('/shipping/cepcerto')} className="text-xs font-bold text-blue-600 hover:underline">Ver Logística</button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <Clock className="mx-auto mb-2 text-amber-500" size={20} />
                <p className="text-2xl font-black text-slate-900">{stats.ordersPrepared}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Preparados</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <Truck className="mx-auto mb-2 text-blue-500" size={20} />
                <p className="text-2xl font-black text-slate-900">{stats.ordersShipped}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Em Trânsito</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl text-center">
                <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={20} />
                <p className="text-2xl font-black text-slate-900">{stats.ordersDelivered}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Entregues</p>
              </div>
            </div>
          </div>

          {/* Card de Produtos Mais Vendidos */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <TrendingUp size={20} />
                </div>
                <h3 className="text-slate-900 font-bold uppercase tracking-widest text-sm">Top 5 Produtos Mais Vendidos</h3>
              </div>
              <button onClick={() => navigate('/products')} className="text-xs font-bold text-amber-600 hover:underline">Ver Produtos</button>
            </div>
            <div className="space-y-3">
              {topProducts.length > 0 ? topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 flex items-center justify-center bg-white rounded-full text-[10px] font-black text-slate-400">{i + 1}</span>
                    <span className="text-sm font-bold text-slate-700 truncate max-w-[150px]">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-900">{p.quantity} un.</p>
                    <p className="text-[10px] font-bold text-emerald-600">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              )) : (
                <p className="text-center text-slate-400 text-sm py-4">Nenhuma venda registrada no período.</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Card de Carrinhos Abandonados */}
          <motion.div 
            whileHover={{ y: -5 }}
            onClick={() => navigate('/abandoned-carts')}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 cursor-pointer hover:border-rose-200 transition-all"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <ShoppingCart size={20} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Carrinhos Abandonados</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-black text-slate-900">{stats.abandonedCount}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Carrinhos Ativos</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-rose-600">{formatCurrency(stats.abandonedValue)}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Valor Potencial</p>
              </div>
            </div>
          </motion.div>

          {/* Card de Leads */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users size={20} />
                </div>
                <h3 className="text-slate-900 font-bold uppercase tracking-widest text-sm">Classificação de Leads</h3>
              </div>
              <button onClick={() => navigate('/leads')} className="text-xs font-bold text-indigo-600 hover:underline">Ver Todos Leads</button>
            </div>
            <div className="grid grid-cols-3 gap-6">
              <div className="relative p-4 bg-blue-50 rounded-2xl overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={40} /></div>
                <p className="text-2xl font-black text-blue-700">{stats.leadsCold}</p>
                <p className="text-xs font-bold text-blue-600 uppercase">Lead Frio</p>
                <p className="text-[9px] text-blue-400 mt-1">Apenas visitou o site</p>
              </div>
              <div className="relative p-4 bg-amber-50 rounded-2xl overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={40} /></div>
                <p className="text-2xl font-black text-amber-700">{stats.leadsWarm}</p>
                <p className="text-xs font-bold text-amber-600 uppercase">Lead Morno</p>
                <p className="text-[9px] text-amber-400 mt-1">Interagiu ou visualizou produtos</p>
              </div>
              <div className="relative p-4 bg-rose-50 rounded-2xl overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-10"><Zap size={40} /></div>
                <p className="text-2xl font-black text-rose-700">{stats.leadsHot}</p>
                <p className="text-xs font-bold text-rose-600 uppercase">Lead Quente</p>
                <p className="text-[9px] text-rose-400 mt-1">Iniciou checkout ou alta intenção</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <h3 className="text-slate-500 text-sm font-bold mb-4 uppercase tracking-widest">Ticket Médio</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Geral</span>
                <span className="font-bold text-slate-900">{formatCurrency(stats.avgTicket)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Direto</span>
                <span className="font-bold text-slate-900">{formatCurrency(stats.avgTicketDirect)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Afiliados</span>
                <span className="font-bold text-indigo-600">{formatCurrency(stats.avgTicketAffiliate)}</span>
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
