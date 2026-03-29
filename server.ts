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

  // Rota de API - NO TOPO para evitar interceptação
  app.post("/api/cepcerto/generate-label", async (req, res) => {
    console.log('🚀 Rota /api/cepcerto/generate-label atingida!');
    const { orderId, apiKeyPostagem } = req.body;
    
    if (!orderId || !apiKeyPostagem) {
      return res.status(400).json({ success: false, error: 'Dados incompletos.' });
    }

    try {
      const shortOrderId = orderId.substring(0, 8);
      const url = `https://www.cepcerto.com/ws/json-postagem/${shortOrderId}/${apiKeyPostagem}`;
      console.log('🔗 URL Postagem CepCerto (Proxy):', url);
      
      const response = await fetch(url);
      const text = await response.text();
      
      if (response.ok) {
        try {
          const data = JSON.parse(text);
          return res.json({ success: true, data });
        } catch (e) {
          return res.json({ success: true, data: { raw: text } });
        }
      } else {
        return res.status(response.status).json({ success: false, error: `CepCerto falhou: ${response.statusText}`, details: text });
      }
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  });

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
