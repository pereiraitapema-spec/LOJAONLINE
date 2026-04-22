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
    if (['order.paid', 'charge.paid', 'payment.succeeded', 'order.completed', 'charge.captured'].includes(eventType)) {
        if (orderId) {
            // Só atualiza se não estiver cancelado ou devolvido
            await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId).not('status', 'in', '("cancelled", "refunded")');
            await supabase.from('payment_logs').insert({
                order_id: orderId,
                event_type: eventType,
                created_at: new Date().toISOString()
            });
            console.log(`✅ Pedido ${orderId} atualizado para paid`);
        }
    } 
    // Eventos de falha
    else if (['order.payment_failed', 'charge.failed', 'charge.payment_failed', 'order.canceled', 'charge.refunded'].includes(eventType)) {
        if (orderId) {
            // BUSCAR STATUS ATUAL ANTES DE INVALIDAR - IMPORTANTE!
            // Não queremos que um erro de uma tentativa anterior desative um pedido que já foi pago
            const { data: currentOrder } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
            
            if (currentOrder && (['paid', 'processing', 'shipped', 'delivered'].includes(currentOrder.status))) {
                console.log(`⚠️ Webhook de FALHA ignorado para pedido ${orderId} pois o status atual é ${currentOrder.status}`);
                return new Response('Ignored (Already Paid)', { status: 200 });
            }

            const errorMessage = payload.data?.gateway_response?.errors?.[0]?.message || payload.data?.last_transaction?.gateway_response?.errors?.[0]?.message || "Pagamento não aprovado";
            const newStatus = eventType.includes('refunded') ? 'refunded' : (eventType.includes('canceled') ? 'cancelled' : 'failed');
            
            await supabase.from('orders').update({ status: newStatus, erro_etiqueta: true }).eq('id', orderId);
            await supabase.from('payment_logs').insert({
                order_id: orderId,
                event_type: eventType,
                error_message: errorMessage,
                created_at: new Date().toISOString()
            });
            console.log(`❌ Pedido ${orderId} atualizado para ${newStatus}: ${errorMessage}`);
        }
    }

    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('❌ Erro:', err);
    return new Response('Error', { status: 500 });
  }
})
