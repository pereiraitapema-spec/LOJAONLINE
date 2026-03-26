/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Inicializa e retorna a instância do Supabase.
 * Lança um erro descritivo se as credenciais estiverem faltando.
 */
export const getSupabase = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  console.log('🧪 Iniciando Supabase...');
  console.log('📍 URL:', supabaseUrl);
  console.log('🔑 Key Presente:', !!supabaseAnonKey);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Configuração do Supabase ausente. Por favor, defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY nas variáveis de ambiente.'
    );
  }

  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce', // PKCE é mais seguro e lida melhor com redirecionamentos modernos
      storageKey: 'sb-auth-token',
      storage: window.localStorage,
    }
  });
  return supabaseInstance;
};

/**
 * Proxy para manter a compatibilidade com o export 'supabase' existente.
 * Isso evita quebras em outros arquivos que já importam 'supabase'.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get: (_target, prop) => {
    const instance = getSupabase();
    return (instance as any)[prop];
  }
});
