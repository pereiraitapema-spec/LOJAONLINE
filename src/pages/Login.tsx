import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Mail, Lock, Eye, EyeOff, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { leadService } from '../services/leadService';

import { withTimeout } from '../lib/utils';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processando...');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [siteLogo, setSiteLogo] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [showResend, setShowResend] = useState(false);
  const navigate = useNavigate();

  // Reset loading on mount to prevent "stuck" state from previous sessions
  React.useEffect(() => {
    setLoading(false);
  }, []);

  // Timer para reenvio de e-mail
  React.useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  // Testar conexão ao carregar a página e buscar logo
  React.useEffect(() => {
    const fetchSiteData = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('key, value')
          .in('key', ['site_logo', 'site_name']);
          
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
          if (data) {
            const logo = data.find(item => item.key === 'site_logo')?.value;
            const name = data.find(item => item.key === 'site_name')?.value;
            if (logo) setSiteLogo(logo);
            if (name) setSiteName(name);
          }
        }
      } catch (err: any) {
        setConnectionError('Falha crítica de rede. O servidor do banco de dados não foi encontrado.');
      }
    };
    fetchSiteData();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'register') {
      if (email !== confirmEmail) {
        toast.error('Os e-mails digitados não coincidem.');
        return;
      }
      if (!phone || phone.length < 10) {
        toast.error('Por favor, insira um número de telefone válido.');
        return;
      }
      if (password !== confirmPassword) {
        toast.error('As senhas digitadas não coincidem.');
        return;
      }
      if (password.length < 6) {
        toast.error('A senha deve ter pelo menos 6 caracteres.');
        return;
      }
    }

    setLoading(true);
    setLoadingMessage(mode === 'login' ? 'Autenticando...' : 'Criando conta...');
    try {
      if (mode === 'login') {
        setLoadingMessage('Verificando credenciais...');
        const { data, error } = await withTimeout(supabase.auth.signInWithPassword({
          email,
          password,
        }));

        if (error) {
          console.error('🔑 Login Error Details:', {
            message: error.message,
            status: error.status,
            code: error.code
          });
          if (error.message.includes('Invalid login credentials')) {
            throw new Error('E-mail ou senha incorretos.');
          }
          if (error.message.includes('Email not confirmed')) {
            setShowResend(true);
            throw new Error('Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.');
          }
          throw error;
        }

        if (data.user) {
          toast.success('Bem-vindo de volta!');
          leadService.updateStatus('frio').catch(console.error);
          // O App.tsx cuidará do perfil e do redirecionamento via onAuthStateChange
        }
      } else {
        // Modo Cadastro
        setLoadingMessage('Criando seu perfil...');
        const { data, error } = await withTimeout(supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split('@')[0],
              phone: phone,
              role: 'customer',
              marketing_opt_in: marketingOptIn
            }
          }
        }));

        if (error) {
          if (error.message.includes('User already registered')) {
            throw new Error('Este e-mail já possui uma conta. Tente fazer login.');
          }
          throw error;
        }

        if (data.user) {
          if (data.session) {
            toast.success('Conta criada com sucesso!');
            leadService.updateStatus('frio').catch(console.error);
            navigate('/');
          } else {
            setShowResend(true);
            toast.success('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Auth Error:', error);
      toast.error(error.message || 'Erro ao processar sua solicitação.');
    } finally {
      setLoading(false);
    }
  };

  // Ouvir mensagens do callback (para login via popup)
  React.useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      // Validar origem se necessário
      if (event.data?.type === 'AUTH_CODE') {
        console.log('✅ Auth Code received from popup');
        const code = event.data.code;
        
        try {
          setLoading(true);
          setLoadingMessage('Sincronizando conta...');
          console.log('💾 Exchanging code for session (PKCE)...');
          
          const { data, error } = await withTimeout(supabase.auth.exchangeCodeForSession(code));
          
          if (error) throw error;

          if (data.session) {
            setLoadingMessage('Conectado! Redirecionando...');
            console.log('✅ Session established successfully!');
            toast.success('Autenticado com sucesso!');
            setTimeout(() => setLoading(false), 1000);
          } else {
            throw new Error('Nenhuma sessão retornada após a troca do código.');
          }
          
        } catch (err: any) {
          console.error('❌ Erro ao trocar código por sessão:', err);
          toast.error('Erro ao sincronizar conta: ' + (err.message || 'Erro desconhecido'));
          setLoading(false);
        }
      }

      if (event.data?.type === 'AUTH_SUCCESS') {
        console.log('✅ Auth Success received from popup');
        toast.success('Autenticado com sucesso!');
        setLoading(false);
      }

      if (event.data?.type === 'AUTH_ERROR') {
        console.error('❌ Auth Error from popup:', event.data.error, event.data.description);
        toast.error(`Erro na autenticação: ${event.data.description || event.data.error}`);
        setLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setLoadingMessage('Conectando ao Google...');
    
    // Abrir janela vazia IMEDIATAMENTE para evitar bloqueio do Safari
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    
    const authWindow = window.open(
      '',
      'google_login',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!authWindow) {
      toast.error('O bloqueador de popups impediu a abertura da janela. Por favor, autorize popups para este site.');
      setLoading(false);
      return;
    }

    try {
      const origin = window.location.origin;
      const redirectTo = `${origin}/auth/callback`;
      
      console.log('🚀 Iniciando Google Login (Popup Flow):', redirectTo);

      const { data, error } = await withTimeout(supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      }), 15000); // Timeout de 15s para obter a URL

      if (error) throw error;

      if (data?.url) {
        authWindow.location.href = data.url;
        
        // Verificar se o popup foi fechado pelo usuário
        const checkWindow = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkWindow);
            setLoading(false);
          }
        }, 1000);
      } else {
        authWindow.close();
        throw new Error('Não foi possível obter a URL de autenticação.');
      }
      
    } catch (error: any) {
      console.error('❌ Erro no Google Login:', error);
      if (authWindow) authWindow.close();
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
      // Usar o origin atual de forma limpa. 
      // Em iframes do AI Studio, isso deve retornar a URL .run.app corretamente.
      const origin = window.location.origin;

      localStorage.setItem('password_reset_requested', 'true');

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/reset-password?type=recovery`,
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
          {siteLogo ? (
            <img src={siteLogo} alt={siteName || 'Logo'} className="h-16 mx-auto mb-4 object-contain" />
          ) : (
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-emerald-600" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {mode === 'login' ? `Acesse sua conta ${siteName ? `na ${siteName}` : ''}` : `Crie sua conta ${siteName ? `na ${siteName}` : ''}`}
          </h1>
          <p className="text-slate-500">
            {mode === 'login' 
              ? 'Entre com seu e-mail e senha cadastrados.' 
              : 'Preencha os dados abaixo para se cadastrar.'}
          </p>

          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border-2 border-slate-200 text-slate-700 py-3.5 rounded-xl font-bold hover:bg-slate-50 hover:border-emerald-200 transition-all flex items-center justify-center gap-3 shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              Entrar com Google
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-4 bg-white text-slate-400 uppercase tracking-widest font-bold">Ou use seu e-mail</span>
              </div>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl mt-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'login' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                mode === 'register' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Cadastrar
            </button>
          </div>

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

          {mode === 'register' && (
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
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                WhatsApp / Telefone
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="(00) 00000-0000"
                  required
                />
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              </div>
            </div>
          )}

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

          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Confirme sua Senha
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  placeholder="Repita sua senha"
                  required
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <input 
                type="checkbox" 
                id="marketing"
                checked={marketingOptIn}
                onChange={(e) => setMarketingOptIn(e.target.checked)}
                className="mt-1 w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
              />
              <label htmlFor="marketing" className="text-xs text-slate-600 leading-relaxed cursor-pointer">
                Aceito receber comunicações de marketing, novidades e ofertas exclusivas via <strong>E-mail, WhatsApp e Chat</strong>.
              </label>
            </div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {loadingMessage}
              </>
            ) : mode === 'login' ? 'Entrar' : 'Cadastrar'}
          </button>

          {mode === 'login' && (
            <button
              type="button"
              onClick={handleResetPassword}
              className="w-full text-sm text-slate-500 hover:text-indigo-600 transition-colors mt-2"
            >
              Esqueci minha senha
            </button>
          )}

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

          <p className="text-sm text-center text-slate-400 mt-4">
            Ao entrar, você concorda com nossos termos.
          </p>
        </form>
      </motion.div>
    </div>
  );
}
