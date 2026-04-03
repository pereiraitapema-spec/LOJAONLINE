import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { withTimeout } from './lib/utils';
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
import CepCertoAdmin from './pages/CepCertoAdmin';
import Integrations from './pages/Integrations';
import Leads from './pages/Leads';
import LeadsChat from './pages/LeadsChat';
import Inventory from './pages/Inventory';
import Automations from './pages/Automations';
import AbandonedCarts from './pages/AbandonedCarts';
import AiAgentSettings from './pages/AiAgentSettings';
import AdminReports from './pages/AdminReports';
import NotFound from './pages/NotFound';
import Callback from './pages/Callback';
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
  // Helper for timeouts

  const syncUserSession = async (userId: string, email?: string) => {
    console.log('🔄 Sincronizando sessão para:', { userId, email });
    
    // 1. Admin Master - Instantâneo
    if (email === 'pereira.itapema@gmail.com') {
      console.log('👑 Admin Master detectado via e-mail:', email);
      setUserRole('admin');
      localStorage.setItem('user_role', 'admin');
      
      // Garantir que o profile está como admin no banco
      supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).then(({ error }) => {
        if (error) console.error('Erro ao atualizar profile do master admin:', error);
      });
      
      return 'admin';
    }

    // 2. Tentar usar cache para liberar a UI rápido
    const cachedRole = localStorage.getItem('user_role');
    if (cachedRole) {
      setUserRole(cachedRole);
      // Não damos return aqui, continuamos em background para validar
    }

    try {
      // 3. Consulta Única Otimizada
      // Buscamos o profile. Se não existir, criamos.
      console.log('⏱️ Buscando dados no banco...');
      const { data: profile, error } = await withTimeout(
        supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle(),
        15000
      );

      if (error) throw error;

      let finalRole = 'customer';

      if (!profile) {
        console.log('🆕 Perfil não encontrado, criando perfil inicial...');
        const { data: newProfile } = await supabase.from('profiles').upsert({
          id: userId,
          email: email,
          role: 'customer',
          full_name: email?.split('@')[0] || 'Usuário'
        }, { onConflict: 'id' }).select('role').single();
        finalRole = newProfile?.role || 'customer';
      } else {
        console.log('📄 Perfil encontrado no banco. Role atual:', profile.role);
        finalRole = profile.role;
      }

      // 4. Se NÃO for admin, SEMPRE verificar se é um afiliado aprovado
      // Mudamos de (finalRole === 'customer') para (finalRole !== 'admin') para cobrir roles como 'user'
      if (finalRole !== 'admin') {
        console.log('🔍 Iniciando verificação de Afiliado para:', email);
        
        // Tentar por user_id primeiro
        const { data: affiliateById, error: affIdError } = await withTimeout(supabase
          .from('affiliates')
          .select('id, status, active, email')
          .eq('user_id', userId)
          .maybeSingle());
        
        if (affIdError) console.error('❌ Erro ao buscar afiliado por ID:', affIdError);

        if (affiliateById) {
          console.log('📍 Afiliado encontrado por ID:', affiliateById);
          const isApproved = affiliateById.status === 'approved' && affiliateById.active === true;
          
          if (isApproved) {
            console.log('✅ Afiliado aprovado via ID!');
            finalRole = 'affiliate';
            await supabase.from('profiles').update({ role: 'affiliate' }).eq('id', userId);
          } else {
            console.log('⚠️ Afiliado encontrado mas não está aprovado/ativo:', { status: affiliateById.status, active: affiliateById.active });
          }
        } else if (email) {
          console.log('🔍 Não encontrado por ID, buscando por e-mail:', email);
          const { data: affiliateByEmail, error: affEmailError } = await withTimeout(supabase
            .from('affiliates')
            .select('id, status, active, user_id')
            .eq('email', email)
            .maybeSingle());
          
          if (affEmailError) console.error('❌ Erro ao buscar afiliado por Email:', affEmailError);

          if (affiliateByEmail) {
            console.log('📍 Afiliado encontrado por E-mail:', affiliateByEmail);
            const isApproved = affiliateByEmail.status === 'approved' && affiliateByEmail.active === true;
            
            if (isApproved) {
              console.log('✅ Afiliado aprovado via E-mail!');
              finalRole = 'affiliate';
              // Vincula o user_id se estiver vazio
              if (!affiliateByEmail.user_id) {
                console.log('🔗 Vinculando user_id ao registro de afiliado...');
                await supabase.from('affiliates').update({ user_id: userId }).eq('id', affiliateByEmail.id);
              }
              await supabase.from('profiles').update({ role: 'affiliate' }).eq('id', userId);
            } else {
              console.log('⚠️ Afiliado por e-mail não está aprovado/ativo:', { status: affiliateByEmail.status, active: affiliateByEmail.active });
            }
          } else {
            console.log('❌ Nenhum registro de afiliado encontrado para este usuário.');
          }
        }
      }

      console.log('🏁 Resultado da Sincronização:', { finalRole });
      setUserRole(finalRole);
      localStorage.setItem('user_role', finalRole);
      return finalRole;

    } catch (error) {
      console.error('❌ Erro na sincronização:', error);
      const fallback = cachedRole || 'customer';
      setUserRole(fallback);
      return fallback;
    }
  };

  // Safety timeout for loading state
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        console.warn('⚠️ Loading timeout reached, forcing UI release');
        setLoading(false);
      }, 6000); 
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    // 0. Testar conexão com banco de dados
    const checkDB = async () => {
      try {
        const { error } = await withTimeout(supabase.from('profiles').select('id').limit(1));
        if (error && error.message.includes('does not exist')) {
          console.error('❌ Tabela profiles não encontrada!');
          toast.error('Banco de dados incompleto. Por favor, execute o script SQL de reparo no Supabase.', { duration: 10000 });
        }
      } catch (e) {
        console.error('❌ Erro ao testar conexão com banco de dados:', e);
      }
    };
    checkDB();

    // 1. Pegar sessão inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      
      const hash = window.location.hash;
      const path = window.location.pathname;

      if (hash.includes('type=recovery') || hash.includes('access_token=')) {
        if (path !== '/reset-password') navigate('/reset-password' + hash);
        setLoading(false);
        return;
      }

      if (session) {
        const role = await syncUserSession(session.user.id, session.user.email);
        handleRoleRedirect(session, role);
      } else {
        localStorage.removeItem('user_role');
        setLoading(false);
      }
    });

    // 2. Ouvir mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth Event:', event);
      setSession(session);
      
      if (event === 'SIGNED_IN' && session) {
        const role = await syncUserSession(session.user.id, session.user.email);
        
        if (window.location.hash.includes('type=recovery') || window.location.pathname === '/reset-password') {
          setLoading(false);
          return;
        }

        if (!sessionStorage.getItem('lead_status_updated')) {
          leadService.updateStatus('frio');
          sessionStorage.setItem('lead_status_updated', 'true');
        }

        await handleRoleRedirect(session, role);
      }
      
      if (event === 'SIGNED_OUT') {
        setUserRole(null);
        localStorage.removeItem('user_role');
        navigate('/login');
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRoleRedirect = async (session: any, forcedRole?: string) => {
    if (!session) {
      console.log('🚫 handleRoleRedirect: Sem sessão');
      setLoading(false);
      return;
    }
    
    const path = window.location.pathname;
    const role = forcedRole || userRole || localStorage.getItem('user_role') || 'customer';

    console.log('🚀 handleRoleRedirect:', {
      email: session.user.email,
      role,
      path,
      forcedRole
    });
    
    // Lista de caminhos que NÃO devem sofrer redirecionamento automático se o usuário for 'user'
    const isUserPage = path === '/profile' || path === '/success' || path.startsWith('/tracking');
    const isCallback = path === '/callback.html' || path === '/auth/callback';

    if (isCallback) {
      console.log('🔄 handleRoleRedirect: Ignorando callback');
      setLoading(false);
      return;
    }

    // Redirecionamento forçado para Admin e Afiliado
    if (path === '/login' || path === '/register' || path === '/') {
      if (role === 'admin') {
        console.log('➡️ Redirecionando Admin para /admin/dashboard');
        navigate('/admin/dashboard');
      } else if (role === 'affiliate') {
        console.log('➡️ Redirecionando Afiliado para /afiliados/dashboard');
        navigate('/afiliados/dashboard');
      } else {
        console.log('➡️ Usuário comum ou sem role especial, mantendo ou indo para home');
        if (path !== '/' && !isUserPage) navigate('/');
      }
    } else {
      console.log('ℹ️ handleRoleRedirect: Caminho atual não requer redirecionamento automático');
    }
    
    setLoading(false);
  };

  const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    
    if (!session) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    const isMasterAdmin = session?.user?.email === 'pereira.itapema@gmail.com';
    
    if (userRole !== 'admin' && !isMasterAdmin) {
      toast.error(`Acesso restrito a administradores.`);
      return <Navigate to="/" replace />;
    }
    
    return <>{children}</>;
  };

  const AffiliateRoute = ({ children }: { children: React.ReactNode }) => {
    const location = useLocation();
    
    if (!session) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    
    const isMasterAdmin = session?.user?.email === 'pereira.itapema@gmail.com';
    
    if (userRole !== 'affiliate' && userRole !== 'admin' && !isMasterAdmin) {
      toast.error(`Acesso restrito a afiliados.`);
      return <Navigate to="/" replace />;
    }
    
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
        <Route 
          path="/afiliados/dashboard" 
          element={<AffiliateRoute><AffiliateDashboard /></AffiliateRoute>} 
        />
        <Route path="/success" element={<Success />} />
        <Route path="/tracking/:trackingCode?" element={<Tracking />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/callback.html" element={<Callback />} />
        
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
          path="/admin/dashboard" 
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
          path="/shipping/cepcerto" 
          element={<AdminRoute><CepCertoAdmin /></AdminRoute>} 
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
      {(location.pathname === '/afiliados/dashboard' || location.pathname === '/') && (
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
