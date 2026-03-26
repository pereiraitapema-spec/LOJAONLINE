import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Plus, Edit2, Trash2, Save, X, CreditCard, ToggleLeft, ToggleRight,
  Eye, EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Gateway {
  id: string;
  name: string;
  provider: string;
  active: boolean;
  config: any;
  created_at: string;
}

export default function PaymentGateways() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showPublicKey, setShowPublicKey] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [currentGateway, setCurrentGateway] = useState<Partial<Gateway>>({});
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
      fetchGateways();
    };
    checkAdmin();
  }, [navigate]);

  const fetchGateways = async () => {
    try {
      const { data, error } = await supabase
        .from('payment_gateways')
        .select('*')
        .order('name');
      
      if (error) throw error;
      const formattedData = (data || []).map(g => ({
        ...g,
        config: g.config || {}
      }));
      setGateways(formattedData);
    } catch (error: any) {
      console.error('Error fetching gateways:', error);
      // Se a tabela não existir, vamos criar um estado inicial vazio
      setGateways([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (currentGateway.id) {
        const { error } = await supabase
          .from('payment_gateways')
          .update(currentGateway)
          .eq('id', currentGateway.id);
        if (error) throw error;
        toast.success('Gateway atualizado!');
      } else {
        const { error } = await supabase
          .from('payment_gateways')
          .insert([currentGateway]);
        if (error) throw error;
        toast.success('Gateway criado!');
      }
      setIsEditing(false);
      fetchGateways();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const toggleStatus = async (gateway: Gateway) => {
    try {
      const { error } = await supabase
        .from('payment_gateways')
        .update({ active: !gateway.active })
        .eq('id', gateway.id);
      if (error) throw error;
      fetchGateways();
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este gateway?')) return;

    try {
      const { error } = await supabase
        .from('payment_gateways')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Gateway excluído!');
      fetchGateways();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  if (loading) return <Loading message="Carregando gateways..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Reutilizando o padrão do Dashboard */}
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
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium transition-colors">
            <CreditCard size={20} /> Gateways
          </button>
          <button onClick={() => navigate('/shipping')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Package size={20} /> Transportadoras
          </button>
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Gateways de Pagamento</h1>
              <p className="text-slate-500">Configure como você recebe seus pagamentos.</p>
            </div>
            <button 
              onClick={() => {
                setCurrentGateway({ active: true, config: {} });
                setIsEditing(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              Novo Gateway
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {gateways.map(gateway => (
              <div key={gateway.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <CreditCard size={24} />
                  </div>
                  <button 
                    onClick={() => toggleStatus(gateway)}
                    className={`transition-colors ${gateway.active ? 'text-emerald-500' : 'text-slate-300'}`}
                  >
                    {gateway.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-1">{gateway.name}</h3>
                <p className="text-sm text-slate-500 mb-4 uppercase tracking-wider font-bold">{gateway.provider}</p>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setCurrentGateway(gateway);
                      setIsEditing(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    <Edit2 size={16} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(gateway.id)}
                    className="p-2 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-all"
                    title="Excluir"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {gateways.length === 0 && !isEditing && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <CreditCard size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Nenhum gateway configurado ainda.</p>
            </div>
          )}
        </div>
      </main>

      {/* Modal de Edição */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Configurar Gateway</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Nome de Exibição</label>
                <input 
                  type="text"
                  value={currentGateway.name || ''}
                  onChange={e => setCurrentGateway({...currentGateway, name: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Ex: Mercado Pago, Stripe, Pagar.me"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Provedor</label>
                <select 
                  value={currentGateway.provider || ''}
                  onChange={e => setCurrentGateway({...currentGateway, provider: e.target.value})}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                >
                  <option value="">Selecione um provedor</option>
                  <option value="mercadopago">Mercado Pago</option>
                  <option value="stripe">Stripe</option>
                  <option value="pagarme">Pagar.me</option>
                  <option value="asaas">Asaas</option>
                  <option value="custom">Outro (API Customizada)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Public Key (ID de Teste)</label>
                <div className="relative">
                  <input 
                    type={showPublicKey ? "text" : "password"}
                    value={currentGateway.config?.public_key || ''}
                    onChange={e => setCurrentGateway({
                      ...currentGateway, 
                      config: { ...currentGateway.config, public_key: e.target.value }
                    })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all pr-14"
                    placeholder="Ex: APP_USR-..."
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPublicKey(!showPublicKey)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showPublicKey ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Access Token (Chave Secreta)</label>
                <div className="relative">
                  <input 
                    type={showAccessToken ? "text" : "password"}
                    value={currentGateway.config?.access_token || ''}
                    onChange={e => {
                      const val = e.target.value;
                      setCurrentGateway({
                        ...currentGateway, 
                        config: { ...currentGateway.config, access_token: val }
                      });
                    }}
                    className={`w-full px-5 py-4 bg-slate-50 border rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all pr-14 ${
                      currentGateway.provider === 'pagarme' && currentGateway.config?.access_token?.startsWith('pk_') 
                        ? 'border-rose-300 ring-rose-100' 
                        : 'border-slate-200'
                    }`}
                    placeholder={currentGateway.provider === 'pagarme' ? "Ex: sk_test_..." : "Ex: APP_USR-..."}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowAccessToken(!showAccessToken)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showAccessToken ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {currentGateway.provider === 'pagarme' && currentGateway.config?.access_token?.startsWith('pk_') && (
                  <p className="mt-2 text-xs text-rose-500 font-bold">
                    ⚠️ Atenção: Você inseriu uma Chave Pública (pk_...). Para o Access Token do Pagar.me, você deve usar a Chave Secreta (Secret Key) que começa com "sk_".
                  </p>
                )}
                {currentGateway.provider === 'pagarme' && (
                  <p className="mt-2 text-[10px] text-slate-400 leading-tight">
                    No Pagar.me v5, use a <strong>Secret Key</strong> (sk_...) encontrada em Configurações &gt; Chaves de API.
                  </p>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Salvar Configurações
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
