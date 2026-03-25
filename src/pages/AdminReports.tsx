import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  ArrowLeft,
  DollarSign,
  CreditCard,
  Package,
  Printer
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

export default function AdminReports() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({
    billing: [],
    payments: [],
    inventory: []
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch Billing (Orders)
        const { data: orders } = await supabase.from('orders').select('*, order_items(*)');
        
        // Fetch Payments (Gateways)
        const { data: gateways } = await supabase.from('payment_gateways').select('*');
        
        // Fetch Inventory (Products)
        const { data: products } = await supabase.from('products').select('*');

        setData({
          billing: orders || [],
          payments: gateways || [],
          inventory: products || []
        });
      } catch (error) {
        toast.error('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <Loading message="Carregando relatórios..." />;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900">Relatórios Administrativos</h1>
        </div>
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold hover:bg-slate-800 transition-all"
        >
          <Printer size={20} />
          Imprimir Relatório
        </button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Faturamento */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-black text-slate-900 uppercase italic mb-6 flex items-center gap-2">
            <DollarSign className="text-indigo-600" /> Faturamento
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Pedido</th>
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Total</th>
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.billing.map((order: any) => (
                  <tr key={order.id} className="border-b border-slate-50">
                    <td className="p-3 text-sm font-bold">#{order.id.split('-')[0]}</td>
                    <td className="p-3 text-sm">R$ {order.total.toFixed(2)}</td>
                    <td className="p-3 text-sm">{order.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Dados de Pagamento */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-black text-slate-900 uppercase italic mb-6 flex items-center gap-2">
            <CreditCard className="text-indigo-600" /> Dados do Pagamento
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.payments.map((gateway: any) => (
              <div key={gateway.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="font-bold">{gateway.name}</p>
                <p className="text-xs text-slate-500 uppercase">{gateway.provider}</p>
                <p className="text-xs text-emerald-600 font-bold">{gateway.active ? 'Ativo' : 'Inativo'}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Dados de Estoque */}
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <h2 className="text-xl font-black text-slate-900 uppercase italic mb-6 flex items-center gap-2">
            <Package className="text-indigo-600" /> Dados de Estoque
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Produto</th>
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Estoque</th>
                  <th className="p-3 text-xs font-bold text-slate-400 uppercase">Preço</th>
                </tr>
              </thead>
              <tbody>
                {data.inventory.map((product: any) => (
                  <tr key={product.id} className="border-b border-slate-50">
                    <td className="p-3 text-sm font-bold">{product.name}</td>
                    <td className="p-3 text-sm">{product.stock}</td>
                    <td className="p-3 text-sm">R$ {product.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
