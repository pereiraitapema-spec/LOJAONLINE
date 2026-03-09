import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Plus, Edit2, Trash2, Save, X, CreditCard, ToggleLeft, ToggleRight
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
  const [currentGateway, setCurrentGateway] = useState<Partial<Gateway>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'pereira.itapema@gmail.com') {
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
      setGateways(data || []);
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
                <input 
                  type="text"
                  value={currentGateway.config?.public_key || ''}
                  onChange={e => setCurrentGateway({
                    ...currentGateway, 
                    config: { ...currentGateway.config, public_key: e.target.value }
                  })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Ex: APP_USR-..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Access Token (Chave Secreta)</label>
                <input 
                  type="password"
                  value={currentGateway.config?.access_token || ''}
                  onChange={e => setCurrentGateway({
                    ...currentGateway, 
                    config: { ...currentGateway.config, access_token: e.target.value }
                  })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Ex: APP_USR-..."
                />
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
