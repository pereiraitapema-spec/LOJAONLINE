import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { User, Camera, Save, ArrowLeft, Shield, LayoutDashboard, Package, Truck, Printer, Search, Store } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { TrackingModal } from '../components/TrackingModal';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrderTracking, setSelectedOrderTracking] = useState<{ code?: string, id?: string } | null>(null);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [profile, setProfile] = useState<any>({
    full_name: '',
    avatar_url: '',
    role: 'user'
  });
  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }
        setUser(session.user);

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data) {
          const isMaster = session.user.email === 'pereira.itapema@gmail.com';
          setProfile({
            full_name: data.full_name || '',
            avatar_url: data.avatar_url || '',
            role: isMaster ? 'admin' : (data.role || 'customer')
          });
        }

        // Fetch user orders
        const { data: userOrders, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('customer_email', session.user.email)
          .order('created_at', { ascending: false });

        if (!ordersError && userOrders) {
          setOrders(userOrders);
        }

      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    getProfile();
  }, [navigate]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
      
      // Salvar automaticamente no perfil usando upsert para garantir a persistência
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: user.id,
          avatar_url: publicUrl,
          full_name: profile.full_name,
          email: user.email
        }, { onConflict: 'id' });
      
      if (updateError) throw updateError;

      toast.success('Foto de perfil atualizada!');
    } catch (error: any) {
      toast.error('Erro ao fazer upload: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Usar upsert em vez de update para garantir que o registro exista
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          email: user.email
        }, { onConflict: 'id' });

      if (error) throw error;
      toast.success('Perfil atualizado com sucesso!');
      
      // Redirecionar após salvar baseado no cargo
      setTimeout(() => {
        if (profile.role === 'admin') {
          navigate('/dashboard');
        } else if (profile.role === 'affiliate') {
          navigate('/affiliate-dashboard');
        } else {
          navigate('/');
        }
      }, 1500);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando perfil..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => profile.role === 'admin' ? navigate('/dashboard') : navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar para {profile.role === 'admin' ? 'Painel' : 'Loja'}
        </button>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden"
        >
          <div className="h-32 bg-gradient-to-r from-indigo-600 to-violet-600"></div>
          
          <div className="px-8 pb-8">
            <div className="relative -mt-16 mb-8 flex justify-center">
              <div className="relative">
                <div className="w-32 h-32 bg-white rounded-full p-1 shadow-lg">
                  {profile.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <User size={48} />
                    </div>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors shadow-lg border-4 border-white">
                  <Camera size={18} />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={saving}
                  />
                </label>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-slate-900">{profile.full_name || 'Seu Nome'}</h1>
              <p className="text-slate-500">{user?.email}</p>
              {profile.role === 'admin' && (
                <>
                  <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold uppercase tracking-wider">
                    <Shield size={12} />
                    Administrador
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="w-full bg-amber-500 text-white py-4 rounded-2xl font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-100"
                    >
                      <LayoutDashboard size={20} />
                      Acessar Painel Administrativo
                    </button>
                  </div>
                </>
              )}
              {profile.role === 'affiliate' && (
                <>
                  <div className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider">
                    <User size={12} />
                    Afiliado
                  </div>
                  <div className="mt-6">
                    <button
                      onClick={() => navigate('/affiliate-dashboard')}
                      className="w-full bg-indigo-500 text-white py-4 rounded-2xl font-bold hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                      <LayoutDashboard size={20} />
                      Acessar Painel de Afiliado
                    </button>
                  </div>
                </>
              )}
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={profile.full_name}
                  onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/')}
                  className="w-full bg-slate-100 text-slate-700 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2 mb-4"
                >
                  <Store size={20} />
                  IR PARA O SITE PRINCIPAL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={20} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Seção de Pedidos do Cliente */}
            {profile.role !== 'admin' && (
              <div className="mt-12 border-t border-slate-100 pt-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Package size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Meus Pedidos</h2>
                </div>

                {orders.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <Package size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-medium">Você ainda não fez nenhum pedido.</p>
                    <button 
                      onClick={() => navigate('/')}
                      className="mt-4 text-indigo-600 font-bold hover:text-indigo-700"
                    >
                      Ir para a loja
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.map((order) => (
                      <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-indigo-300 transition-colors">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <p className="text-sm font-bold text-slate-900">Pedido #{order.id.substring(0, 8).toUpperCase()}</p>
                            <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                            order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status === 'completed' ? 'Concluído' :
                             order.status === 'paid' ? 'Pago' :
                             order.status === 'processing' ? 'Processando' :
                             order.status === 'cancelled' ? 'Cancelado' :
                             'Pendente'}
                          </div>
                        </div>

                        <div className="flex justify-between items-center py-4 border-y border-slate-100 mb-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Total do Pedido</p>
                            <p className="font-bold text-slate-900">R$ {order.total.toFixed(2)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 mb-1">Frete</p>
                            <p className="font-medium text-slate-700">{order.shipping_method || 'Padrão'}</p>
                          </div>
                        </div>

                        {order.tracking_code && (
                          <div className="bg-indigo-50 rounded-xl p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <Truck size={16} />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-0.5">Código de Rastreio</p>
                                <p className="text-sm font-mono text-indigo-700">{order.tracking_code}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                setSelectedOrderTracking({ code: order.tracking_code });
                                setIsTrackingModalOpen(true);
                              }}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm"
                            >
                              Rastrear
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        <TrackingModal 
          isOpen={isTrackingModalOpen}
          onClose={() => setIsTrackingModalOpen(false)}
          trackingCode={selectedOrderTracking?.code}
          orderId={selectedOrderTracking?.id}
        />
      </div>
    </div>
  );
}
