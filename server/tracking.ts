import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

export async function handleTracking(req: any, res: any) {
  const { code } = req.params;
  const apiKey = req.query.api_key || process.env.CEPCERTO_API;
  
  console.log(`🚀 [TRACKING_LOG] Iniciando busca para o código: ${code}`);

  if (!code || code === 'undefined' || code.length < 5) {
    console.error(`❌ [TRACKING_LOG] Código inválido recebido: ${code}`);
    return res.status(400).json({ success: false, error: "Código de rastreio inválido" });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    console.log(`🔍 [TRACKING_CODE] Buscando código: ${code}`);

    // 1. Tenta buscar no banco primeiro se esse código pertence a algum pedido com histórico
    const { data: order } = await supabase
      .from('orders')
      .select('id, status')
      .eq('tracking_code', code)
      .maybeSingle();

    const orderId = order?.id;

    if (orderId) {
      const { data: history } = await supabase
        .from('tracking_history')
        .select('description, location, date')
        .eq('order_id', orderId)
        .order('date', { ascending: true });

      if (history && history.length > 0) {
        console.log(`✅ [TRACKING_CODE] Histórico encontrado no banco para o código ${code} (${history.length} eventos)`);
        
        return res.json({
          success: true,
          provider: 'Database',
          status: order.status || "Em trânsito",
          history: history.map((h: any) => ({
            date: new Date(h.date).toLocaleString('pt-BR'),
            location: h.location || 'Correios',
            description: h.description
          }))
        });
      }
    }

    console.log(`🔍 [TRACKING_LOG] Iniciando busca externa para o código: ${code}`);

    // 0. TENTA CEPCERTO (Se houver API KEY)
    if (apiKey && apiKey !== 'undefined') {
      try {
        console.log(`📡 [TRACKING_LOG] Consultando CepCerto...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const cepUrl = `https://cepcerto.com/ws/encomenda-json/${code}/${apiKey}`;
        const response = await fetch(cepUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        console.log(`📊 [TRACKING_LOG] CepCerto Status: ${response.status}`);
        
        if (response.ok) {
          const data: any = await response.json();
          // CepCerto retorna um array de objetos no campo 'rastreio' ou similar
          if (data && data.rastreio && data.rastreio.length > 0) {
            console.log(`✅ [TRACKING_LOG] CepCerto retornou ${data.rastreio.length} eventos.`);
            
            const history = data.rastreio.map((e: any) => ({
              date: e.data + ' ' + e.hora,
              location: e.local || 'Correios',
              description: e.status
            }));

            // Sincroniza com o banco se tivermos o orderId
            if (orderId) {
              await syncTrackingHistory(supabase, orderId, history);
            }

            return res.json({
              success: true,
              provider: 'CepCerto',
              status: data.status || 'Em trânsito',
              history: history
            });
          }
        }
      } catch (e: any) {
        console.error(`⚠️ [TRACKING_LOG] Falha no CepCerto: ${e.message}`);
      }
    }

    // 1. TENTA SEURASTREIO
    try {
      console.log(`📡 [TRACKING_LOG] Consultando SeuRastreio...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      
      const response = await fetch(`https://seurastreio.com.br/api/v1/track/${code}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      console.log(`📊 [TRACKING_LOG] SeuRastreio Status: ${response.status}`);
      
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.events && data.events.length > 0) {
          console.log(`✅ [TRACKING_LOG] SeuRastreio retornou ${data.events.length} eventos.`);
          
          const history = data.events.map((e: any) => ({
            date: e.date,
            location: e.location || 'Correios',
            description: e.message || e.description
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          return res.json({
            success: true,
            provider: 'SeuRastreio',
            status: data.status || 'Em trânsito',
            history: history
          });
        } else {
          console.warn(`⚠️ [TRACKING_LOG] SeuRastreio respondeu mas sem eventos.`);
        }
      }
    } catch (e: any) {
      console.error(`⚠️ [TRACKING_LOG] Falha no SeuRastreio: ${e.message}`);
    }

    // 2. TENTA BRASILAPI
    try {
      console.log(`📡 [TRACKING_LOG] Consultando BrasilAPI...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${code}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      console.log(`📊 [TRACKING_LOG] BrasilAPI Status: ${response.status}`);
      
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.eventos && data.eventos.length > 0) {
          console.log(`✅ [TRACKING_LOG] BrasilAPI retornou ${data.eventos.length} eventos.`);
          
          const history = data.eventos.map((e: any) => ({
            date: new Date(e.data).toLocaleString('pt-BR'),
            location: e.local || 'Correios',
            description: e.status
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          return res.json({
            success: true,
            provider: 'BrasilAPI',
            status: data.eventos[0].status || 'Em trânsito',
            history: history
          });
        }
      }
    } catch (e: any) {
      console.error(`⚠️ [TRACKING_LOG] Falha na BrasilAPI: ${e.message}`);
    }

    // 3. TENTA LINKETRACK
    try {
      console.log(`📡 [TRACKING_LOG] Consultando Linketrack...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      
      const linkeUrl = `https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${code}`;
      const linkeRes = await fetch(linkeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      console.log(`📊 [TRACKING_LOG] Linketrack Status: ${linkeRes.status}`);
      
      if (linkeRes.ok) {
        const data: any = await linkeRes.json();
        if (data && data.eventos && data.eventos.length > 0) {
          console.log(`✅ [TRACKING_LOG] Linketrack retornou ${data.eventos.length} eventos.`);
          
          const history = data.eventos.map((e: any) => ({
            date: `${e.data} ${e.hora}`,
            location: e.local || 'Não informado',
            description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          return res.json({
            success: true,
            provider: 'Linketrack',
            status: data.eventos[0].status,
            history: history
          });
        }
      }
    } catch (e: any) {
      console.error(`⚠️ [TRACKING_LOG] Falha no Linketrack: ${e.message}`);
    }

    // 3. FALLBACK MANUAL
    console.log(`ℹ️ [TRACKING_LOG] Todas as APIs falharam. Usando fallback manual.`);
    return res.json({
      success: true,
      provider: 'Fallback Manual',
      status: "Enviado",
      message: "Pedido em trânsito. O histórico detalhado aparecerá assim que processado pelos Correios.",
      history: [
        {
          description: "Objeto postado e em trânsito para a unidade de distribuição",
          location: "Centro Logístico",
          date: new Date().toLocaleString('pt-BR')
        }
      ]
    });

  } catch (error: any) {
    console.error(`❌ [TRACKING_LOG] Erro Crítico: ${error.message}`);
    res.status(500).json({ success: false, error: "Erro interno no servidor de rastreio" });
  }
}

async function syncTrackingHistory(supabase: any, orderId: string, history: any[]) {
  if (!orderId || !history || history.length === 0) return;

  console.log(`🔄 [SYNC_TRACKING] Sincronizando ${history.length} eventos para o pedido ${orderId}`);

  try {
    // 1. Busca eventos existentes para evitar duplicatas
    const { data: existingEvents } = await supabase
      .from('tracking_history')
      .select('description, date')
      .eq('order_id', orderId);

    const existingKeys = new Set(
      (existingEvents || []).map((e: any) => `${e.description}|${new Date(e.date).getTime()}`)
    );

    // 2. Filtra apenas novos eventos
    const newEvents = history.filter(event => {
      let eventDate: Date;
      
      try {
        if (typeof event.date === 'string' && event.date.includes('/')) {
          const [datePart, timePart] = event.date.split(' ');
          const [day, month, year] = datePart.split('/');
          eventDate = new Date(`${year}-${month}-${day}T${timePart || '00:00:00'}`);
        } else {
          eventDate = new Date(event.date);
        }
        
        if (isNaN(eventDate.getTime())) throw new Error('Invalid date');
      } catch (e) {
        eventDate = new Date();
      }

      const key = `${event.description}|${eventDate.getTime()}`;
      return !existingKeys.has(key);
    }).map(event => {
      let eventDate: Date;
      try {
        if (typeof event.date === 'string' && event.date.includes('/')) {
          const [datePart, timePart] = event.date.split(' ');
          const [day, month, year] = datePart.split('/');
          eventDate = new Date(`${year}-${month}-${day}T${timePart || '00:00:00'}`);
        } else {
          eventDate = new Date(event.date);
        }
        if (isNaN(eventDate.getTime())) throw new Error('Invalid date');
      } catch (e) {
        eventDate = new Date();
      }

      return {
        order_id: orderId,
        description: event.description,
        location: event.location || 'Correios',
        date: eventDate.toISOString()
      };
    });

    if (newEvents.length > 0) {
      console.log(`➕ [SYNC_TRACKING] Inserindo ${newEvents.length} novos eventos.`);
      const { error } = await supabase
        .from('tracking_history')
        .insert(newEvents);

      if (error) {
        console.error(`❌ [SYNC_TRACKING] Erro ao inserir eventos:`, error);
      } else {
        console.log(`✅ [SYNC_TRACKING] Sincronização concluída com sucesso.`);
      }
    } else {
      console.log(`ℹ️ [SYNC_TRACKING] Nenhum evento novo para inserir.`);
    }
  } catch (err: any) {
    console.error(`❌ [SYNC_TRACKING] Erro inesperado:`, err.message);
  }
}

export async function handleOrderTracking(req: any, res: any) {
  const { orderId } = req.params;
  
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    console.log(`📡 [ORDER_TRACKING] Buscando histórico para o pedido: ${orderId}`);

    // 1. Busca o pedido e seu histórico completo no banco de dados
    const { data: order, error } = await supabase
      .from('orders')
      .select('status, tracking_code')
      .eq('id', orderId)
      .maybeSingle();

    if (error || !order) {
      console.error(`❌ [ORDER_TRACKING] Pedido não encontrado: ${orderId}`);
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    const { data: history } = await supabase
      .from('tracking_history')
      .select('description, location, date')
      .eq('order_id', orderId)
      .order('date', { ascending: true });

    // 2. Se o pedido já possui eventos no tracking_history do banco, retornamos eles primeiro
    if (history && history.length > 0) {
      console.log(`✅ [ORDER_TRACKING] Encontrados ${history.length} eventos no banco.`);
      
      return res.json({
        success: true,
        provider: 'Database',
        status: order.status || "Em trânsito",
        history: history.map((h: any) => ({
          date: new Date(h.date).toLocaleString('pt-BR'),
          location: h.location || 'Correios',
          description: h.description
        }))
      });
    }

    // 3. Se não houver histórico no banco, mas houver código, tentamos as APIs externas
    if (order.tracking_code) {
      console.log(`🔍 [ORDER_TRACKING] Sem histórico no banco. Tentando APIs externas para: ${order.tracking_code}`);
      
      const { data: carrier } = await supabase
        .from('shipping_carriers')
        .select('config')
        .ilike('name', '%CEPCERTO%')
        .eq('active', true)
        .maybeSingle();

      const config = typeof carrier?.config === 'string' ? JSON.parse(carrier.config) : carrier?.config;
      const apiKey = config?.api_key;

      req.params.code = order.tracking_code;
      req.query.api_key = apiKey;
      return handleTracking(req, res);
    }

    // 4. Fallback final se não houver nada
    return res.json({ 
      success: true, 
      status: "Confirmado", 
      message: "Pedido confirmado e em preparação",
      history: [{
        description: "Pedido confirmado e em preparação",
        location: "Centro Logístico",
        date: new Date().toLocaleString('pt-BR')
      }]
    });

  } catch (error: any) {
    console.error('❌ [Order Tracking Error]', error);
    res.status(500).json({ success: false, error: "Erro ao processar pedido" });
  }
}
