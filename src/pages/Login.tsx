import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { leadService } from '../services/leadService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  // Timer para reenvio de e-mail
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

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

    // Validar se os e-mails são iguais
    if (email !== confirmEmail) {
      toast.error('Os e-mails digitados não coincidem. Por favor, verifique.');
      return;
    }

    setLoading(true);
    try {
      let finalUser = null;

      // 1. Tentar Login
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData.user) {
        finalUser = signInData.user;
      }

      // 2. Se falhar por credenciais inválidas ou e-mail não confirmado
      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          setShowResend(true);
          throw new Error('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada ou clique em "Reenviar e-mail" abaixo.');
        }

        // Supabase retorna 'Invalid login credentials' tanto para senha errada quanto para usuário inexistente
        console.log('ℹ️ Falha no login, tentando verificar se é um novo usuário...');
        
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
              role: 'customer'
            }
          }
        });

        // Se o erro for "User already registered", então a senha estava errada para um usuário existente
        if (signUpError) {
          if (signUpError.message.includes('User already registered')) {
            throw new Error('Senha incorreta para este e-mail.');
          }
          throw signUpError;
        }

        if (signUpData.user) {
          finalUser = signUpData.user;
          if (signUpData.session) {
            toast.success('Conta criada e login realizado com sucesso!');
            await leadService.updateStatus('frio');
            navigate('/');
            return;
          } else {
            // Se chegou aqui, a confirmação de e-mail está ATIVADA no Supabase
            setShowResend(true);
            toast.success('Cadastro realizado! Como a confirmação de e-mail está ativa no seu Supabase, verifique sua caixa de entrada.', { duration: 6000 });
            return;
          }
        }
      }
      
      if (finalUser) {
        // Marcar como Lead Frio se for novo ou garantir que existe
        await leadService.updateStatus('frio');
      }

      // 3. Redirecionamento baseado em Role (para quem já tinha conta)
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Marcar como Lead Frio se for novo ou garantir que existe
        console.log('✅ Login realizado. Usuário:', session.user.email);

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
      console.error('❌ Erro no Auth Unificado:', error);
      toast.error(error.message || 'Erro ao realizar login/cadastro.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      // No ambiente AI Studio, o redirecionamento na mesma janela é mais estável que popups
      const redirectTo = `${window.location.origin}/callback.html`;
      
      console.log('🚀 Iniciando Google Login (Redirect Flow):', redirectTo);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          // Removido skipBrowserRedirect para usar o fluxo padrão de redirecionamento
        }
      });

      if (error) throw error;
      
      // O navegador será redirecionado automaticamente pelo Supabase
    } catch (error: any) {
      console.error('❌ Erro no Google Login:', error);
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

  const handleResendEmail = async () => {
    if (!email) {
      toast.error('Insira seu e-mail para reenviar a confirmação.');
      return;
    }

    if (resendTimer > 0) return;

    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/callback.html`
        }
      });

      if (error) throw error;

      toast.success('E-mail de confirmação reenviado!');
      setResendTimer(60); // 1 minuto de cooldown
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reenviar e-mail.');
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
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Acesse sua conta</h1>
          <p className="text-slate-500">Basta digitar seu e-mail e senha. Se não tiver conta, ela será criada automaticamente.</p>
          
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
              Confirme seu E-mail
            </label>
            <div className="relative">
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Repita seu e-mail"
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
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Processando...' : 'Entrar ou Cadastrar'}
          </button>

          {showResend && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-center">
              <p className="text-sm text-amber-800 mb-3">Não recebeu o e-mail de confirmação?</p>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={loading || resendTimer > 0}
                className="text-emerald-600 font-bold hover:underline disabled:text-slate-400 disabled:no-underline flex items-center justify-center gap-2 mx-auto"
              >
                {resendTimer > 0 ? `Aguarde ${resendTimer}s para reenviar` : 'Reenviar e-mail de confirmação'}
              </button>
            </div>
          )}

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
            Ao entrar, você concorda com nossos termos.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
