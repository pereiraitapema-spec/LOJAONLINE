import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Truck, CreditCard, Zap,
  Search, ChevronRight, Check, Copy, RefreshCw, X, AlertCircle, Wallet, QrCode, Trash2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { shippingService } from '../services/shippingService';

export default function CepCertoAdmin() {
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState<any>(null);
  const [pixAmount, setPixAmount] = useState('50');
  const [pixData, setPixData] = useState<any>(null);
  const [carrier, setCarrier] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const navigate = useNavigate();

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
  }, [navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Buscar transportadora CepCerto
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      if (!carriers) {
        toast.error('Transportadora CepCerto não encontrada ou inativa.');
        setLoading(false);
        return;
      }

      setCarrier(carriers);

      // Buscar saldo
      try {
        const balanceData = await shippingService.getBalance(carriers.id);
        setBalance(balanceData);
      } catch (e) {
        console.error('Erro ao buscar saldo:', e);
      }

      // Buscar pedidos recentes com CepCerto
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or('shipping_method.ilike.sedex,shipping_method.ilike.pac,shipping_method.ilike.jadlog')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentOrders(orders || []);

    } catch (error: any) {
      console.error('Error fetching CepCerto data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePix = async () => {
    if (!carrier) return;
    try {
      setIsGeneratingPix(true);
      const { data: { user } } = await supabase.auth.getUser();
      const amount = parseFloat(pixAmount);
      if (isNaN(amount) || amount < 10) {
        toast.error('Valor mínimo de R$ 10,00');
        return;
      }

      const data = await shippingService.generatePix(
        carrier.id,
        amount,
        user?.email || 'contato@magnifique4life.com.br',
        '11999999999' // Telefone genérico ou do perfil
      );

      if (data.msg && data.msg !== 'OK') {
        throw new Error(data.msg);
      }

      setPixData(data);
      toast.success('PIX gerado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao gerar PIX: ' + error.message);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleCancelLabel = async (trackingCode: string) => {
    if (!window.confirm(`Deseja realmente cancelar a etiqueta ${trackingCode}?`)) return;
    
    try {
      toast.loading('Cancelando etiqueta...', { id: 'cancel-label' });
      const result = await shippingService.cancelLabel(trackingCode);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao cancelar etiqueta');
      }
      toast.success('Etiqueta cancelada com sucesso!', { id: 'cancel-label' });
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao cancelar: ' + error.message, { id: 'cancel-label' });
    }
  };

  if (loading) return <Loading message="Carregando Logística CepCerto..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => navigate('/banners')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ImageIcon size={20} /> Banners
          </button>
          <button onClick={() => navigate('/campaigns')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Megaphone size={20} /> Campanhas
          </button>
          <button onClick={() => navigate('/products')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Package size={20} /> Produtos
          </button>
          <button onClick={() => navigate('/orders')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ShoppingBag size={20} /> Pedidos
          </button>
          <button onClick={() => navigate('/affiliates')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Users size={20} /> Afiliados
          </button>
          <button onClick={() => navigate('/gateways')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <CreditCard size={20} /> Gateways
          </button>
          <div className="space-y-1">
            <button onClick={() => navigate('/shipping')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
              <Truck size={20} /> Transportadoras
            </button>
            <button className="w-full flex items-center gap-3 px-8 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold transition-colors text-sm">
              <Zap size={16} /> Logística CepCerto
            </button>
          </div>
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Logística CepCerto</h1>
              <p className="text-slate-500">Gerenciamento profissional de fretes e etiquetas.</p>
            </div>
            <button 
              onClick={fetchData}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <RefreshCw size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Card de Saldo */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Wallet size={120} />
                </div>
                <div className="relative z-10">
                  <p className="text-indigo-100 font-bold uppercase tracking-widest text-xs mb-2">Saldo Disponível</p>
                  <h2 className="text-5xl font-black italic tracking-tighter mb-6">
                    {balance?.saldo || 'R$ 0,00'}
                  </h2>
                  <div className="flex items-center gap-2 text-indigo-100 text-sm font-medium">
                    <Check size={16} />
                    Sincronizado com CepCerto
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-6 flex items-center gap-2">
                  <CreditCard className="text-indigo-600" />
                  Recarregar Saldo
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Valor da Recarga (R$)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                      <input 
                        type="number"
                        value={pixAmount}
                        onChange={e => setPixAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-lg"
                        placeholder="0,00"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleGeneratePix}
                    disabled={isGeneratingPix}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isGeneratingPix ? <RefreshCw className="animate-spin" /> : <QrCode size={20} />}
                    Gerar PIX de Recarga
                  </button>

                  <p className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-widest">
                    Liberação instantânea após o pagamento
                  </p>
                </div>
              </div>
            </div>

            {/* Listagem e PIX */}
            <div className="lg:col-span-2 space-y-8">
              {pixData && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-50 border-2 border-emerald-200 rounded-[2.5rem] p-8"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-2xl font-black text-emerald-900 uppercase italic tracking-tighter">PIX Gerado!</h3>
                      <p className="text-emerald-700 font-medium">Escaneie o QR Code ou copie o código abaixo.</p>
                    </div>
                    <button onClick={() => setPixData(null)} className="text-emerald-400 hover:text-emerald-600">
                      <X size={24} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div className="bg-white p-4 rounded-3xl shadow-inner flex items-center justify-center aspect-square">
                      {pixData.qrcode ? (
                        <img src={pixData.qrcode} alt="QR Code PIX" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-center text-slate-400">
                          <QrCode size={64} className="mx-auto mb-2 opacity-20" />
                          <p className="text-xs font-bold uppercase">QR Code Indisponível</p>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="p-4 bg-white rounded-2xl border border-emerald-100">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-2">Código PIX (Copia e Cola)</p>
                        <p className="text-xs font-mono break-all text-slate-600 line-clamp-3 mb-3">
                          {pixData.copia_e_cola || pixData.pix_code || 'Código não retornado'}
                        </p>
                        <button 
                          onClick={() => copyToClipboard(pixData.copia_e_cola || pixData.pix_code)}
                          className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                        >
                          <Copy size={14} /> Copiar Código
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-emerald-700 text-xs font-bold uppercase italic">
                        <AlertCircle size={16} />
                        Válido por 30 minutos
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Etiquetas Recentes</h3>
                  <button onClick={() => navigate('/orders')} className="text-indigo-600 font-bold text-sm hover:underline">Ver todos os pedidos</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rastreio</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <span className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-bold text-slate-900">{order.customer_name}</p>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                              order.shipping_method.includes('SEDEX') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {order.shipping_method}
                            </span>
                          </td>
                          <td className="py-4">
                            {order.tracking_code ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-indigo-600">{order.tracking_code}</span>
                                <button onClick={() => copyToClipboard(order.tracking_code)} className="text-slate-300 hover:text-indigo-600">
                                  <Copy size={12} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Pendente</span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {order.shipping_label_url && (
                                <a 
                                  href={order.shipping_label_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                                  title="Imprimir Etiqueta"
                                >
                                  <ImageIcon size={16} />
                                </a>
                              )}
                              {order.tracking_code && (
                                <button 
                                  onClick={() => handleCancelLabel(order.tracking_code)}
                                  className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                  title="Cancelar Etiqueta"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                              <button 
                                onClick={() => navigate(`/orders?id=${order.id}`)}
                                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center">
                            <Truck size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">Nenhuma etiqueta gerada recentemente.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

