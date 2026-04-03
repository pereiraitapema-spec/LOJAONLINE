import express from "express";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { handleTracking, handleOrderTracking } from "./server/tracking";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware CORS e JSON
  app.use(cors());
  app.use(express.json());
  app.set('trust proxy', 1);

  // 1. Rota de Saúde (Health Check)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "API de Rastreio Ativa" });
  });

  // 2. Rastreio Direto por Código (BrasilAPI + Linketrack + CepCerto)
  app.get("/api/tracking/code/:code", handleTracking);

  // 3. Rastreio por ID do Pedido (Busca no Supabase)
  app.get("/api/tracking/order/:orderId", handleOrderTracking);

  // 4. Rota de Compatibilidade e Rastreio Direto (Prioriza Código se não for UUID)
  app.get("/api/tracking/:idOrCode", async (req, res) => {
    const { idOrCode } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode) || 
                   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);
    
    if (isUuid) {
      (req.params as any).orderId = idOrCode;
      return handleOrderTracking(req, res);
    } else {
      (req.params as any).code = idOrCode;
      return handleTracking(req, res);
    }
  });

  // 5. Proxy para Rastreio CepCerto (CORS Fix)
  app.all("/api/tracking/cepcerto", async (req, res) => {
    const { tracking_code, api_key } = { ...req.query, ...req.body };
    if (!tracking_code || !api_key) return res.status(400).json({ error: 'Dados incompletos' });

    try {
      const response = await fetch(`https://cepcerto.com/ws/encomenda-json/${tracking_code}/${api_key}`);
      const text = await response.text();
      try {
        res.json(JSON.parse(text));
      } catch {
        res.send(text);
      }
    } catch (error) {
      res.status(500).json({ error: 'Erro ao contatar CepCerto' });
    }
  });

  // Proxy para Postagem CepCerto
  app.post("/api/cepcerto/postagem", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (POSTAGEM)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-postagem-frete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (POSTAGEM)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (POSTAGEM)", error);
      res.status(500).json({ error: 'Erro ao processar postagem no CepCerto' });
    }
  });

  // Proxy para Cotação CepCerto
  app.post("/api/cepcerto/cotacao", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (COTACAO)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-cotacao/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (COTACAO)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (COTACAO)", error);
      res.status(500).json({ error: 'Erro ao processar cotação no CepCerto' });
    }
  });

  // Proxy para Crédito/PIX CepCerto
  app.post("/api/cepcerto/credito", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (CREDITO)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-credito/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (CREDITO)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (CREDITO)", error);
      res.status(500).json({ error: 'Erro ao processar crédito no CepCerto' });
    }
  });

  // Proxy para Cancelamento CepCerto
  app.post("/api/cepcerto/cancelamento", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (CANCELAMENTO)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-cancela-postagem/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (CANCELAMENTO)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (CANCELAMENTO)", error);
      res.status(500).json({ error: 'Erro ao processar cancelamento no CepCerto' });
    }
  });

  // Proxy para Consulta CepCerto
  app.post("/api/cepcerto/consulta", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (CONSULTA)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-consulta-postagem/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (CONSULTA)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (CONSULTA)", error);
      res.status(500).json({ error: 'Erro ao processar consulta no CepCerto' });
    }
  });

  // 5. Proxy para Rastreio Linketrack (CORS Fix)
  app.all("/api/tracking/linketrack", async (req, res) => {
    const { tracking_code } = { ...req.query, ...req.body };
    if (!tracking_code) return res.status(400).json({ error: 'Código obrigatório' });

    try {
      const response = await fetch(`https://api.linketrack.com/track/json?user=teste&token=1abcd1234567890&codigo=${tracking_code}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      res.json(await response.json());
    } catch (error) {
      res.status(500).json({ error: 'Erro ao contatar Linketrack' });
    }
  });

  // Middleware de Frontend (Vite ou Estático)
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
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
    console.log(`🚀 Servidor rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
