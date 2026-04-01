import React, { useState, useEffect } from 'react';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AbandonedCart {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  cart_items: any[];
  total: number;
  status: 'abandoned' | 'recovered';
  created_at: string;
  updated_at: string;
}

export default function AbandonedCarts() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchCarts();
  }, []);

  const fetchCarts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('abandoned_carts')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          // Table doesn't exist yet, just return empty
          setCarts([]);
          return;
        }
        throw error;
      }
      setCarts(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar carrinhos: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredCarts = carts.filter(cart => {
    const matchesSearch = 
      cart.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.customer_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cart.customer_phone?.includes(searchTerm);
    
    const matchesStatus = statusFilter === 'all' || cart.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const deleteCart = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este carrinho?')) return;
    try {
      const { error } = await supabase
        .from('abandoned_carts')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Carrinho excluído com sucesso!');
      fetchCarts();
    } catch (error: any) {
      toast.error('Erro ao excluir carrinho: ' + error.message);
    }
  };

  if (loading) return <Loading message="Carregando Carrinhos Abandonados..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <header className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div>
              <h1 className="text-3xl font-black text-slate-900 italic uppercase tracking-tighter flex items-center gap-3">
                <ShoppingCart className="text-rose-500" size={32} />
                Carrinhos Abandonados
              </h1>
              <p className="text-slate-500 font-medium">Monitore e recupere vendas perdidas.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchCarts}
              className="p-3 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total de Carrinhos</span>
          <p className="text-3xl font-black text-slate-900">{carts.length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-rose-500">
          <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Abandonados</span>
          <p className="text-3xl font-black text-slate-900">{carts.filter(c => c.status === 'abandoned').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 border-l-4 border-l-emerald-500">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-1">Recuperados</span>
          <p className="text-3xl font-black text-slate-900">{carts.filter(c => c.status === 'recovered').length}</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome, email ou whatsapp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <Filter size={20} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
            >
              <option value="all">Todos os Status</option>
              <option value="abandoned">Abandonados</option>
              <option value="recovered">Recuperados</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="text-left py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Atualização</th>
                <th className="text-right py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredCarts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Nenhum carrinho encontrado.
                  </td>
                </tr>
              ) : (
                filteredCarts.map((cart) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={cart.id} 
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-900">{cart.customer_name || 'Não informado'}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Mail size={14} />
                          {cart.customer_email}
                        </div>
                        {cart.customer_phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone size={14} />
                            {cart.customer_phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-bold text-slate-900">{formatCurrency(cart.total)}</span>
                    </td>
                    <td className="py-4 px-6">
                      {cart.status === 'recovered' ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700">
                          <CheckCircle size={12} /> Recuperado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-700">
                          <XCircle size={12} /> Abandonado
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Clock size={14} />
                        {format(new Date(cart.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button 
                        onClick={() => deleteCart(cart.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
