import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/Loading';

export default function AuthGoogleStart() {
  useEffect(() => {
    const startLogin = async () => {
      const redirectTo = `${window.location.origin}/auth/callback`;
      
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        }
      });
    };

    startLogin();
  }, []);

  return <Loading message="Conectando ao Google..." />;
}
