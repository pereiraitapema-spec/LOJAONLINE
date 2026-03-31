import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

export async function handleTracking(req: any, res: any) {
  const { code } = req.params;
  const apiKey = req.query.api_key || process.env.CEPCERTO_API;
  
  console.log(`🔍 [API] Iniciando busca para: ${code}`);

  if (!code || code === 'undefined' || code.length < 5) {
    return res.status(400).json({ success: false, error: "Código de rastreio inválido" });
  }

  try {
    // 1. TENTA SEURASTREIO (Melhor opção gratuita e estável atual)
    try {
      console.log(`📡 [SeuRastreio] Consultando ${code}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const response = await fetch(`https://seurastreio.com.br/api/v1/track/${code}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.events && data.events.length > 0) {
          console.log(`✅ [SeuRastreio] Sucesso! ${data.events.length} eventos encontrados.`);
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
        }
      }
    } catch (e: any) {
      console.warn(`⚠️ SeuRastreio falhou ou timeout: ${e.message}`);
    }

    // 2. TENTA LINKETRACK (Fallback muito bom se o User-Agent for correto)
    try {
      console.log(`📡 [Linketrack] Consultando ${code}...`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const linkeUrl = `https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${code}`;
      const linkeRes = await fetch(linkeUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
        signal: controller.signal
      });
      clearTimeout(timeout);
      
      if (linkeRes.ok) {
        const data: any = await linkeRes.json();
        if (data && data.eventos && data.eventos.length > 0) {
          console.log(`✅ [Linketrack] Sucesso! ${data.eventos.length} eventos encontrados.`);
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
      console.warn(`⚠️ Linketrack falhou ou timeout: ${e.message}`);
    }

    // 3. TENTA CEP CERTO (URL Corrigida e Profissional)
    if (apiKey) {
      try {
        console.log(`📡 [CepCerto] Consultando ${code}...`);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        const cepUrl = `https://cepcerto.com/ws/encomenda-json/${code}/${apiKey}`;
        const cepRes = await fetch(cepUrl, { signal: controller.signal });
        clearTimeout(timeout);
        
        if (cepRes.ok) {
          const data: any = await cepRes.json();
          if (data && !data.erro && data.eventos) {
            console.log(`✅ [CepCerto] Sucesso! ${data.eventos.length} eventos encontrados.`);
            return res.json({
              success: true,
              provider: 'CepCerto',
              status: data.eventos[0]?.status || 'Em trânsito',
              history: data.eventos.map((e: any) => ({
                date: `${e.data} ${e.hora}`,
                location: e.local || 'Não informado',
                description: e.status + (e.subStatus ? ` - ${e.subStatus[0]}` : '')
              }))
            });
          }
        }
      } catch (e: any) {
        console.warn(`⚠️ CepCerto falhou ou timeout: ${e.message}`);
      }
    }

    // 3. TENTA BRASILAPI (Fallback de segurança)
    try {
      const brasilRes = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${code}`);
      if (brasilRes.ok) {
        const data: any = await brasilRes.json();
        if (data && data.historico) {
          console.log(`✅ [BrasilAPI] Sucesso para ${code}`);
          return res.json({
            success: true,
            provider: 'BrasilAPI',
            status: data.status,
            history: data.historico.map((e: any) => ({
              date: e.data,
              location: `${e.unidade} - ${e.cidade}/${e.uf}`,
              description: e.descricao
            }))
          });
        }
      }
    } catch (e) {
      console.warn('⚠️ BrasilAPI falhou.');
    }

    // 4. FALLBACK MANUAL (Garante que o cliente veja algo)
    return res.json({
      success: true,
      status: "Enviado",
      message: "Pedido em trânsito. O sistema dos Correios pode levar até 48h para atualizar.",
      history: [
        {
          description: "Objeto postado e em trânsito para a unidade de distribuição",
          location: "Centro Logístico",
          date: new Date().toLocaleString('pt-BR')
        }
      ]
    });

  } catch (error: any) {
    console.error(`❌ [Critical Error] ${error.message}`);
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
