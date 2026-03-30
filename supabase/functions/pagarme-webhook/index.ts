import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const payload = await req.json()
    
    // Validação robusta
    if (!payload || typeof payload !== 'object') {
        throw new Error('Payload inválido');
    }

    const eventType = payload.type || 'unknown';
    
    const { error } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: eventType,
        payload: payload,
        status: 'pending'
      })

    if (error) throw error

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return new Response('Error', { status: 500 })
  }
})
