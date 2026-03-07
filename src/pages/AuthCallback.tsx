import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/Loading';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // 1. Ouvir mudanças de estado (mais confiável para OAuth)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔔 Callback Auth Event:', event, session ? 'Sessão OK' : 'Sem Sessão');
        
        if (session) {
          subscription.unsubscribe();
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
            setTimeout(() => window.close(), 500);
          } else {
            navigate('/');
          }
        }
      });

      // 2. Fallback: verificar sessão atual após um tempo
      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          subscription.unsubscribe();
          if (window.opener) {
            window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
            setTimeout(() => window.close(), 500);
          } else {
            navigate('/');
          }
        } else {
          // Se após 5 segundos nada aconteceu, redirecionar
          setTimeout(() => {
            subscription.unsubscribe();
            if (!window.opener) navigate('/login');
          }, 3000);
        }
      } catch (err) {
        console.error('Erro fatal no callback:', err);
        subscription.unsubscribe();
        if (!window.opener) navigate('/login');
      }
    };

    handleCallback();
  }, [navigate]);

  return <Loading message="Finalizando autenticação..." />;
}
