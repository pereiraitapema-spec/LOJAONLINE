import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { LogOut, User, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, Megaphone } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const getProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.log('⚠️ No session found in Dashboard, redirecting...');
          navigate('/login');
          return;
        }

        if (session.user.email !== 'pereira.itapema@gmail.com') {
          toast.error('Acesso negado. Apenas o administrador pode acessar esta área.');
          navigate('/');
          return;
        }

        setUser(session.user);

        // Buscar perfil com tratamento de erro silencioso para evitar crash
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (error) {
          console.warn('ℹ️ Perfil ainda não sincronizado ou erro de RLS:', error.message);
        } else if (data) {
          setProfile(data);
        }
      } catch (error) {
        console.error('❌ Dashboard Error:', error);
      } finally {
        setLoading(false);
      }
    };

    getProfile();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Sessão encerrada');
    navigate('/login');
  };

  if (loading) return <Loading message="Carregando painel..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl">
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium"
          >
            <LayoutDashboard size={20} />
            Dashboard
          </button>
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <ShoppingBag size={20} />
            Visualizar Loja
          </button>
          <button 
            onClick={() => navigate('/banners')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <ImageIcon size={20} />
            Banners
          </button>
          <button 
            onClick={() => navigate('/campaigns')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Megaphone size={20} />
            Campanhas
          </button>
          <button 
            onClick={() => navigate('/products')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Package size={20} />
            Produtos
          </button>
          <button 
            onClick={() => navigate('/settings')}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            <Settings size={20} />
            Configurações
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors"
          >
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Olá, {user?.user_metadata?.full_name || user?.email}</h1>
            <p className="text-slate-500">Bem-vindo ao seu painel de controle.</p>
          </div>
          
          <div className="flex items-center gap-4">
            {profile?.role === 'admin' && (
              <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full uppercase tracking-wider">
                Administrador
              </span>
            )}
            <button 
              onClick={() => navigate('/profile')}
              className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 hover:bg-indigo-200 transition-colors overflow-hidden"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User size={20} />
              )}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <h3 className="text-slate-500 text-sm font-medium mb-1">Vendas Hoje</h3>
            <p className="text-3xl font-bold text-slate-900">R$ 0,00</p>
          </motion.div>
          
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <h3 className="text-slate-500 text-sm font-medium mb-1">Produtos Ativos</h3>
            <p className="text-3xl font-bold text-slate-900">0</p>
          </motion.div>

          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100"
          >
            <h3 className="text-slate-500 text-sm font-medium mb-1">Novos Clientes</h3>
            <p className="text-3xl font-bold text-slate-900">0</p>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
