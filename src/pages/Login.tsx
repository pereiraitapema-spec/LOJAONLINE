import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const navigate = useNavigate();

  // Testar conexão ao carregar a página
  React.useEffect(() => {
    const testConnection = async () => {
      try {
        const { error } = await supabase.from('site_content').select('count', { count: 'exact', head: true });
        if (error) {
          console.error('🧪 Connection Test Error:', error);
          // Se for erro de rede (DNS/IP), a mensagem será clara
          if (error.message.includes('fetch')) {
            setConnectionError('Não foi possível conectar ao banco de dados. Verifique se o projeto no Supabase está ativo.');
          } else {
            setConnectionError(`Erro de conexão: ${error.message}`);
          }
        } else {
          setConnectionError(null);
        }
      } catch (err: any) {
        setConnectionError('Falha crítica de rede. O servidor do banco de dados não foi encontrado.');
      }
    };
    testConnection();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      
      // Redirecionamento baseado em Role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 1. Verificar se é Admin Master
        if (session.user.email === 'pereira.itapema@gmail.com') {
          toast.success('Bem-vindo, Administrador!');
          navigate('/dashboard');
          return;
        }

        // 2. Verificar se é Afiliado Aprovado
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('status')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (affiliate && affiliate.status === 'approved') {
          toast.success('Bem-vindo ao Painel de Afiliado!');
          navigate('/affiliate-dashboard');
          return;
        }
      }

      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao realizar login.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const redirectTo = `${window.location.origin}/auth/callback`;
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true,
        }
      });

      if (error) throw error;

      if (data?.url) {
        const popup = window.open(
          data.url,
          'google-login',
          'width=600,height=700,top=100,left=100'
        );

        // Ouvir mensagem de sucesso do popup
        const handleMessage = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) return;
          if (event.data?.type === 'AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            toast.success('Login com Google realizado!');
            // O App.tsx cuidará do redirecionamento automático baseado na role
          }
        };
        window.addEventListener('message', handleMessage);

        // Fallback: se o popup fechar sem mandar mensagem
        const checkPopup = setInterval(async () => {
          if (popup?.closed) {
            clearInterval(checkPopup);
            setLoading(false);
            window.removeEventListener('message', handleMessage);
            
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              toast.success('Login realizado!');
            }
          }
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao iniciar login com Google.');
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      toast.error('Por favor, insira seu e-mail no campo acima para recuperar a senha.');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      
      if (error) throw error;
      
      toast.success('Link de recuperação enviado! Verifique seu e-mail.');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar link de recuperação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo de volta</h1>
          <p className="text-slate-500">Faça login para acessar sua conta.</p>
          
          {connectionError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
              <span className="animate-pulse">⚠️</span>
              {connectionError}
            </div>
          )}
        </div>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="seu@email.com"
                required
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500 uppercase tracking-wider text-xs font-semibold">Ou continue com</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center justify-center gap-3"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Entrar com Google
          </button>
          
          <p className="text-sm text-center text-slate-400">
            Esqueceu sua senha? <span className="text-indigo-600 cursor-pointer hover:underline" onClick={handleResetPassword}>Recuperar</span>
          </p>

          <p className="text-sm text-center text-slate-400 mt-4">
            Não tem uma conta? <Link to="/register" className="text-indigo-600 font-semibold hover:underline">Cadastre-se</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
