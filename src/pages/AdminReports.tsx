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
              <h2 className="text-xl font-bold mb-4">Faturamento</h2>
              <table className="w-full">
                {/* Tabela de Faturamento com dados do cliente e itens */}
                {filteredOrders.map(o => (
                  <tr key={o.id} className="border-b">
                    <td className="p-3">{o.profiles?.full_name}</td>
                    <td className="p-3">{o.order_items.map((i:any) => i.product_name).join(', ')}</td>
                    <td className="p-3">R$ {o.total.toFixed(2)}</td>
                  </tr>
                ))}
              </table>
            </div>
          )}
          {/* Implementar outras abas seguindo a mesma lógica */}
        </main>
      </div>
    </div>
  );
}
