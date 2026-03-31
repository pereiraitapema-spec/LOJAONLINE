import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

export async function handleTracking(req: any, res: any) {
  const { code } = req.params;
  console.log(`🔍 [API] Rastreando código: ${code}`);

  if (!code || code === 'undefined') {
    return res.status(400).json({ success: false, error: "Código de rastreio inválido" });
  }

  try {
    // 1. Tenta BrasilAPI (Oficial Correios)
    const response = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${code}`);
    if (response.ok) {
      const data = await response.json() as any;
      console.log(`✅ [BrasilAPI] Sucesso para ${code}`);
      return res.json({
        success: true,
        provider: 'BrasilAPI',
        status: data.status,
        history: (data.historico || []).map((e: any) => ({
          date: e.data,
          location: `${e.unidade} - ${e.cidade}/${e.uf}`,
          description: e.descricao
        }))
      });
    }

    // 2. Fallback: Linketrack
    console.log(`🔄 [Fallback] Tentando Linketrack para ${code}...`);
    const linkeRes = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${code}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (linkeRes.ok) {
      const data: any = await linkeRes.json();
      if (data.eventos && data.eventos.length > 0) {
        console.log(`✅ [Linketrack] Sucesso para ${code}`);
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

    res.status(404).json({ success: false, error: "Rastreio não encontrado nas bases públicas" });
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
