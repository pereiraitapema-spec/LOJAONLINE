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

  // Profissional: Confiar no proxy reverso (essencial no Railway)
  app.set('trust proxy', 1);

  // Log global para todas as requisições
  app.use((req, res, next) => {
    console.log(`🌐 Requisição recebida: ${req.method} ${req.url}`);
    next();
  });

  // Rota de depuração explícita
  app.post("/api/cepcerto/generate-label", express.json(), async (req, res, next) => {
    console.log('✅ Rota /api/cepcerto/generate-label foi atingida!');
    next();
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy para CepCerto
  console.log('🚀 Registrando rota: POST /api/cepcerto/generate-label');
  app.post("/api/cepcerto/generate-label", express.json(), async (req, res) => {
    const { orderId, apiKeyPostagem } = req.body;
    
    if (!orderId || !apiKeyPostagem) {
      return res.status(400).json({ success: false, error: 'Dados incompletos.' });
    }

    try {
      const url = `https://www.cepcerto.com/ws/json-postagem/${orderId}/${apiKeyPostagem}`;
      console.log('🔗 URL Postagem CepCerto (Proxy):', url);
      
      const response = await fetch(url);
      
      console.log('🔍 Status da resposta CepCerto:', response.status, response.statusText);
      
      const text = await response.text();
      
      if (response.ok) {
        try {
          const data = JSON.parse(text);
          console.log('📦 Resposta Postagem CepCerto (Proxy):', data);
          res.json({ success: true, data });
        } catch (e) {
          console.error('💥 Erro: Resposta do CepCerto não é JSON válido:', text);
          res.status(500).json({ success: false, error: 'Resposta não é JSON', details: text });
        }
      } else {
        console.error('💥 Erro: CepCerto retornou erro:', response.status, text);
        res.status(response.status).json({ success: false, error: 'Erro na API do CepCerto', details: text });
      }
    } catch (error: any) {
      console.error('💥 Erro no proxy CepCerto:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

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
