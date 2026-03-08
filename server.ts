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
  // Esta rota lida com a troca do código PKCE no servidor para evitar o fallback do AI Studio
  app.get("/auth/callback", async (req, res) => {
    const code = req.query.code as string;
    const next = (req.query.next as string) || "/";

    console.log('🔑 Recebido código de auth no servidor');

    let sessionData = null;

    if (code) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      
      if (supabaseUrl && supabaseAnonKey) {
        try {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          
          if (!error && data.session) {
            sessionData = data.session;
            console.log('✅ Sessão trocada com sucesso no servidor para:', sessionData.user.email);
          } else {
            console.error('❌ Erro na troca de código:', error?.message);
          }
        } catch (err) {
          console.error('❌ Erro crítico no callback:', err);
        }
      }
    }

    // Retornamos um HTML minimalista que:
    // 1. Salva a sessão no localStorage (compartilhado com o iframe)
    // 2. Avisa a janela pai (o app no iframe)
    // 3. Fecha o popup
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Autenticando...</title></head>
        <body>
          <script>
            try {
              const session = ${JSON.stringify(sessionData)};
              const storageKey = 'sb-auth-token'; // Deve bater com o definido no supabase.ts
              
              if (session) {
                localStorage.setItem(storageKey, JSON.stringify(session));
              }

              if (window.opener) {
                window.opener.postMessage({ type: 'AUTH_SUCCESS', session }, '*');
                setTimeout(() => window.close(), 500);
              } else {
                window.location.href = '${next}';
              }
            } catch (e) {
              console.error('Erro no script de callback:', e);
              window.close();
            }
          </script>
          <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; text-align: center;">
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
