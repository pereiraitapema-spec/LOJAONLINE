import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  ArrowLeft, DollarSign, CreditCard, Package, Printer, Search, Calendar, FileText, Truck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { checkPermission } from '../lib/rbac';

export default function AdminReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('faturamento');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [data, setData] = useState<any>({ orders: [], gateways: [], products: [] });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        // Verifica permissão de gerente para relatórios
        const hasPermission = await checkPermission(session.user.id, 'manager');
        if (!hasPermission) {
          toast.error('Acesso negado aos relatórios.');
          navigate('/dashboard');
          return;
        }

        const [ordersRes, gatewaysRes, productsRes] = await Promise.all([
          supabase.from('orders').select('*, order_items(*), profiles(full_name, email)'),
          supabase.from('payment_gateways').select('*'),
          supabase.from('products').select('*')
        ]);

        setData({
          orders: ordersRes.data || [],
          gateways: gatewaysRes.data || [],
          products: productsRes.data || []
        });
      } catch (error) {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [navigate]);

  const filteredOrders = data.orders.filter((o: any) => 
    (o.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     o.id.includes(searchTerm)) &&
    (!dateFilter || o.created_at.startsWith(dateFilter))
  );

  const tabs = [
    { id: 'faturamento', name: 'Faturamento', icon: DollarSign },
    { id: 'pagamentos', name: 'Pagamentos', icon: CreditCard },
    { id: 'separacao', name: 'Separação', icon: Package },
    { id: 'etiquetas', name: 'Etiquetas', icon: Truck },
  ];

  if (loading) return <Loading message="Carregando relatórios..." />;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <header className="p-6 bg-white border-b border-slate-200 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={24} /></button>
          <h1 className="text-2xl font-bold text-slate-900">Relatórios Administrativos</h1>
        </div>
        <div className="flex gap-4">
          <input type="text" placeholder="Buscar..." className="px-4 py-2 border rounded-xl" onChange={(e) => setSearchTerm(e.target.value)} />
          <input type="date" className="px-4 py-2 border rounded-xl" onChange={(e) => setDateFilter(e.target.value)} />
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold"><Printer size={20} /> Imprimir</button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="w-48 bg-white border-r p-4 space-y-2">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2 p-3 rounded-xl font-bold ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'}`}
            >
              <tab.icon size={18} /> {tab.name}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-6">
          {activeTab === 'faturamento' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">Relatório de Faturamento</h2>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Total Faturado</p>
                  <p className="text-2xl font-black text-emerald-600">
                    R$ {filteredOrders.reduce((acc: number, o: any) => acc + o.total, 0).toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 text-xs uppercase tracking-wider border-b">
                      <th className="pb-4 font-bold">Cliente</th>
                      <th className="pb-4 font-bold">Data</th>
                      <th className="pb-4 font-bold">Itens</th>
                      <th className="pb-4 font-bold text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4">
                          <p className="font-bold text-slate-900">{o.profiles?.full_name || 'N/A'}</p>
                          <p className="text-xs text-slate-500">{o.profiles?.email}</p>
                        </td>
                        <td className="py-4 text-sm text-slate-600">
                          {new Date(o.created_at).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-4 text-sm text-slate-600 max-w-xs truncate">
                          {o.order_items.map((i: any) => i.product_name).join(', ')}
                        </td>
                        <td className="py-4 text-right font-bold text-slate-900">
                          R$ {o.total.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pagamentos' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm">
              <h2 className="text-xl font-bold mb-6 text-slate-900">Relatório de Pagamentos</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {['pix', 'credit_card', 'pagarme'].map(method => {
                  const count = filteredOrders.filter((o: any) => o.payment_method === method).length;
                  const total = filteredOrders.filter((o: any) => o.payment_method === method).reduce((acc: number, o: any) => acc + o.total, 0);
                  return (
                    <div key={method} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{method.replace('_', ' ')}</p>
                      <p className="text-2xl font-black text-slate-900">R$ {total.toFixed(2)}</p>
                      <p className="text-xs text-slate-500 mt-1">{count} pedidos realizados</p>
                    </div>
                  );
                })}
              </div>
              <table className="w-full text-left">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase tracking-wider border-b">
                    <th className="pb-4 font-bold">ID Pedido</th>
                    <th className="pb-4 font-bold">Método</th>
                    <th className="pb-4 font-bold">Status</th>
                    <th className="pb-4 font-bold text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-4 text-sm font-mono text-slate-500">#{o.id.substring(0, 8).toUpperCase()}</td>
                      <td className="py-4">
                        <span className="text-xs font-bold uppercase bg-slate-100 px-2 py-1 rounded-lg text-slate-600">
                          {o.payment_method}
                        </span>
                      </td>
                      <td className="py-4">
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          o.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td className="py-4 text-right font-bold text-slate-900">R$ {o.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'separacao' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm">
              <h2 className="text-xl font-bold mb-6 text-slate-900">Pedidos para Separação</h2>
              <div className="space-y-4">
                {filteredOrders.filter((o: any) => o.status === 'processing' || o.status === 'pending').map(o => (
                  <div key={o.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-mono font-bold text-indigo-600">#{o.id.substring(0, 8).toUpperCase()}</span>
                        <span className="text-xs text-slate-400">{new Date(o.created_at).toLocaleString('pt-BR')}</span>
                      </div>
                      <p className="font-bold text-slate-900 mb-1">{o.profiles?.full_name}</p>
                      <div className="flex flex-wrap gap-2">
                        {o.order_items.map((item: any, idx: number) => (
                          <span key={idx} className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg text-slate-600 font-bold">
                            {item.quantity}x {item.product_name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/orders?id=${o.id}`)}
                      className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <FileText size={16} /> Detalhes
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'etiquetas' && (
            <div className="bg-white p-6 rounded-3xl shadow-sm">
              <h2 className="text-xl font-bold mb-6 text-slate-900">Gerar Etiquetas de Envio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredOrders.filter((o: any) => o.status === 'processing' || o.status === 'completed').map(o => (
                  <div key={o.id} className="p-6 border border-slate-100 rounded-3xl bg-slate-50 hover:border-indigo-200 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Pedido #{o.id.substring(0, 8).toUpperCase()}</p>
                        <p className="font-bold text-slate-900">{o.profiles?.full_name}</p>
                      </div>
                      <div className="p-2 bg-white rounded-xl text-indigo-600 shadow-sm">
                        <Truck size={20} />
                      </div>
                    </div>
                    <div className="space-y-2 mb-6">
                      <p className="text-xs text-slate-600 flex items-center gap-2">
                        <MapPin size={12} className="text-slate-400" />
                        {o.shipping_address?.city}/{o.shipping_address?.state} - {o.shipping_address?.zipCode}
                      </p>
                      <p className="text-xs text-slate-600 flex items-center gap-2">
                        <Package size={12} className="text-slate-400" />
                        {o.shipping_method || 'Padrão'}
                      </p>
                    </div>
                    <button 
                      onClick={() => navigate(`/admin/label/${o.id}`)}
                      className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      <Printer size={18} /> Gerar Etiqueta
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
