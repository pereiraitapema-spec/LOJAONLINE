import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatCurrency } from '../lib/utils';
import { productService } from '../services/productService';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  ArrowLeft,
  Search,
  TrendingUp,
  TrendingDown,
  History,
  DollarSign,
  AlertTriangle,
  Plus,
  Minus,
  Save,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Product {
  id: string;
  name: string;
  sku?: string;
  stock: number;
  price: number;
  cost_price: number;
  image_url?: string;
}

interface InventoryLog {
  id: string;
  product_id: string;
  change_amount: number;
  reason: string;
  created_at: string;
  product?: { name: string };
}

export default function Inventory() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.role !== 'admin' && session.user.email !== 'pereira.itapema@gmail.com') {
        toast.error('Acesso negado.');
        navigate('/');
        return;
      }
      fetchData();
    };
    checkAdmin();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, logsRes] = await Promise.all([
        productService.getAllProducts(),
        supabase.from('inventory_logs')
          .select('*, product:products(name)')
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      if (logsRes.error) throw logsRes.error;

      setProducts(productsRes || []);
      setLogs(logsRes.data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!selectedProduct || !adjustAmount || adjustAmount === '0') return;
    
    setSaving(true);
    try {
      const amount = parseInt(adjustAmount);
      const newStock = selectedProduct.stock + amount;

      // 1. Update product stock
      await productService.updateStock(selectedProduct.id, newStock);

      // 2. Create log
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert({
          product_id: selectedProduct.id,
          change_amount: amount,
          reason: adjustReason || (amount > 0 ? 'Ajuste manual (entrada)' : 'Ajuste manual (saída)')
        });

      if (logError) throw logError;

      toast.success('Estoque ajustado com sucesso!');
      setShowAdjustModal(false);
      setAdjustAmount('0');
      setAdjustReason('');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao ajustar estoque: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalCostValue = products.reduce((acc, p) => acc + (p.stock * (p.cost_price || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + (p.stock * (p.price || 0)), 0);
  const projectedProfit = products.reduce((acc, p) => acc + (p.stock * ((p.price || 0) - (p.cost_price || 0))), 0);
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  if (loading) return <Loading message="Carregando estoque..." />;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Package className="w-8 h-8 text-indigo-600" />
            Gestão de Estoque e Custos
          </h1>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <DollarSign size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor em Custo</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalCostValue)}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Valor em Venda</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{formatCurrency(totalRetailValue)}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estoque Baixo</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{lowStockCount} itens</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <TrendingUp size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lucro Previsto</span>
          </div>
          <p className="text-2xl font-black text-emerald-600">{formatCurrency(projectedProfit)}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
              <Package size={20} />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total de Itens</span>
          </div>
          <p className="text-2xl font-black text-slate-900">{products.reduce((acc, p) => acc + p.stock, 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product List */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Produtos em Estoque</h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por nome ou SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none w-full md:w-64"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Estoque</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Custo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Venda</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Margem</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-1" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-900">{product.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{product.sku || 'SEM SKU'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 rounded-lg text-xs font-black ${
                          product.stock <= 5 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-slate-600">
                        {formatCurrency(product.cost_price || 0)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-black text-slate-900">
                        {formatCurrency(product.price)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-bold text-emerald-600">
                        {product.price > 0 ? (((product.price - (product.cost_price || 0)) / product.price) * 100).toFixed(0) : 0}%
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowAdjustModal(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Ajustar Estoque"
                        >
                          <Plus size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Logs */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex items-center gap-2">
              <History className="text-indigo-600" size={20} />
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Movimentações Recentes</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[600px] overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className={`p-2 rounded-xl h-fit ${log.change_amount > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
                    {log.change_amount > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <p className="text-sm font-bold text-slate-900 truncate">{log.product?.name || 'Produto Removido'}</p>
                      <span className={`text-xs font-black ${log.change_amount > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {log.change_amount > 0 ? '+' : ''}{log.change_amount}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{log.reason}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-12 text-slate-400 italic text-sm">
                  Nenhuma movimentação registrada.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      <AnimatePresence>
        {showAdjustModal && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
                <h2 className="text-xl font-bold">Ajustar Estoque</h2>
                <button onClick={() => setShowAdjustModal(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                    <img src={selectedProduct.image_url} alt={selectedProduct.name} className="w-full h-full object-contain p-1" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{selectedProduct.name}</p>
                    <p className="text-xs text-slate-500">Estoque atual: <span className="font-bold text-indigo-600">{selectedProduct.stock}</span></p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Quantidade a Ajustar</label>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setAdjustAmount((parseInt(adjustAmount) - 1).toString())}
                      className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Minus size={20} />
                    </button>
                    <input
                      type="number"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="flex-1 text-center text-2xl font-black p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button 
                      onClick={() => setAdjustAmount((parseInt(adjustAmount) + 1).toString())}
                      className="p-3 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 text-center uppercase font-bold tracking-widest">
                    Use valores negativos para saídas e positivos para entradas.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Motivo do Ajuste</label>
                  <textarea
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Ex: Recebimento de mercadoria, Quebra, Brinde..."
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAdjustStock}
                    disabled={saving || adjustAmount === '0'}
                    className="flex-[2] px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
                    Confirmar Ajuste
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
