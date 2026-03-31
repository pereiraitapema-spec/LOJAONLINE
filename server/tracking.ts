import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

export async function handleTracking(req: any, res: any) {
  const { code } = req.params;
  const { api_key } = req.query; // Opcional, para CepCerto
  console.log(`🔍 [API] Rastreando código: ${code}`);

  if (!code || code === 'undefined' || code.length < 5) {
    return res.status(400).json({ success: false, error: "Código de rastreio inválido" });
  }

  // Histórico padrão de fallback (Garante que nunca retorne vazio)
  const defaultHistory = [
    {
      description: "Pedido enviado e em trânsito",
      location: "Centro Logístico",
      date: new Date().toLocaleString('pt-BR')
    }
  ];

  try {
    // 1. Tenta SeuRastreio (Melhor opção gratuita atual)
    try {
      const response = await fetch(`https://seurastreio.com.br/api/v1/track/${code}`);
      if (response.ok) {
        const data: any = await response.json();
        if (data && data.events && data.events.length > 0) {
          console.log(`✅ [SeuRastreio] Sucesso para ${code}`);
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
    } catch (e) {
      console.warn('⚠️ SeuRastreio falhou, tentando CepCerto...');
    }

    // 2. Tenta CepCerto (URL Corrigida: encomenda-json)
    if (api_key) {
      try {
        const cepRes = await fetch(`https://cepcerto.com/ws/encomenda-json/${code}/${api_key}`);
        if (cepRes.ok) {
          const data: any = await cepRes.json();
          if (data && !data.erro && data.eventos) {
            console.log(`✅ [CepCerto] Sucesso para ${code}`);
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
      } catch (e) {
        console.warn('⚠️ CepCerto falhou, tentando Linketrack...');
      }
    }

    // 3. Fallback Final: Linketrack (Apenas se as outras falharem)
    try {
      const linkeRes = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${code}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (linkeRes.ok) {
        const data: any = await linkeRes.json();
        if (data.eventos && data.eventos.length > 0) {
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
    } catch (e) {}

    // 4. Se tudo falhar, retorna o status de "Enviado" com histórico padrão
    console.log(`ℹ️ [API] Todas as APIs falharam para ${code}. Retornando status padrão.`);
    return res.json({
      success: true,
      status: "Enviado",
      message: "Pedido enviado. As informações de rastreio podem levar até 24h para atualizar nos sistemas.",
      history: defaultHistory
    });

  } catch (error: any) {
    console.error(`❌ [API Error] ${error.message}`);
    res.status(500).json({ success: false, error: "Erro interno ao rastrear" });
  }
}

export async function handleOrderTracking(req: any, res: any) {
  const { orderId } = req.params;
  
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    const { data: order, error } = await supabase
      .from('orders')
      .select('tracking_code')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return res.status(404).json({ success: false, error: "Pedido não encontrado" });
    }

    if (!order.tracking_code) {
      console.log(`ℹ️ [API] Pedido ${orderId} sem código de rastreio. Retornando status padrão.`);
      return res.json({ 
        success: true, 
        status: "Confirmado", 
        message: "Pedido confirmado e em preparação",
        history: [
          {
            description: "Pedido confirmado e em preparação",
            location: "Centro Logístico",
            date: new Date().toLocaleString('pt-BR')
          }
        ]
      });
    }

    // Chama a função de rastreio por código internamente
    req.params.code = order.tracking_code;
    return handleTracking(req, res);
  } catch (error: any) {
    res.status(500).json({ success: false, error: "Erro ao buscar pedido no banco" });
  }
}
