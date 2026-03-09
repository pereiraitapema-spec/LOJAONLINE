import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Store from './pages/Store';
import Banners from './pages/Banners';
import Campaigns from './pages/Campaigns';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Affiliates from './pages/Affiliates';
import AffiliateRegister from './pages/AffiliateRegister';
import AffiliateDashboard from './pages/AffiliateDashboard';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import PaymentGateways from './pages/PaymentGateways';
import ShippingCarriers from './pages/ShippingCarriers';
import Integrations from './pages/Integrations';
import Inventory from './pages/Inventory';
import NotFound from './pages/NotFound';
import { Loading } from './components/Loading';
import { leadService } from './services/leadService';
import { toast } from 'react-hot-toast';

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // 0. Testar conexão com banco de dados
    const checkDB = async () => {
      const { error } = await supabase.from('profiles').select('id').limit(1);
      if (error && error.message.includes('does not exist')) {
        console.error('❌ Tabela profiles não encontrada!');
        toast.error('Banco de dados incompleto. Por favor, execute o script SQL de reparo no Supabase.', { duration: 10000 });
      }
    };
    checkDB();

    // 1. Pegar sessão inicial e redirecionar se necessário
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (hash.includes('type=recovery') || hash.includes('access_token=')) {
        console.log('🔑 Recovery link detected in URL hash');
        // Se já estivermos na página de reset, não faz nada para não perder o hash
        if (path !== '/reset-password') {
          navigate('/reset-password' + hash);
        }
        setLoading(false);
        return;
      }

      if (session) {
        // Só redirecionar se estiver na home, login ou register
        if (path === '/' || path === '/login' || path === '/register') {
          await handleRoleRedirect(session);
        }
      }
      
      setLoading(false);
    });

    // 2. Ouvir mudanças (Login/Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth Event:', event);
      setSession(session);
      
      if (event === 'PASSWORD_RECOVERY' || window.location.hash.includes('type=recovery')) {
        console.log('🔑 Password Recovery Flow Detected');
        // Garantir que estamos na página correta e manter o hash se existir
        const hash = window.location.hash;
        if (window.location.pathname !== '/reset-password') {
          navigate('/reset-password' + hash);
        }
        setLoading(false);
        return;
      }

      // Redirecionamento automático no Login inicial
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ Usuário logado:', session.user.email);
        
        // Se estivermos em um fluxo de recuperação, NÃO redirecionar para dashboard
        if (window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password') {
          console.log('⏳ Mantendo na página de recuperação...');
          setLoading(false);
          return;
        }

        // Marcar como Lead Frio (apenas se for login normal, não recuperação)
        leadService.updateStatus('frio');

        const path = window.location.pathname;
        // Se estivermos em páginas de auth ou na home, decidir para onde ir
        if (path === '/' || path === '/login' || path === '/register' || path === '/callback.html') {
          await handleRoleRedirect(session);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('🚪 Usuário deslogado');
        setSession(null);
        navigate('/login');
      }

      setLoading(false);
    });

    // 3. Suprimir erro do MetaMask (comum em extensões de navegador)
    const handleError = (event: ErrorEvent) => {
      if (event.message?.includes('MetaMask') || event.message?.includes('ethereum')) {
        event.preventDefault();
        console.warn('🛡️ Suprimido erro externo de MetaMask:', event.message);
      }
    };
    window.addEventListener('error', handleError);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('error', handleError);
    };
  }, [navigate]);

  const handleRoleRedirect = async (session: any) => {
    if (!session) {
      setLoading(false);
      return;
    }
    
    const path = window.location.pathname;
    const userEmail = session.user.email;
    const userId = session.user.id;

    console.log('🔍 Verificando permissões para:', userEmail);
    
    try {
      // 1. Admin Master (Prioridade Máxima)
      if (userEmail === 'pereira.itapema@gmail.com') {
        console.log('👑 Admin Master detectado');
        
        await supabase.from('profiles').upsert({
          id: userId,
          email: userEmail,
          role: 'admin',
          full_name: 'Admin Master'
        }, { onConflict: 'id' });

        if (path === '/' || path === '/login' || path === '/register') {
          navigate('/dashboard');
        }
        setLoading(false);
        return;
      }

      // 2. Verificar se é Afiliado Aprovado (Consulta rápida)
      const { data: affiliate, error: affError } = await supabase
        .from('affiliates')
        .select('status, active')
        .eq('user_id', userId)
        .maybeSingle();

      if (affError) console.warn('⚠️ Erro ao buscar afiliado:', affError);

      if (affiliate && (affiliate.status === 'approved' || (affiliate.active && !affiliate.status))) {
        console.log('🤝 Afiliado aprovado detectado');
        if (path === '/' || path === '/login' || path === '/register') {
          navigate('/affiliate-dashboard');
        }
        setLoading(false);
        return;
      }

      // 3. Sincronizar Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) console.warn('⚠️ Erro ao buscar perfil:', profileError);

      if (!profile && !profileError) {
        console.log('🆕 Criando perfil inicial para:', userEmail);
        await supabase.from('profiles').insert({
          id: userId,
          email: userEmail,
          role: 'customer',
          full_name: userEmail.split('@')[0]
        });
      }

      // 4. Verificar se é Admin secundário
      if (profile?.role === 'admin') {
        console.log('🛠️ Admin secundário detectado');
        if (path === '/' || path === '/login' || path === '/register') {
          navigate('/dashboard');
        }
        setLoading(false);
        return;
      }

      // 5. Cliente Normal
      console.log('👤 Usuário comum detectado');
      if (path === '/login' || path === '/register') {
        navigate('/');
      }
    } catch (err) {
      console.error('❌ Erro crítico no redirecionamento:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loading message="Sincronizando conta..." />
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Loja Pública */}
        <Route path="/" element={<Store />} />
        
        {/* Autenticação */}
        <Route 
          path="/login" 
          element={session ? <Navigate to="/" replace /> : <Login />} 
        />
        <Route 
          path="/register" 
          element={session ? <Navigate to="/" replace /> : <Register />} 
        />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/affiliate-register" element={<AffiliateRegister />} />
        <Route path="/affiliate-dashboard" element={<AffiliateDashboard />} />
        
        <Route 
          path="/checkout" 
          element={<Checkout />} 
        />
        
        {/* Perfil do Usuário */}
        <Route 
          path="/profile" 
          element={session ? <Profile /> : <Navigate to="/login" replace />} 
        />
        
        {/* Painel Administrativo */}
        <Route 
          path="/dashboard" 
          element={session ? <Dashboard /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/banners" 
          element={session ? <Banners /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/campaigns" 
          element={session ? <Campaigns /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/products" 
          element={session ? <Products /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/orders" 
          element={session ? <Orders /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/affiliates" 
          element={session ? <Affiliates /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/settings" 
          element={session ? <Settings /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/gateways" 
          element={session ? <PaymentGateways /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/shipping" 
          element={session ? <ShippingCarriers /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/integrations" 
          element={session ? <Integrations /> : <Navigate to="/login" replace />} 
        />
        <Route 
          path="/inventory" 
          element={session ? <Inventory /> : <Navigate to="/login" replace />} 
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
