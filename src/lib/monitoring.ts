import { supabase } from '../lib/supabase';

export const logApiCall = async (provider: string, endpoint: string, durationMs: number, success: boolean, error?: string) => {
  await supabase.from('api_logs').insert({
    provider,
    endpoint,
    duration_ms: durationMs,
    success,
    error
  });
};
