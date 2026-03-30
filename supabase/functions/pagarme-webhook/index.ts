import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  console.log('🚀 Webhook recebeu requisição');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const payload = await req.json();
    
    // Log imediato e obrigatório
    await supabase.from('webhook_debug_logs').insert({
      payload: payload,
      created_at: new Date().toISOString()
    });

    const eventType = payload.type;
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
        const orderId = payload.data?.metadata?.order_id || payload.data?.order?.id || payload.data?.id;
        
        if (orderId) {
            await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
            console.log(`✅ Pedido ${orderId} atualizado para paid`);
        }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Erro:', err);
    return new Response('Error', { status: 500 });
  }
})
