import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // API routes would go here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Rota de callback para OAuth (Popup)
  // Esta rota precisa estar ANTES do middleware do Vite para interceptar o redirecionamento
  app.get("/auth/callback", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Autenticando...</title>
        </head>
        <body>
          <script>
            if (window.opener) {
              // Enviar mensagem para a janela principal
              window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
              // Fechar o popup
              window.close();
            } else {
              // Se não for popup, redirecionar para a home
              window.location.href = '/';
            }
          </script>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
            <p>Autenticação concluída. Esta janela fechará automaticamente...</p>
          </div>
        </body>
      </html>
    `);
  });

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
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
