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
    
    // Extração robusta do order_id
    const orderId = payload.data?.metadata?.order_id || 
                    payload.data?.order?.id || 
                    payload.data?.id || 
                    payload.data?.metadata?.id;

    console.log(`💰 Webhook recebido: ${eventType} para pedido ${orderId}`);

    // Eventos de sucesso
    if (['order.paid', 'charge.paid', 'payment.succeeded'].includes(eventType)) {
        if (orderId) {
            await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
            await supabase.from('payment_logs').insert({
                order_id: orderId,
                event_type: eventType,
                created_at: new Date().toISOString()
            });
            console.log(`✅ Pedido ${orderId} atualizado para paid`);
        }
    } 
    // Eventos de falha
    else if (['order.payment_failed', 'charge.failed', 'charge.payment_failed'].includes(eventType)) {
        if (orderId) {
            const errorMessage = payload.data?.gateway_response?.errors?.[0]?.message || "Pagamento não aprovado";
            await supabase.from('orders').update({ status: 'failed', erro_etiqueta: true }).eq('id', orderId);
            await supabase.from('payment_logs').insert({
                order_id: orderId,
                event_type: eventType,
                error_message: errorMessage,
                created_at: new Date().toISOString()
            });
            console.log(`❌ Pedido ${orderId} atualizado para failed: ${errorMessage}`);
        }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Erro:', err);
    return new Response('Error', { status: 500 });
  }
})
