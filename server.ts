import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Rota de callback para OAuth (Popup)
  // Esta rota apenas repassa o código para a janela pai, que fará a troca (PKCE)
  app.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    const error = req.query.error as string;
    const error_description = req.query.error_description as string;

    console.log('🔑 Callback de auth atingido no servidor');

    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Autenticando...</title></head>
        <body>
          <script>
            try {
              const code = ${JSON.stringify(code)};
              const error = ${JSON.stringify(error)};
              const error_description = ${JSON.stringify(error_description)};

              if (window.opener) {
                if (code) {
                  window.opener.postMessage({ type: 'AUTH_CODE', code }, '*');
                } else if (error) {
                  window.opener.postMessage({ type: 'AUTH_ERROR', error, description: error_description }, '*');
                }
                // Aguarda um pouco para garantir o envio e fecha
                setTimeout(() => window.close(), 1000);
              } else {
                window.location.href = '/';
              }
            } catch (e) {
              console.error('Erro no script de callback:', e);
              window.close();
            }
          </script>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center; padding: 20px;">
            <div style="max-width: 400px;">
              <h2 style="color: #4f46e5;">Processando Autenticação...</h2>
              <p style="color: #64748b;">Esta janela fechará automaticamente em instantes.</p>
            </div>
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
