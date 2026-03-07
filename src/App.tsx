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
      
      if (session) {
        const path = window.location.pathname;
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
      setLoading(false);
      
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password');
      }

      // Redirecionamento automático no Login inicial
      if (event === 'SIGNED_IN' && session) {
        // Marcar como Lead Frio
        leadService.updateStatus('frio');

        const path = window.location.pathname;
        if (path === '/' || path === '/login' || path === '/register') {
          await handleRoleRedirect(session);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRoleRedirect = async (session: any) => {
    const path = window.location.pathname;
    
    // 1. Admin Master
    if (session.user.email === 'pereira.itapema@gmail.com') {
      if (path === '/' || path === '/login' || path === '/register') {
        navigate('/dashboard');
      }
      return;
    }

    // 2. Verificar se é Afiliado Aprovado
    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (affiliate && affiliate.status === 'approved') {
      if (path === '/' || path === '/login' || path === '/register') {
        navigate('/affiliate-dashboard');
      }
      return;
    }

    // 3. Verificar se é Admin via tabela profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.role === 'admin') {
      if (path === '/' || path === '/login' || path === '/register') {
        navigate('/dashboard');
      }
      return;
    }

    // 4. Cliente Normal (se estiver em login/register, vai pra home)
    if (path === '/login' || path === '/register') {
      navigate('/');
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
        <Route path="*" element={<Navigate to="/" replace />} />
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
