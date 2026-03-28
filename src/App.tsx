import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
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
import Success from './pages/Success';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import ShippingLabel from './pages/ShippingLabel';
import PaymentGateways from './pages/PaymentGateways';
import ShippingCarriers from './pages/ShippingCarriers';
import Integrations from './pages/Integrations';
import Leads from './pages/Leads';
import LeadsChat from './pages/LeadsChat';
import Inventory from './pages/Inventory';
import Automations from './pages/Automations';
import AbandonedCarts from './pages/AbandonedCarts';
import AiAgentSettings from './pages/AiAgentSettings';
import AdminReports from './pages/AdminReports';
import NotFound from './pages/NotFound';
import { Loading } from './components/Loading';
import { leadService } from './services/leadService';
import { toast } from 'react-hot-toast';
import SmartChat from './components/SmartChat';

function AppContent() {
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<string | null>(() => localStorage.getItem('user_role'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Helper para timeout em chamadas Supabase - Reduzido para 5s para performance
  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number = 5000): Promise<T> => {
    return Promise.race([
      promise as Promise<T>,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms atingido`)), timeoutMs)
      )
    ]);
  };

  const fetchUserRole = async (userId: string, email?: string) => {
    console.log('🔍 fetchUserRole iniciada para:', { userId, email });
    
    // Admin Master - Prioridade absoluta
    if (email === 'pereira.itapema@gmail.com') {
      console.log('👑 Admin Master detectado em fetchUserRole');
      localStorage.setItem('user_role', 'admin');
      return 'admin';
    }
    
    try {
      console.log('⏱️ Buscando role no banco para:', userId);
      const { data: profile, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', userId)
          .maybeSingle(),
        5000
      );
      
      if (error) {
        console.warn('⚠️ Erro ao buscar role no banco:', error);
        // Se falhar o banco mas for o email master, ainda é admin
        if (email === 'pereira.itapema@gmail.com') return 'admin';
        return 'customer';
      }
      
      if (profile?.role) {
        console.log('✅ Role encontrado no banco:', profile.role);
        localStorage.setItem('user_role', profile.role);
        if (profile.full_name) {
          localStorage.setItem('user_full_name', profile.full_name);
        }
        return profile.role;
      }
      
      console.log('ℹ️ Nenhum perfil encontrado, assumindo customer');
      return 'customer';
    } catch (error) {
      console.error('❌ Erro crítico ao buscar user role:', error);
      if (email === 'pereira.itapema@gmail.com') return 'admin';
      return 'customer';
    }
  };

  // Safety timeout for loading state - Reduzido para 2s
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('⚠️ Loading timeout reached in App.tsx, forcing loading to false');
        setLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

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

      // Detectar se o usuário clicou no link de reset de senha (PKCE flow)
      // O Supabase redireciona com ?code=... e nós salvamos no localStorage
      if (window.location.search.includes('type=recovery') || (window.location.search.includes('code=') && localStorage.getItem('password_reset_requested') === 'true')) {
        console.log('🔑 Password reset code detected in URL');
        localStorage.removeItem('password_reset_requested');
        if (path !== '/reset-password') {
          navigate('/reset-password' + window.location.search);
        }
        setLoading(false);
        return;
      }

      if (session) {
        console.log('👤 Sessão inicial detectada:', session.user.email);
        
        // Se for o Admin Master, forçamos o role admin IMEDIATAMENTE antes de qualquer coisa
        if (session.user.email === 'pereira.itapema@gmail.com') {
          console.log('👑 Admin Master na sessão inicial - Forçando estado');
          setUserRole('admin');
          localStorage.setItem('user_role', 'admin');
          setLoading(false);
          
          // Sincroniza em background
          fetchUserRole(session.user.id, session.user.email);
          handleRoleRedirect(session);
          return;
        }

        // Se já temos o role no cache, liberamos o loading IMEDIATAMENTE
        const cachedRole = localStorage.getItem('user_role');
        if (cachedRole) {
          console.log('📦 Usando role em cache:', cachedRole);
          setUserRole(cachedRole);
          setLoading(false);
          // Busca o role atualizado em background sem bloquear a UI
          fetchUserRole(session.user.id, session.user.email).then(role => {
            if (role !== cachedRole) {
              console.log('🔄 Atualizando role em cache:', cachedRole, '->', role);
              setUserRole(role);
              localStorage.setItem('user_role', role);
            }
          });
        } else {
          console.log('⏱️ Buscando role inicial...');
          const role = await fetchUserRole(session.user.id, session.user.email);
          setUserRole(role);
          localStorage.setItem('user_role', role);
          setLoading(false);
        }
        
        // Redirecionamento em background
        handleRoleRedirect(session);
      } else {
        localStorage.removeItem('user_role');
        setLoading(false);
      }
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

      if (event === 'SIGNED_IN' && (window.location.search.includes('type=recovery') || (window.location.search.includes('code=') && localStorage.getItem('password_reset_requested') === 'true'))) {
        console.log('🔑 Password reset code detected in URL during SIGNED_IN');
        localStorage.removeItem('password_reset_requested');
        if (window.location.pathname !== '/reset-password') {
          navigate('/reset-password' + window.location.search);
        }
        setLoading(false);
        return;
      }

      // Redirecionamento automático no Login inicial
      if (event === 'SIGNED_IN' && session) {
        console.log('✅ Usuário logado:', session.user.email);
        
        // Sempre aguardar a busca do role para garantir consistência
        console.log('⏱️ Buscando role do usuário...');
        const role = await fetchUserRole(session.user.id, session.user.email);
        console.log('✅ Role obtido:', role);
        setUserRole(role);
        localStorage.setItem('user_role', role);

        // Se estivermos em um fluxo de recuperação, NÃO redirecionar para dashboard
        if (window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password') {
          console.log('⏳ Mantendo na página de recuperação...');
          setLoading(false);
          return;
        }

        // Marcar como Lead Frio (apenas se for login normal, não recuperação)
        if (!sessionStorage.getItem('lead_status_updated')) {
          leadService.updateStatus('frio');
          sessionStorage.setItem('lead_status_updated', 'true');
        }

        const path = window.location.pathname;
        // Se estivermos em páginas de auth ou na home/profile, decidir para onde ir
        if (path === '/login' || path === '/register' || path === '/' || path === '/callback.html' || path === '/profile') {
          await handleRoleRedirect(session);
        }
      }
      
      if (event === 'SIGNED_OUT') {
        console.log('🚪 Usuário deslogado');
        setSession(null);
        setUserRole(null);
        localStorage.removeItem('user_role');
        navigate('/login');
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
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

    console.log('🔍 Verificando permissões para:', userEmail, 'ID:', userId, 'Path:', path);
    
    try {
      console.log('⏱️ Iniciando verificação de Admin Master...');
      // 1. Admin Master (Prioridade Máxima)
      if (userEmail === 'pereira.itapema@gmail.com') {
        console.log('👑 Admin Master detectado - Forçando role admin');
        setUserRole('admin');
        localStorage.setItem('user_role', 'admin');

        if (path === '/login' || path === '/register') {
          console.log('🚀 Redirecionando Admin para /dashboard');
          navigate('/dashboard');
        }
        setLoading(false);
        return;
      }

      console.log('⏱️ Verificando tabela de afiliados...');
      // 2. Verificar se é Afiliado Aprovado (Consulta rápida)
      const { data: affiliate, error: affError } = await withTimeout(
        supabase
          .from('affiliates')
          .select('id, status, active')
          .eq('user_id', userId)
          .maybeSingle()
      );

      if (affError) {
        console.warn('⚠️ Erro ao buscar afiliado:', affError);
      }
      console.log('📊 Dados Afiliado encontrados:', affiliate);

      if (affiliate && (affiliate.status === 'approved' || (affiliate.active && !affiliate.status))) {
        console.log('🤝 Afiliado aprovado detectado');
        setUserRole('affiliate');
        localStorage.setItem('user_role', 'affiliate');
        
        if (path === '/login' || path === '/register') {
          console.log('🚀 Redirecionando Admin Afiliado para /affiliate-dashboard');
          navigate('/affiliate-dashboard');
        }
        setLoading(false);
        return;
      }
      
      if (affiliate && affiliate.status === 'pending') {
        console.log('⏳ Afiliado pendente detectado, tratando como cliente por enquanto');
      }

      console.log('⏱️ Verificando tabela de perfis...');
      // 3. Sincronizar Profile
      const { data: profile, error: profileError } = await withTimeout(
        supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', userId)
          .maybeSingle()
      );

      if (profileError) console.warn('⚠️ Erro ao buscar perfil:', profileError);
      console.log('📊 Dados Perfil encontrados:', profile);

      if (!profile && !profileError) {
        console.log('🆕 Criando perfil inicial para:', userEmail);
        await withTimeout(
          supabase.from('profiles').upsert({
            id: userId,
            email: userEmail,
            role: 'customer',
            full_name: userEmail.split('@')[0]
          }, { onConflict: 'id' })
        );
        setUserRole('customer');
      } else if (profile) {
        setUserRole(profile.role);
      }

      // 4. Verificar se é Admin secundário
      if (profile?.role === 'admin') {
        console.log('🛠️ Admin secundário detectado');
        const hasFullName = (profile as any)?.full_name;
        if (path === '/login' || path === '/register') {
          console.log('🚀 Redirecionando Admin secundário para /dashboard');
          navigate('/dashboard');
        }
        setLoading(false);
        return;
      }

      // 5. Cliente Normal
      console.log('👤 Usuário comum detectado');
      setUserRole(profile?.role || 'customer');
      localStorage.setItem('user_role', profile?.role || 'customer');
      
      if (path === '/login' || path === '/register') {
        console.log('🚀 Redirecionando Cliente para /');
        navigate('/');
      }
    } catch (err) {
      console.error('❌ Erro crítico no redirecionamento:', err);
    } finally {
      console.log('🏁 Finalizando handleRoleRedirect, loading -> false');
      setLoading(false);
    }
  };

  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    console.log('🛡️ AdminRoute Check:', { 
      session: !!session, 
      email: session?.user?.email, 
      userRole, 
      path: location.pathname 
    });

    if (!session) {
      console.log('🚫 AdminRoute: No session, redirecting to /login');
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    const isMasterAdmin = session?.user?.email === 'pereira.itapema@gmail.com';
    
    console.log('🛡️ AdminRoute Debug:', {
      userRole,
      isMasterAdmin,
      email: session?.user?.email,
      path: location.pathname
    });

    if (userRole !== 'admin' && !isMasterAdmin) {
      console.log('🚫 AdminRoute: Access denied for', session.user.email, 'Role:', userRole, 'isMaster:', isMasterAdmin);
      toast.error('Acesso restrito a administradores.');
      return <Navigate to="/" replace />;
    }
    
    console.log('✅ AdminRoute: Access granted');
    return <>{children}</>;
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
        <Route path="/success" element={<Success />} />
        <Route path="/tracking/:trackingCode?" element={<Tracking />} />
        
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
          element={<AdminRoute><Dashboard /></AdminRoute>} 
        />
        <Route 
          path="/banners" 
          element={<AdminRoute><Banners /></AdminRoute>} 
        />
        <Route 
          path="/campaigns" 
          element={<AdminRoute><Campaigns /></AdminRoute>} 
        />
        <Route 
          path="/products" 
          element={<AdminRoute><Products /></AdminRoute>} 
        />
        <Route 
          path="/orders" 
          element={<AdminRoute><Orders /></AdminRoute>} 
        />
        <Route 
          path="/admin/label/:orderId" 
          element={<AdminRoute><ShippingLabel /></AdminRoute>} 
        />
        <Route 
          path="/affiliates" 
          element={<AdminRoute><Affiliates /></AdminRoute>} 
        />
        <Route 
          path="/settings" 
          element={<AdminRoute><Settings /></AdminRoute>} 
        />
        <Route 
          path="/gateways" 
          element={<AdminRoute><PaymentGateways /></AdminRoute>} 
        />
        <Route 
          path="/shipping" 
          element={<AdminRoute><ShippingCarriers /></AdminRoute>} 
        />
        <Route 
          path="/integrations" 
          element={<AdminRoute><Integrations /></AdminRoute>} 
        />
        <Route 
          path="/leads" 
          element={<AdminRoute><Leads /></AdminRoute>} 
        />
        <Route 
          path="/leads/chat" 
          element={<AdminRoute><LeadsChat /></AdminRoute>} 
        />
        <Route 
          path="/abandoned-carts" 
          element={<AdminRoute><AbandonedCarts /></AdminRoute>} 
        />
        <Route 
          path="/inventory" 
          element={<AdminRoute><Inventory /></AdminRoute>} 
        />
        <Route 
          path="/reports" 
          element={<AdminRoute><AdminReports /></AdminRoute>} 
        />
        <Route 
          path="/automations" 
          element={<AdminRoute><Automations /></AdminRoute>} 
        />
        <Route 
          path="/ai-settings" 
          element={<AdminRoute><AiAgentSettings /></AdminRoute>} 
        />

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      {(location.pathname === '/affiliate-dashboard' || location.pathname === '/') && (
        <SmartChat />
      )}
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
