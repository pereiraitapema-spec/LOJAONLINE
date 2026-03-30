import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  // LOG IMEDIATO: Verificar se a requisição está chegando
  console.log(`🚀 Webhook chamado: ${req.method} ${req.url}`);

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const payload = await req.json()
    
    // Log do payload para depuração
    console.log('📦 Payload recebido:', JSON.stringify(payload));
    
    // DEBUG: Registra o payload completo em uma tabela de debug ANTES de processar
    await supabase
        .from('webhook_debug_logs')
        .insert({
            payload: payload,
            created_at: new Date().toISOString()
        });

    // Validação robusta
    if (!payload || typeof payload !== 'object') {
        throw new Error('Payload inválido');
    }

    const eventType = payload.type || 'unknown';
    
    console.log(`🔍 Webhook processando evento: ${eventType}`);
    
    // Processar confirmação de pagamento (aceita order.paid ou charge.paid)
    if (eventType === 'order.paid' || eventType === 'charge.paid') {
        // Tenta buscar o order_id de forma mais abrangente
        const data = payload.data || {};
        const orderId = 
            data.metadata?.order_id || 
            data.metadata?.orderId ||
            data.order?.metadata?.order_id ||
            data.order?.metadata?.orderId ||
            data.order?.id || 
            data.id;
        
        if (orderId) {
            console.log(`✅ Pagamento confirmado para o pedido ${orderId} (Evento: ${eventType}). Atualizando status...`);
            
            // 1. Atualiza o status na tabela orders
            const updateData: any = { status: 'paid', updated_at: new Date().toISOString() };
            
            // Tenta extrair a forma de pagamento
            const paymentMethod = data.charges?.[0]?.payment_method || data.payment_method;
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
            
            if (updateError) {
                console.error('❌ Erro ao atualizar status do pedido:', updateError);
            } else {
                console.log(`✅ Status do pedido ${orderId} atualizado para 'paid'.`);
            }
        } else {
            console.error('❌ order_id não encontrado no payload. Estrutura recebida:', JSON.stringify(payload, null, 2));
        }
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Erro na Edge Function:', err)
    return new Response('Error', { status: 500 })
  }
})
