import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/Loading';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // O Supabase lida com o token na URL automaticamente se detectSessionInUrl estiver true
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Se estiver em um popup, avisar o opener e fechar
        if (window.opener) {
          window.opener.postMessage({ type: 'AUTH_SUCCESS' }, window.location.origin);
          window.close();
        } else {
          // Se não for popup, apenas redirecionar
          navigate('/');
        }
      } else {
        // Se não tiver sessão, talvez ainda esteja processando ou deu erro
        setTimeout(() => {
          if (!window.opener) navigate('/login');
        }, 2000);
      }
    };

    handleCallback();
  }, [navigate]);

  return <Loading message="Finalizando autenticação..." />;
}
