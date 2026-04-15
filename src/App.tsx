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
import ApiKeys from './pages/ApiKeys';
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

  // Background API Key Re-check (every 15 minutes)
  useEffect(() => {
    const checkInterval = setInterval(async () => {
      const { data: keys } = await supabase
        .from('api_keys')
        .select('id, status, last_error_at')
        .eq('active', true)
        .neq('status', 'online');

      if (keys && keys.length > 0) {
        const keysToReset = keys.filter(k => {
          if (!k.last_error_at) return true;
          const lastError = new Date(k.last_error_at).getTime();
          const now = new Date().getTime();
          const diffMinutes = (now - lastError) / (1000 * 60);
          return diffMinutes >= 15;
        });

        if (keysToReset.length > 0) {
          console.log(`[AI] Re-habilitando ${keysToReset.length} chaves para nova tentativa...`);
          await supabase.from('api_keys')
            .update({ status: 'online', last_error_at: null })
            .in('id', keysToReset.map(k => k.id));
        }
      }
    }, 60000); // Check every minute if any key needs reset (15min rule)

    return () => clearInterval(checkInterval);
  }, []);

  // Helper para timeout em chamadas Supabase - Reduzido para 5s para performance
  // Helper for timeouts

  const syncUserSession = async (session: any) => {
    if (!session?.user) {
      console.log('⚠️ [AUTH] Tentativa de sincronização sem usuário válido.');
      return null;
    }

    const userId = session.user.id;
    const email = session.user.email;

    // 1. Admin Master - Instantâneo
    if (email === 'pereira.itapema@gmail.com') {
      setUserRole('admin');
      localStorage.setItem('user_role', 'admin');
      setLoading(false); // Libera a UI imediatamente para o admin
      
      supabase.from('profiles').update({ role: 'admin' }).eq('id', userId).then();
      return 'admin';
    }

    // 2. Tentar usar cache para liberar a UI rápido (Otimista)
    const cachedRole = localStorage.getItem('user_role');
    if (cachedRole) {
      setUserRole(cachedRole);
      setLoading(false); // Libera a UI imediatamente se tiver cache
    }

    try {
      // 3. Consultas Paralelas Otimizadas - Timeout reduzido para 5s
      const [profileRes, affiliateIdRes, affiliateEmailRes] = await Promise.all([
        withTimeout(supabase.from('profiles').select('role, avatar_url').eq('id', userId).maybeSingle(), 5000),
        withTimeout(supabase.from('affiliates').select('id, status, active, email, user_id').eq('user_id', userId).maybeSingle(), 5000),
        email ? withTimeout(supabase.from('affiliates').select('id, status, active, user_id').eq('email', email).maybeSingle(), 5000) : Promise.resolve({ data: null, error: null })
      ]);

      if (profileRes.error) throw profileRes.error;

      let finalRole = profileRes.data?.role || 'customer';
      const affiliateData = affiliateIdRes.data || affiliateEmailRes.data;

      // 4. Lógica de Decisão de Role
      if (affiliateData) {
        console.log('📍 Registro de Afiliado encontrado:', affiliateData);
        const isApproved = affiliateData.status === 'approved' && affiliateData.active === true;
        
        if (isApproved) {
          console.log('✅ Afiliado aprovado!');
          finalRole = 'affiliate';
          
          // Sincronizar no banco se necessário (background)
          if (profileRes.data?.role !== 'affiliate') {
            supabase.from('profiles').update({ role: 'affiliate' }).eq('id', userId).then();
          }
          if (!affiliateData.user_id) {
            supabase.from('affiliates').update({ user_id: userId }).eq('id', affiliateData.id).then();
          }
        } else {
          console.log('⚠️ Afiliado não aprovado/ativo. Role:', finalRole);
          if (finalRole === 'affiliate') {
            finalRole = 'customer';
            supabase.from('profiles').update({ role: 'customer' }).eq('id', userId).then();
          }
        }
      } else if (finalRole === 'affiliate') {
        // Se o perfil diz que é afiliado mas não existe registro, volta para customer
        console.log('❌ Nenhum registro de afiliado encontrado. Downgrading...');
        finalRole = 'customer';
        supabase.from('profiles').update({ role: 'customer' }).eq('id', userId).then();
      }

      // 5. Se perfil não existe ou falta avatar, atualizar (background)
      const googleAvatar = session.user.user_metadata.avatar_url || session.user.user_metadata.picture;
      
      if (!profileRes.data) {
        console.log('🆕 [AUTH] Criando novo perfil com avatar:', googleAvatar);
        supabase.from('profiles').upsert({
          id: userId,
          email: email,
          role: finalRole,
          full_name: session.user.user_metadata.full_name || email?.split('@')[0] || 'Usuário',
          avatar_url: googleAvatar
        }).then();
      } else if (googleAvatar && (!profileRes.data.avatar_url || profileRes.data.avatar_url !== googleAvatar)) {
        console.log('🔄 [AUTH] Atualizando avatar do perfil:', googleAvatar);
        supabase.from('profiles').update({ avatar_url: googleAvatar }).eq('id', userId).then();
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
        // Timeout de 10s para o teste inicial para não travar o log
        const { error } = await withTimeout(supabase.from('profiles').select('id').limit(1), 10000);
        
        if (error) {
          if (error.message.includes('does not exist')) {
            console.error('❌ Tabela profiles não encontrada!');
            toast.error('Banco de dados incompleto. Por favor, execute o script SQL de reparo no Supabase.', { duration: 10000 });
          } else {
            console.warn('⚠️ Aviso na conexão com banco:', error.message);
          }
        } else {
          console.log('✅ Conexão com banco de dados OK');
        }
      } catch (e: any) {
        if (e.message?.includes('Timeout')) {
          console.warn('🕒 Timeout ao testar conexão inicial (Banco pode estar em cold start ou instável)');
        } else {
          console.error('❌ Erro ao testar conexão com banco de dados:', e);
        }
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
        const cachedRole = localStorage.getItem('user_role');
        if (cachedRole) {
          setLoading(false);
          syncUserSession(session).then(role => {
            handleRoleRedirect(session, role || undefined);
          });
        } else {
          const role = await syncUserSession(session);
          handleRoleRedirect(session, role || undefined);
          setLoading(false);
        }
      } else {
        localStorage.removeItem('user_role');
        setLoading(false);
      }
    });

    // 2. Ouvir mudanças
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 [AUTH] Evento:', event);
      setSession(session);
      
      if (event === 'SIGNED_IN' && session) {
        const cachedRole = localStorage.getItem('user_role');
        if (cachedRole) {
          setLoading(false);
          syncUserSession(session).then(role => {
            handleRoleRedirect(session, role || undefined);
          });
        } else {
          const role = await syncUserSession(session);
          handleRoleRedirect(session, role || undefined);
          setLoading(false);
        }

        if (!sessionStorage.getItem('lead_status_updated')) {
          leadService.updateStatus('frio');
          sessionStorage.setItem('lead_status_updated', 'true');
        }
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
    // Prioridade: forcedRole > userRole (estado) > localStorage > fallback
    const role = forcedRole || userRole || localStorage.getItem('user_role') || 'customer';

    console.log('🚀 handleRoleRedirect:', {
      email: session.user.email,
      role,
      path,
      forcedRole,
      stateRole: userRole
    });
    
    const isCallback = path === '/callback.html' || path === '/auth/callback';
    if (isCallback) {
      console.log('🔄 handleRoleRedirect: Ignorando callback');
      setLoading(false);
      return;
    }

    // Redirecionamento forçado para Admin e Afiliado
    // Se o usuário estiver na Home, Login ou Register, redirecionamos para o painel correto
    const isAuthPage = path === '/login' || path === '/register';
    const isHome = path === '/';

    if (isAuthPage || isHome) {
      if (role === 'admin') {
        console.log('➡️ Redirecionando Admin para /admin/dashboard');
        navigate('/admin/dashboard');
      } else if (role === 'affiliate') {
        console.log('➡️ Redirecionando Afiliado para /afiliados/dashboard');
        navigate('/afiliados/dashboard');
      }
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
          path="/admin/api-keys" 
          element={<AdminRoute><ApiKeys /></AdminRoute>} 
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
        <SmartChat source={location.pathname === '/afiliados/dashboard' ? 'afiliados' : 'vendas'} />
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
