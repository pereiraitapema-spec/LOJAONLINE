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
    
    console.log(`🔍 Webhook recebido: ${eventType}`);
    console.log('📦 Payload completo:', JSON.stringify(payload, null, 2));
    
    // Log do webhook
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: eventType,
        payload: payload,
        status: 'processed'
      });

    // Processar confirmação de pagamento (aceita order.paid ou charge.paid)
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
        // Tenta buscar o order_id de diferentes locais possíveis no payload
        const orderId = 
            payload.data?.metadata?.order_id || 
            payload.data?.order?.metadata?.order_id ||
            payload.data?.metadata?.orderId ||
            payload.data?.order?.id || // Caso seja charge.paid, o order_id pode estar em payload.data.order.id
            payload.data?.id; // Fallback
        
        if (orderId) {
            console.log(`✅ Pagamento confirmado para o pedido ${orderId} (Evento: ${eventType}). Atualizando status...`);
            
            // 1. Atualiza o status na tabela orders
            const updateData: any = { status: 'paid', updated_at: new Date().toISOString() };
            
            // Tenta extrair a forma de pagamento do payload
            const paymentMethod = payload.data?.charges?.[0]?.payment_method || payload.data?.payment_method;
            if (paymentMethod) {
                updateData.payment_method = paymentMethod;
            }

            const { error: updateError } = await supabase
                .from('orders')
                .update(updateData)
                .eq('id', orderId);
            
            // 2. Registra o log na tabela payment_logs
            await supabase
                .from('payment_logs')
                .insert({
                    order_id: orderId,
                    event_type: eventType,
                    payload: payload,
                    status: 'success'
                });

            // DEBUG: Registra o payload completo em uma tabela de debug
            await supabase
                .from('webhook_debug_logs')
                .insert({
                    payload: payload,
                    created_at: new Date().toISOString()
                });
            
            if (updateError) {
                console.error('❌ Erro ao atualizar status do pedido:', updateError);
            } else {
                console.log(`✅ Status do pedido ${orderId} atualizado para 'paid'.`);
            }
        } else {
            console.error('❌ order_id não encontrado no payload. Estrutura recebida:', JSON.stringify(payload, null, 2));
            
            // Registra o erro de falta de order_id na tabela de debug para análise
            await supabase
                .from('webhook_debug_logs')
                .insert({
                    payload: { error: 'order_id_not_found', event_type: eventType, raw_payload: payload },
                    created_at: new Date().toISOString()
                });
        }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return new Response('Error', { status: 500 })
  }
})
