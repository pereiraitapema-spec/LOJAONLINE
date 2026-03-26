/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Inicializa e retorna a instância do Supabase.
 * Lança um erro descritivo se as credenciais estiverem faltando.
 */
export const getSupabase = (): SupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const supabaseUrl = (import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
  const supabaseAnonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY)?.trim();

  // Log detalhado para diagnóstico em produção
  console.log('🧪 Supabase Initialization:', {
    url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
    keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
    keyPrefix: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 10)}...` : 'MISSING',
    environment: import.meta.env?.MODE || process.env.NODE_ENV
  });

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
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
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
