import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Plus, Edit2, Trash2, Save, X, Truck, ToggleLeft, ToggleRight, MapPin, Bell, CreditCard, Zap,
  Globe, Search, ChevronRight, Check, Eye, EyeOff
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Carrier {
  id: string;
  name: string;
  provider: string;
  active: boolean;
  config: any;
  created_at: string;
}

export default function ShippingCarriers() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCarrier, setCurrentCarrier] = useState<Partial<Carrier>>({});
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiKeyPostagem, setShowApiKeyPostagem] = useState(false);
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
      fetchCarriers();
    };
    checkAdmin();
  }, [navigate]);

  const fetchCarriers = async () => {
    try {
      const { data, error } = await supabase
        .from('shipping_carriers')
        .select('*')
        .order('name');
      
      if (error) throw error;
      const formattedData = (data || []).map(c => ({
        ...c,
        config: c.config || {}
      }));
      setCarriers(formattedData);
    } catch (error: any) {
      console.error('Error fetching carriers:', error);
      setCarriers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!currentCarrier.name || !currentCarrier.provider) {
        toast.error('Por favor, preencha o nome e selecione um provedor.');
        return;
      }
      
      if (currentCarrier.id) {
        const { error } = await supabase
          .from('shipping_carriers')
          .update({
            name: currentCarrier.name,
            provider: currentCarrier.provider,
            active: currentCarrier.active,
            config: currentCarrier.config // Garante que o objeto config seja enviado
          })
          .eq('id', currentCarrier.id);
        if (error) throw error;
        toast.success('Transportadora atualizada!');
      } else {
        const { error } = await supabase
          .from('shipping_carriers')
          .insert([currentCarrier]);
        if (error) throw error;
        toast.success('Transportadora criada!');
      }
      setIsEditing(false);
      fetchCarriers();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const toggleStatus = async (carrier: Carrier) => {
    try {
      const { error } = await supabase
        .from('shipping_carriers')
        .update({ active: !carrier.active })
        .eq('id', carrier.id);
      if (error) throw error;
      fetchCarriers();
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  const deleteCarrier = async (id: string) => {
    try {
      const { error } = await supabase
        .from('shipping_carriers')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Transportadora excluída!');
      fetchCarriers();
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const testCarrier = async (carrier: Carrier) => {
    try {
      toast.loading('Testando conexão...', { id: 'test-carrier' });
      
      // Teste de Banco de Dados (Supabase)
      const { data: dbTest, error: dbError } = await supabase.from('shipping_carriers').select('id').limit(1);
      if (dbError) throw new Error('Falha na conexão com o Banco de Dados: ' + dbError.message);

      // Verificar CEP de origem
      const { data: settings } = await supabase.from('store_settings').select('origin_zip_code').maybeSingle();
      if (!settings?.origin_zip_code) {
        throw new Error('CEP de origem não configurado nas Configurações da Loja.');
      }

      // Teste de API de Frete (Simulação de cálculo)
      const testPackages = [{ weight: 1, height: 10, width: 10, length: 10 }];
      const testCep = '01001000'; // CEP de teste (Praça da Sé)
      
      const { shippingService } = await import('../services/shippingService');
      const quotes = await shippingService.calculateShipping(testCep, testPackages, carrier.id);
      
      if (quotes && quotes.length > 0) {
        toast.success(`Conexão OK! ${quotes.length} opções de frete retornadas.`, { id: 'test-carrier' });
      } else {
        throw new Error('A API não retornou cotações. Verifique suas credenciais (Token, API Key, etc).');
      }
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast.error('Falha no teste: ' + error.message, { id: 'test-carrier' });
    }
  };

  if (loading) return <Loading message="Carregando transportadoras..." />;

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
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium transition-colors">
            <Truck size={20} /> Transportadoras
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
              <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Transportadoras & Logística</h1>
              <p className="text-slate-500">Gerencie fretes, etiquetas e rastreamento.</p>
            </div>
            <button 
              onClick={() => {
                setCurrentCarrier({ active: true, config: { tracking_notifications: true, label_generation: true } });
                setIsEditing(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              Nova Transportadora
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {carriers.filter((c, index, self) => self.findIndex(t => t.provider === c.provider) === index).map(carrier => (
              <div key={carrier.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
                    <Truck size={24} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => testCarrier(carrier)}
                      className="text-slate-400 hover:text-emerald-500 transition-colors"
                      title="Testar Conexão"
                    >
                      <Zap size={20} />
                    </button>
                    <button 
                      onClick={() => {
                        if (window.confirm('Tem certeza que deseja excluir esta transportadora?')) {
                          deleteCarrier(carrier.id);
                        }
                      }}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={20} />
                    </button>
                    <button 
                      onClick={() => toggleStatus(carrier)}
                      className={`transition-colors ${carrier.active ? 'text-emerald-500' : 'text-slate-300'}`}
                    >
                      {carrier.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                    </button>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-1">{carrier.name}</h3>
                <p className="text-sm text-slate-500 mb-4 uppercase tracking-wider font-bold">{carrier.provider}</p>
                
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <MapPin size={14} className="text-indigo-500" />
                    Cálculo de CEP Ativo
                  </div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Bell size={14} className="text-indigo-500" />
                    Notificações de Rastreio
                  </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setCurrentCarrier(carrier);
                      setIsEditing(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    <Edit2 size={16} /> Configurar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {carriers.length === 0 && !isEditing && (
            <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
              <Truck size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 font-medium">Nenhuma transportadora configurada ainda.</p>
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
            className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0 rounded-t-[2.5rem]">
              <h2 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Configurar Logística</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Nome da Transportadora</label>
                <input 
                  type="text"
                  value={currentCarrier.name || ''}
                  onChange={e => setCurrentCarrier({...currentCarrier, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                  placeholder="Ex: Correios, Jadlog, Melhor Envio"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Provedor / API</label>
                <select 
                  value={currentCarrier.provider || ''}
                  onChange={e => setCurrentCarrier({...currentCarrier, provider: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm"
                >
                  <option value="">Selecione um provedor</option>
                  <option value="test">Modo Teste (Simulação)</option>
                  <option value="melhorenvio">Melhor Envio</option>
                  <option value="correios">Correios (Direto)</option>
                  <option value="frenet">Frenet</option>
                  <option value="kangu">Kangu</option>
                  <option value="jadlog">Jadlog</option>
                  <option value="cepcerto">CepCerto</option>
                  <option value="custom">API Customizada</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={currentCarrier.config?.label_generation}
                      onChange={e => setCurrentCarrier({
                        ...currentCarrier,
                        config: { ...currentCarrier.config, label_generation: e.target.checked }
                      })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase">Gerar Etiquetas</span>
                  </label>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={currentCarrier.config?.tracking_notifications}
                      onChange={e => setCurrentCarrier({
                        ...currentCarrier,
                        config: { ...currentCarrier.config, tracking_notifications: e.target.checked }
                      })}
                      className="w-4 h-4 text-indigo-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700 uppercase">Notificar Rastreio</span>
                  </label>
                </div>
              </div>

              {currentCarrier.provider === 'cepcerto' && (
                <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 space-y-3">
                  <p className="text-[10px] font-black text-indigo-900 uppercase tracking-widest mb-2">Serviços Ativos (CepCerto)</p>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-indigo-100">
                      <input 
                        type="checkbox"
                        checked={currentCarrier.config?.services?.sedex !== false}
                        onChange={e => setCurrentCarrier({
                          ...currentCarrier,
                          config: { 
                            ...currentCarrier.config, 
                            services: { ...(currentCarrier.config?.services || {}), sedex: e.target.checked }
                          }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-[10px] font-bold text-slate-700 uppercase">SEDEX</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-indigo-100">
                      <input 
                        type="checkbox"
                        checked={currentCarrier.config?.services?.pac !== false}
                        onChange={e => setCurrentCarrier({
                          ...currentCarrier,
                          config: { 
                            ...currentCarrier.config, 
                            services: { ...(currentCarrier.config?.services || {}), pac: e.target.checked }
                          }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-[10px] font-bold text-slate-700 uppercase">PAC</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white rounded-lg border border-indigo-100">
                      <input 
                        type="checkbox"
                        checked={currentCarrier.config?.services?.jadlog === true}
                        onChange={e => setCurrentCarrier({
                          ...currentCarrier,
                          config: { 
                            ...currentCarrier.config, 
                            services: { ...(currentCarrier.config?.services || {}), jadlog: e.target.checked }
                          }
                        })}
                        className="w-4 h-4 text-indigo-600 rounded"
                      />
                      <span className="text-[10px] font-bold text-slate-700 uppercase">JADLOG</span>
                    </label>
                  </div>
                  <p className="text-[9px] text-slate-500 italic">Selecione quais serviços você deseja que apareçam no checkout.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  {currentCarrier.provider === 'cepcerto' ? 'Token de Consulta (Cálculo de Frete)' : 'Token de Acesso / API Key'}
                </label>
                <div className="relative">
                  <input 
                    type={showApiKey ? "text" : "password"}
                    value={currentCarrier.config?.api_key || ''}
                    onChange={e => setCurrentCarrier({
                      ...currentCarrier, 
                      config: { ...currentCarrier.config, api_key: e.target.value }
                    })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm pr-12"
                    placeholder={currentCarrier.provider === 'cepcerto' ? 'Insira o token de consulta' : 'Insira o token de integração'}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {currentCarrier.provider === 'cepcerto' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Token de Postagem (Gerar Etiqueta)</label>
                  <div className="relative">
                    <input 
                      type={showApiKeyPostagem ? "text" : "password"}
                      value={currentCarrier.config?.api_key_postagem || ''}
                      onChange={e => setCurrentCarrier({
                        ...currentCarrier, 
                        config: { ...currentCarrier.config, api_key_postagem: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all text-sm pr-12"
                      placeholder="Insira o token de postagem"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowApiKeyPostagem(!showApiKeyPostagem)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {showApiKeyPostagem ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Necessário para gerar etiquetas e rastreamento após o pagamento.</p>
                </div>
              )}

              <div className="flex gap-4 pt-2 pb-2 shrink-0">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-sm"
                >
                  Salvar Transportadora
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
