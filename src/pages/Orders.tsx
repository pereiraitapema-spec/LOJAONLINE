import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Filter
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  payment_method: string;
  shipping_address: any;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  tracking_code?: string;
  shipping_method?: string;
}

interface AbandonedCart {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  cart_items: any[];
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFilter, setDateFilter] = useState(''); // '30', '60', '90', 'all'
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'abandoned'>('orders');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const userIsAdmin = session.user.email === 'pereira.itapema@gmail.com';
      setIsAdmin(userIsAdmin);

      if (activeTab === 'orders') {
        let query = supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!userIsAdmin) {
          query = query.eq('user_id', session.user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        setOrders(data || []);
      } else if (activeTab === 'abandoned' && userIsAdmin) {
        const { data, error } = await supabase
          .from('abandoned_carts')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        setAbandonedCarts(data || []);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    try {
      setLoadingItems(true);
      const { data, error } = await supabase
        .from('order_items')
        .select('*, product:products(image_url)')
        .eq('order_id', orderId);
      
      if (error) throw error;
      setOrderItems(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar itens: ' + error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      toast.success('Status do pedido atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const updateTrackingCode = async (orderId: string, trackingCode: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ tracking_code: trackingCode })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, tracking_code: trackingCode } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, tracking_code: trackingCode });
      }
      toast.success('Código de rastreio atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar rastreio: ' + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      case 'refunded': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'processing': return 'Em Processamento';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      case 'refunded': return 'Reembolsado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 size={16} />;
      case 'pending': return <Clock size={16} />;
      case 'processing': return <Package size={16} />;
      case 'shipped': return <Truck size={16} />;
      case 'delivered': return <CheckCircle2 size={16} />;
      case 'cancelled': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_email && order.customer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_document && order.customer_document.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    if (dateFilter) {
      const orderDate = new Date(order.created_at);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - orderDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (dateFilter === '30') matchesDate = diffDays <= 30;
      if (dateFilter === '60') matchesDate = diffDays <= 60;
      if (dateFilter === '90') matchesDate = diffDays <= 90;
      if (dateFilter === 'older_90') matchesDate = diffDays > 90; // Leads inativos
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) return <Loading message="Carregando pedidos..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
            >
              <ArrowLeft size={18} />
              Voltar ao Painel
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingBag className="text-indigo-600" />
              {activeTab === 'orders' ? (isAdmin ? 'Gestão de Pedidos' : 'Meus Pedidos') : 'Carrinhos Abandonados'}
            </h1>
          </div>

          {isAdmin && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('orders')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Pedidos
              </button>
              <button
                onClick={() => setActiveTab('abandoned')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'abandoned' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Abandonados
              </button>
            </div>
          )}
        </div>

        {activeTab === 'orders' ? (
          <>
            {/* Filtros */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input 
                type="text" 
                placeholder="Buscar por ID, Nome, Email ou CPF..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Filter size={20} />
              Filtros Avançados
            </button>
          </div>

          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status do Pedido</label>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="processing">Em Processamento</option>
                  <option value="shipped">Enviado</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data da Compra</label>
                <select 
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Qualquer data</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="60">Últimos 60 dias</option>
                  <option value="90">Últimos 90 dias</option>
                  <option value="older_90">Mais de 90 dias (Leads Inativos)</option>
                </select>
              </div>
            </motion.div>
          )}
        </div>

        {/* Lista de Pedidos */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID do Pedido</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>}
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {order.id.split('-')[0].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">
                            {order.customer_name || 'Cliente'}
                          </span>
                          <span className="text-xs text-slate-500">{order.customer_email || 'Sem email'}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-slate-900">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailsModal(true);
                          fetchOrderItems(order.id);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                        title="Ver Detalhes"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
          <div className="space-y-4">
            {abandonedCarts.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
                <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Nenhum carrinho abandonado</h3>
                <p className="text-slate-500">Ótimo sinal! Todos os seus clientes estão finalizando as compras.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {abandonedCarts.map((cart) => (
                  <div key={cart.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cart.status === 'recovered' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {cart.status === 'recovered' ? 'Recuperado' : 'Abandonado'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            {new Date(cart.updated_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="font-black text-slate-900 uppercase italic tracking-tight text-lg">
                          {cart.customer_name || 'Cliente Sem Nome'}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Eye size={14} /> {cart.customer_email}</span>
                          <span className="flex items-center gap-1"><Package size={14} /> {cart.cart_items.length} itens</span>
                          <span className="font-black text-indigo-600">Total: R$ {cart.total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={`https://wa.me/55${cart.customer_phone?.replace(/\D/g, '')}?text=Olá ${cart.customer_name}, vimos que você deixou alguns itens no carrinho da G-Fit Life. Gostaria de finalizar sua compra?`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                        >
                          Recuperar via WhatsApp
                        </a>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2 overflow-x-auto pb-2">
                      {cart.cart_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex-shrink-0 w-12 h-12 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-contain p-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
              <div>
                <h2 className="text-xl font-bold">Pedido #{selectedOrder.id.split('-')[0].toUpperCase()}</h2>
                <p className="text-xs opacity-80">{new Date(selectedOrder.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="hover:rotate-90 transition-transform">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Status e Ações */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status Atual</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusText(selectedOrder.status)}
                  </span>
                </div>
                
                {isAdmin && (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Alterar Status</p>
                    <select 
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="pending">Pendente</option>
                      <option value="paid">Pago</option>
                      <option value="processing">Em Processamento</option>
                      <option value="shipped">Enviado</option>
                      <option value="delivered">Entregue</option>
                      <option value="cancelled">Cancelado</option>
                      <option value="refunded">Reembolsado</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Informações do Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Dados do Cliente</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Nome:</span> {selectedOrder.customer_name || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Email:</span> {selectedOrder.customer_email || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Telefone:</span> {selectedOrder.customer_phone || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">CPF/CNPJ:</span> {selectedOrder.customer_document || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Pagamento e Envio</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Método Pag.:</span> {selectedOrder.payment_method.toUpperCase()}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Método Envio:</span> {selectedOrder.shipping_method || 'Padrão'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Total:</span> R$ {selectedOrder.total.toFixed(2)}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Endereço:</span> {selectedOrder.shipping_address?.street}, {selectedOrder.shipping_address?.number}</p>
                    <p className="text-sm text-slate-500 text-xs">{selectedOrder.shipping_address?.city} - {selectedOrder.shipping_address?.state}, {selectedOrder.shipping_address?.zipCode}</p>
                  </div>
                </div>
              </div>

              {/* Código de Rastreio */}
              {isAdmin && (
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Código de Rastreio</p>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="Ex: BR123456789"
                      defaultValue={selectedOrder.tracking_code || ''}
                      onBlur={(e) => updateTrackingCode(selectedOrder.id, e.target.value)}
                      className="flex-1 px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-indigo-400 mt-1 italic">* O código é salvo automaticamente ao sair do campo.</p>
                </div>
              )}

              {/* Itens do Pedido */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Itens do Pedido</h3>
                {loadingItems ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-sm italic">
                    Nenhum item encontrado para este pedido.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                          <img 
                            src={item.product?.image_url || 'https://picsum.photos/seed/product/200/200'} 
                            alt={item.product_name} 
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.quantity}x R$ {item.price.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">R$ {(item.quantity * item.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal dos Itens</span>
                      <span className="font-bold text-slate-900">R$ {orderItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
