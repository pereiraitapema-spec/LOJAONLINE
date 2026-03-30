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
    const orderId = payload.data?.code || payload.data?.id;
    
    console.log(`🔔 Webhook received: ${eventType} for order ${orderId}`);

    // 1. Logar o evento
    const { error: logError } = await supabase
      .from('webhook_logs')
      .insert({
        event_type: eventType,
        payload: payload,
        status: 'pending'
      })

    if (logError) console.error('Log error:', logError);

    // 2. Se for pagamento aprovado, atualizar o pedido
    if (eventType === 'order.paid' && orderId) {
      console.log(`✅ Updating order ${orderId} to 'paid'`);
      const { error: updateError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);

      if (updateError) {
        console.error('Update error:', updateError);
        await supabase.from('webhook_logs').update({ status: 'error', error: updateError.message }).eq('payload->data->id', payload.data.id);
      } else {
        await supabase.from('webhook_logs').update({ status: 'processed' }).eq('payload->data->id', payload.data.id);
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return new Response('Error', { status: 500 })
  }
})
