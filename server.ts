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

  // 2. Rastreio Direto por Código (BrasilAPI + Linketrack)
  app.get("/api/tracking/code/:code", handleTracking);

  // 3. Rastreio por ID do Pedido (Busca no Supabase)
  app.get("/api/tracking/order/:orderId", handleOrderTracking);

  // 4. Proxy para Rastreio CepCerto (CORS Fix)
  app.all("/api/tracking/cepcerto", async (req, res) => {
    const { tracking_code, api_key } = { ...req.query, ...req.body };
    if (!tracking_code || !api_key) return res.status(400).json({ error: 'Dados incompletos' });

    try {
      const response = await fetch(`https://www.cepcerto.com/ws/json-rastreio/${tracking_code}/${api_key}`);
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
