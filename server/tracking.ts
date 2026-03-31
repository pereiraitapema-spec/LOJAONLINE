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
            return res.json({
              success: true,
              provider: 'CepCerto',
              status: data.status || 'Em trânsito',
              history: data.rastreio.map((e: any) => ({
                date: e.data + ' ' + e.hora,
                location: e.local || 'Correios',
                description: e.status
              }))
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
          return res.json({
            success: true,
            provider: 'SeuRastreio',
            status: data.status || 'Em trânsito',
            history: data.events.map((e: any) => ({
              date: e.date,
              location: e.location || 'Correios',
              description: e.message || e.description
            }))
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
          return res.json({
            success: true,
            provider: 'BrasilAPI',
            status: data.eventos[0].status || 'Em trânsito',
            history: data.eventos.map((e: any) => ({
              date: new Date(e.data).toLocaleString('pt-BR'),
              location: e.local || 'Correios',
              description: e.status
            }))
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
          return res.json({
            success: true,
            provider: 'Linketrack',
            status: data.eventos[0].status,
            history: data.eventos.map((e: any) => ({
              date: `${e.data} ${e.hora}`,
              location: e.local || 'Não informado',
              description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
            }))
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

export async function handleOrderTracking(req: any, res: any) {
  const { orderId } = req.params;
  
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    // 1. Busca o pedido para pegar o código
    const { data: order, error } = await supabase
      .from('orders')
      .select('tracking_code')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (!order.tracking_code) {
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
    }

    // 2. Busca a API KEY de consulta do CepCerto no banco
    const { data: carrier } = await supabase
      .from('shipping_carriers')
      .select('config')
      .ilike('name', '%CEPCERTO%')
      .eq('active', true)
      .maybeSingle();

    const config = typeof carrier?.config === 'string' ? JSON.parse(carrier.config) : carrier?.config;
    const apiKey = config?.api_key; // Chave de consulta

    // Redireciona para o handler de código com a chave encontrada
    req.params.code = order.tracking_code;
    req.query.api_key = apiKey;
    return handleTracking(req, res);

  } catch (error: any) {
    console.error('❌ [Order Tracking Error]', error);
    res.status(500).json({ success: false, error: "Erro ao processar pedido" });
  }
}
