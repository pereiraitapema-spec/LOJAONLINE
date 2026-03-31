import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';
import { logisticsService } from './server/logistics';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware CORS
  app.use(cors());
  app.use(express.json()); // Essencial para ler o body da requisição

  // Profissional: Confiar no proxy reverso
  app.set('trust proxy', 1);

  // Proxy para Pagar.me (Segurança: chaves no servidor)
  app.post("/api/payments/pagarme", express.json(), async (req, res) => {
    console.log('📥 Rota /api/payments/pagarme atingida!');
    const { orderData, config } = req.body;
    
    console.log('🚀 Iniciando pagamento Pagar.me...');
    console.log('📦 Dados do Pedido:', JSON.stringify(orderData, null, 2));
    
    res.status(501).json({ success: false, error: 'Implementação Pagar.me pendente' });
  });

  // Proxy para Rastreio Melhor Envio (CORS Fix)
  app.all("/api/tracking/melhorenvio", express.json(), async (req, res) => {
    const { tracking_code, api_key } = { ...req.query, ...req.body };
    if (!tracking_code || !api_key) {
      return res.status(400).json({ error: 'Código de rastreio e chave API são obrigatórios' });
    }

    try {
      const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`,
          'User-Agent': 'Magnifique4Life (contato@magnifique4life.com.br)'
        },
        body: JSON.stringify({ orders: [tracking_code] })
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('❌ Erro no proxy Melhor Envio:', error);
      res.status(500).json({ error: 'Erro ao contatar Melhor Envio', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Proxy para Rastreio CepCerto (CORS Fix)
  app.all("/api/tracking/cepcerto", async (req, res) => {
    const { tracking_code, api_key } = { ...req.query, ...req.body };
    
    if (!tracking_code || !api_key) {
      return res.status(400).json({ error: 'Código de rastreio e chave API são obrigatórios' });
    }

    console.log(`🔍 Proxy CepCerto: Rastreando ${tracking_code}...`);
    
    try {
      // Tenta primeiro com HTTPS, se falhar tenta HTTP (algumas APIs antigas preferem HTTP)
      let apiUrl = `https://www.cepcerto.com/ws/json-rastreio/${tracking_code}/${api_key}`;
      let response = await fetch(apiUrl).catch(() => null);
      
      if (!response || !response.ok) {
        apiUrl = `http://www.cepcerto.com/ws/json-rastreio/${tracking_code}/${api_key}`;
        response = await fetch(apiUrl);
      }

      const text = await response.text();
      console.log(`📦 Resposta CepCerto (${response.status}):`, text.substring(0, 100));
      
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (parseError) {
        res.status(response.status).send(text);
      }
    } catch (error) {
      console.error('❌ Erro no proxy CepCerto:', error);
      res.status(500).json({ 
        error: 'Erro ao contatar CepCerto', 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Proxy para Rastreio Linketrack (CORS Fix)
  app.all("/api/tracking/linketrack", async (req, res) => {
    const { tracking_code } = { ...req.query, ...req.body };
    if (!tracking_code) {
      return res.status(400).json({ error: 'Código de rastreio é obrigatório' });
    }

    try {
      const response = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${tracking_code}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const text = await response.text();
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch (e) {
        res.status(response.status).send(text);
      }
    } catch (error: any) {
      console.error('❌ Erro no proxy Linketrack:', error);
      res.status(500).json({ error: 'Erro ao contatar Linketrack', details: error.message });
    }
  });

  // Endpoint Unificado de Rastreio (Arquitetura Profissional)
  app.get("/api/tracking/:orderId", async (req, res) => {
    const { orderId } = req.params;
    
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase configuration missing');
      }

      const supabase = createClient(supabaseUrl, supabaseKey);

      // 1. Busca o pedido no banco para pegar o tracking_code real
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('tracking_code, carrier, shipping_provider')
        .eq('id', orderId)
        .single();

      if (orderError || !order) {
        return res.status(404).json({ error: 'Pedido não encontrado' });
      }

      const trackingCode = order.tracking_code;

      if (!trackingCode) {
        return res.json({ 
          success: true,
          status: 'Aguardando postagem', 
          message: 'O código de rastreio ainda não foi gerado para este pedido.',
          history: [] 
        });
      }

      console.log(`🔍 Rastreando pedido ${orderId} com código ${trackingCode}...`);

      // 2. Tenta BrasilAPI (Primeira opção para Correios)
      try {
        const brasilRes = await fetch(`https://brasilapi.com.br/api/rastreio/v1/${trackingCode}`);
        if (brasilRes.ok) {
          const data = await brasilRes.json();
          if (data.historico && data.historico.length > 0) {
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
        console.warn('BrasilAPI falhou, tentando fallback...');
      }

      // 3. Fallback: Linketrack
      try {
        const linkeRes = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${trackingCode}`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (linkeRes.ok) {
          const data = await linkeRes.json();
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
      } catch (e) {
        console.warn('Linketrack falhou.');
      }

      res.json({ 
        success: true,
        status: 'Em processamento', 
        message: 'Código gerado, aguardando atualização nos sistemas dos Correios.',
        history: [] 
      });

    } catch (error: any) {
      console.error('❌ Erro no endpoint de rastreio:', error);
      res.status(500).json({ error: 'Erro interno ao consultar rastreio', details: error.message });
    }
  });

  // Middleware de Frontend (Vite ou Estático) - DEVE VIR APÓS AS ROTAS DE API
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist"), {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    app.get("*", (req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
