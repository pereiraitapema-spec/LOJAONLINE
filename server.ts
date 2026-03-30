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
  app.post("/api/tracking/melhorenvio", express.json(), async (req, res) => {
    const { tracking_code, api_key } = req.body;
    try {
      const response = await fetch('https://www.melhorenvio.com.br/api/v2/me/shipment/tracking', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${api_key}`
        },
        body: JSON.stringify({ tracking_code })
      });
      const data = await response.json();
      res.status(response.status).json(data);
    } catch (error) {
      console.error('❌ Erro no proxy Melhor Envio:', error);
      res.status(500).json({ error: 'Erro ao contatar Melhor Envio' });
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
