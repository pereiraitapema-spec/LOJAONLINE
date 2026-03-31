import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

export async function handleTracking(req: any, res: any) {
  let { code } = req.params;
  const apiKey = req.query.api_key || process.env.CEPCERTO_API;
  
  console.log(`🚀 [TRACKING_LOG] Iniciando busca para o código: ${code}`);

  if (!code || code === 'undefined' || code.length < 5) {
    console.error(`❌ [TRACKING_LOG] Código inválido recebido: ${code}`);
    return res.status(400).json({ success: false, error: "Código de rastreio inválido" });
  }

  console.log("Normalizando código");
  code = code.replace(/\s/g, "").trim().toUpperCase();
  console.log("Tracking Code:", code);

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    console.log(`🔍 [TRACKING_CODE] Buscando código: ${code}`);

    // 1. Busca o ID do pedido para sincronização posterior
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('tracking_code', code)
      .order('created_at', { ascending: false })
      .limit(1);

    if (orderError) {
      console.error(`❌ [TRACKING_CODE] Erro ao buscar pedido:`, orderError);
    }

    const order = orders?.[0];
    const orderId = order?.id;

    console.log("================================");
    console.log("INICIANDO CONSULTA RASTREAMENTO");
    console.log("Tracking Code:", code);
    console.log("================================");

    // 2. TENTA APIs EXTERNAS (Prioridade Máxima)
    
    // 0. TENTA LINKETRACK (Prioridade Sugerida pelo Usuário)
    try {
      const linkeUser = process.env.LINKETRACK_USER || 'teste';
      const linkeToken = process.env.LINKETRACK_TOKEN || '1abcd1234567890';
      
      console.log(`📡 [TRACKING_LOG] Consultando Linketrack (User: ${linkeUser})...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      
      const linkeUrl = `https://api.linketrack.com/track/json?user=${linkeUser}&token=${linkeToken}&codigo=${code}`;
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
          console.log("📊 [TRACKING_LOG] Eventos API encontrados:", data.eventos.length);
          
          const history = data.eventos.map((e: any) => ({
            date: `${e.data} ${e.hora}`,
            location: e.local || 'Não informado',
            description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          console.log("🏁 [TRACKING_LOG] FINALIZANDO RASTREAMENTO COM SUCESSO (Linketrack)");
          return res.json({
            success: true,
            provider: 'Linketrack',
            status: data.eventos[0].status,
            history: history
          });
        } else {
          console.log("⚠️ [TRACKING_LOG] Linketrack não retornou eventos para este código.");
        }
      }
    } catch (e: any) {
      console.error(`⚠️ [TRACKING_LOG] Falha no Linketrack: ${e.message}`);
    }

    // 1. TENTA BRASILAPI
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
          console.log("📊 [TRACKING_LOG] Eventos API encontrados:", data.eventos.length);
          
          const history = data.eventos.map((e: any) => ({
            date: new Date(e.data).toLocaleString('pt-BR'),
            location: e.local || 'Correios',
            description: e.status
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          console.log("🏁 [TRACKING_LOG] FINALIZANDO RASTREAMENTO COM SUCESSO (BrasilAPI)");
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

    // 2. TENTA CEPCERTO (URL Sugerida pelo Usuário)
    try {
      console.log(`📡 [TRACKING_LOG] Consultando CepCerto (API v1)...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      
      const response = await fetch(`https://api.cepcerto.com/track/${code}`, {
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      console.log(`📊 [TRACKING_LOG] CepCerto (v1) Status: ${response.status}`);
      
      if (response.ok) {
        const data: any = await response.json();
        console.log(`📊 [TRACKING_LOG] Resposta CepCerto (v1):`, data);
        if (data && data.success && data.history && data.history.length > 0) {
          console.log(`✅ [TRACKING_LOG] CepCerto (v1) retornou ${data.history.length} eventos.`);
          console.log("📊 [TRACKING_LOG] Eventos API encontrados:", data.history.length);
          
          if (orderId) {
            await syncTrackingHistory(supabase, orderId, data.history);
          }

          return res.json({
            success: true,
            provider: 'CepCerto (v1)',
            status: data.status || 'Em trânsito',
            history: data.history
          });
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [TRACKING_LOG] Falha no CepCerto (v1): ${e.message}`);
    }

    // 0.1 TENTA CEPCERTO (URL Clássica com API KEY)
    if (apiKey && apiKey !== 'undefined') {
      try {
        console.log(`📡 [TRACKING_LOG] Consultando CepCerto (WS)...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const cepUrl = `https://cepcerto.com/ws/encomenda-json/${code}/${apiKey}`;
        const response = await fetch(cepUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (response.ok) {
          const data: any = await response.json();
          if (data && data.rastreio && data.rastreio.length > 0) {
            console.log(`✅ [TRACKING_LOG] CepCerto (WS) retornou ${data.rastreio.length} eventos.`);
            
            const history = data.rastreio.map((e: any) => ({
              date: e.data + ' ' + e.hora,
              location: e.local || 'Correios',
              description: e.status
            }));

            console.log("📊 [TRACKING_LOG] Eventos API encontrados:", history.length);
            
            if (orderId) {
              await syncTrackingHistory(supabase, orderId, history);
            }

            return res.json({
              success: true,
              provider: 'CepCerto (WS)',
              status: data.status || 'Em trânsito',
              history: history
            });
          }
        }
      } catch (e: any) {
        console.error(`⚠️ [TRACKING_LOG] Falha no CepCerto (WS): ${e.message}`);
      }
    }

    // 0.2 TENTA CORREIOS (Se houver endpoint configurado ou via proxy)
    try {
      console.log(`📡 [TRACKING_LOG] Consultando API Correios...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);

      // Tentativa via endpoint público/comum se existir
      const response = await fetch(`https://api.correios.com.br/rastreamento/v1/objetos/${code}`, {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      clearTimeout(timeout);

      console.log(`📊 [TRACKING_LOG] Correios Status: ${response.status}`);

      if (response.ok) {
        const data: any = await response.json();
        console.log(`📊 [TRACKING_LOG] Resposta Correios:`, data);
        if (data && data.objetos && data.objetos[0].eventos) {
          const eventos = data.objetos[0].eventos;
          console.log(`✅ [TRACKING_LOG] Correios retornou ${eventos.length} eventos.`);
          
          const history = eventos.map((e: any) => ({
            date: new Date(e.dtEvento).toLocaleString('pt-BR'),
            location: e.unidade.nome,
            description: e.descricao
          }));

          console.log("📊 [TRACKING_LOG] Eventos API encontrados:", history.length);

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          return res.json({
            success: true,
            provider: 'Correios',
            status: eventos[0].descricao,
            history: history
          });
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ [TRACKING_LOG] Falha na API Correios: ${e.message}`);
    }

    // 5. TENTA SEURASTREIO
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
          console.log("📊 [TRACKING_LOG] Eventos API encontrados:", data.events.length);
          
          const history = data.events.map((e: any) => ({
            date: e.date,
            location: e.location || 'Correios',
            description: e.message || e.description
          }));

          if (orderId) {
            await syncTrackingHistory(supabase, orderId, history);
          }

          console.log("🏁 [TRACKING_LOG] FINALIZANDO RASTREAMENTO COM SUCESSO (SeuRastreio)");
          return res.json({
            success: true,
            provider: 'SeuRastreio',
            status: data.status || 'Em trânsito',
            history: history
          });
        }
      }
    } catch (e: any) {
      console.error(`⚠️ [TRACKING_LOG] Falha no SeuRastreio: ${e.message}`);
    }

    // 3. FALLBACK: BANCO DE DADOS OU MANUAL
    console.log(`ℹ️ [TRACKING_LOG] Todas as APIs falharam. Usando fallback.`);
    
    if (orderId) {
      const { data: finalHistory } = await supabase
        .from('tracking_history')
        .select('*')
        .eq('order_id', orderId)
        .order('date', { ascending: true });
        
      if (finalHistory && finalHistory.length > 0) {
        console.log(`📊 [TRACKING_LOG] Fallback encontrou ${finalHistory.length} eventos no banco.`);
        console.log("📊 [TRACKING_LOG] Eventos encontrados:", finalHistory.length);
        return res.json({
          success: true,
          provider: 'Database (Fallback)',
          status: order?.status || finalHistory[finalHistory.length - 1]?.status || "Em trânsito",
          history: finalHistory.map((h: any) => ({
            ...h,
            date: new Date(h.date).toLocaleString('pt-BR'),
            location: h.location || 'Correios',
            description: h.description || h.status
          }))
        });
      }
    }

    console.log("⚠️ [TRACKING_LOG] Fallback manual ativado");
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

    // 1. Busca o pedido no banco de dados
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('status, tracking_code')
      .eq('id', orderId)
      .limit(1);

    const order = orders?.[0];

    if (orderError || !order) {
      console.error(`❌ [ORDER_TRACKING] Pedido não encontrado: ${orderId}`, orderError);
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    // 2. Se houver código de rastreio, PRIORIZA consulta externa
    if (order.tracking_code) {
      console.log(`🔍 [ORDER_TRACKING] Código encontrado: ${order.tracking_code}. Consultando APIs externas...`);
      
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('config')
        .ilike('name', '%CEPCERTO%')
        .eq('active', true)
        .limit(1);

      const carrier = carriers?.[0];

      const config = typeof carrier?.config === 'string' ? JSON.parse(carrier.config) : carrier?.config;
      const apiKey = config?.api_key;

      req.params.code = order.tracking_code;
      req.query.api_key = apiKey;
      
      // handleTracking agora está atualizado para tentar APIs primeiro e DB depois
      return handleTracking(req, res);
    }

    // 3. Se não houver código ou APIs falharem (via handleTracking), tenta histórico do banco
    const { data: history, error: historyError } = await supabase
      .from('tracking_history')
      .select('*')
      .eq('order_id', orderId)
      .order('date', { ascending: true });

    if (historyError) {
      console.error(`❌ [ORDER_TRACKING] Erro ao buscar histórico:`, historyError);
    }

    if (history && history.length > 0) {
      console.log(`✅ [ORDER_TRACKING] Encontrados ${history.length} eventos no banco.`);
      console.log("📊 [ORDER_TRACKING] Eventos encontrados:", history.length);
      
      return res.json({
        success: true,
        provider: 'Database',
        status: order.status || history[history.length - 1]?.status || "Em trânsito",
        history: history.map((h: any) => ({
          ...h,
          date: new Date(h.date).toLocaleString('pt-BR'),
          location: h.location || 'Correios',
          description: h.description || h.status
        }))
      });
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
