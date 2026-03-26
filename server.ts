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

  // Proxy para Pagar.me (Segurança: chaves no servidor)
  app.post("/api/payments/pagarme", express.json(), async (req, res) => {
    const { orderData, config } = req.body;
    
    console.log('🚀 Iniciando pagamento Pagar.me...');
    console.log('📦 Dados do Pedido:', JSON.stringify(orderData, null, 2));
    
    if (!config?.access_token) {
      console.error('❌ Erro: Access Token não configurado no gateway.');
      return res.status(400).json({ success: false, error: 'Access Token não configurado.' });
    }

    try {
      // Pagar.me V5 usa Basic Auth com a API Key como username e senha vazia
      // O formato deve ser: Basic base64(api_key:)
      const token = config.access_token.trim();
      const authHeader = `Basic ${Buffer.from(token + ':').toString('base64')}`;
      
      console.log('📡 Enviando requisição para Pagar.me V5...');
      console.log('🔑 Token (primeiros 6 caracteres):', token.substring(0, 6) + '...');
      
      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      const data = await response.json();
      
      console.log(`📡 Resposta Pagar.me (Status ${response.status}):`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('❌ Erro na API do Pagar.me:', data.message || data.errors || 'Erro desconhecido');
      } else {
        console.log('✅ Pagamento processado com sucesso pela API.');
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('💥 Erro crítico no proxy Pagar.me:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Webhook Pagar.me
  app.post("/api/webhooks/pagarme", express.json(), async (req, res) => {
    const event = req.body;
    console.log('🔔 Webhook Pagar.me recebido:', event.type);
    console.log('📄 Dados do Evento:', JSON.stringify(event, null, 2));

    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    try {
      // Lógica para atualizar o status do pedido com base no evento
      // Eventos comuns: order.paid, order.payment_failed, order.canceled
      const orderId = event.data.id;

      if (event.type === 'order.paid') {
        const { data: order, error: fetchError } = await supabaseAdmin
          .from('orders')
          .select('*')
          .eq('payment_id', orderId)
          .single();

        if (fetchError) throw fetchError;

        // 1. Atualizar status do pedido para PAGO
        const { error: updateError } = await supabaseAdmin
          .from('orders')
          .update({ 
            status: 'paid', 
            updated_at: new Date().toISOString() 
          })
          .eq('payment_id', orderId);
        
        if (updateError) throw updateError;
        console.log(`✅ Pedido ${orderId} marcado como PAGO.`);

        // 2. Simular aviso ao CepCerto e geração de rastreio
        // Em um cenário real, aqui chamaríamos a API do CepCerto/Melhor Envio
        const trackingCode = `BR${Math.random().toString(36).substr(2, 9).toUpperCase()}X`;
        
        await supabaseAdmin
          .from('orders')
          .update({ 
            tracking_code: trackingCode,
            status: 'processing' // Preparando produto
          })
          .eq('payment_id', orderId);

        console.log(`📦 Rastreio gerado para pedido ${orderId}: ${trackingCode}`);

        // 3. (Opcional) Enviar mensagem via chat/email
        // Aqui você integraria com seu serviço de chat ou dispararia um email
      } else if (event.type === 'order.payment_failed') {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('payment_id', orderId);
        console.log(`❌ Pagamento falhou para pedido ${orderId}.`);
      } else if (event.type === 'order.canceled') {
        await supabaseAdmin
          .from('orders')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('payment_id', orderId);
        console.log(`🚫 Pedido ${orderId} cancelado.`);
      }

      res.status(200).send('OK');
    } catch (error: any) {
      console.error('❌ Erro no Webhook Pagar.me:', error.message);
      res.status(500).send('Erro');
    }
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
