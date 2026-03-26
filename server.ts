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

  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy para Pagar.me (Segurança: chaves no servidor)
  app.post("/api/payments/pagarme", express.json(), async (req, res) => {
    const { orderData, config: clientConfig, gatewayId } = req.body;
    
    console.log('🚀 Iniciando pagamento Pagar.me...');
    
    let config = clientConfig;

    // Se gatewayId for fornecido, buscar config segura do banco
    if (gatewayId) {
      console.log(`🔍 Buscando configuração segura para gateway: ${gatewayId}`);
      const { data: gateway, error: gatewayError } = await supabaseAdmin
        .from('payment_gateways')
        .select('config')
        .eq('id', gatewayId)
        .single();
      
      if (gatewayError) {
        console.error('❌ Erro ao buscar gateway no banco:', gatewayError.message);
      } else if (gateway?.config) {
        config = gateway.config;
        console.log('✅ Configuração carregada do banco de dados.');
      }
    }
    
    if (!config?.access_token) {
      console.error('❌ Erro: Access Token não encontrado.');
      return res.status(400).json({ 
        success: false, 
        message: 'Configuração de pagamento incompleta. O Access Token (Chave Secreta) não foi encontrado.' 
      });
    }

    try {
      const token = String(config.access_token).trim();
      console.log(`🔑 Validando Token (Início: ${token.substring(0, 5)}..., Tamanho: ${token.length})`);
      
      // Validação básica: Pagar.me v5 Secret Keys devem começar com sk_
      if (!token.startsWith('sk_')) {
        console.warn('⚠️ Alerta: O token configurado não parece ser uma Chave Secreta (Secret Key) do Pagar.me.');
        if (token.startsWith('pk_')) {
          return res.status(401).json({ 
            success: false, 
            message: 'ERRO DE CONFIGURAÇÃO: Você está usando uma "Chave Pública" (pk_...) no campo de "Chave Secreta". No Pagar.me v5, você deve usar a "Secret Key" (sk_...) para processar pedidos pelo servidor.' 
          });
        }
      }
      
      const authHeader = `Basic ${Buffer.from(token + ':').toString('base64')}`;
      
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
        console.error('❌ Erro retornado pela API Pagar.me:', data.message || 'Erro desconhecido');
        // Se for 401, dar uma dica melhor
        if (response.status === 401) {
          return res.status(401).json({
            success: false,
            message: 'Não autorizado: Sua Chave Secreta do Pagar.me foi rejeitada. Verifique se ela está correta, se é do ambiente correto (Teste/Produção) e se não há espaços extras.',
            raw_error: data
          });
        }
      } else {
        console.log('✅ Pedido criado com sucesso no Pagar.me.');
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error('💥 Erro crítico no processamento Pagar.me:', error.message);
      res.status(500).json({ success: false, message: 'Erro interno ao processar pagamento: ' + error.message });
    }
  });

  // Webhook Pagar.me
  app.post("/api/webhooks/pagarme", express.json(), async (req, res) => {
    const event = req.body;
    console.log('🔔 Webhook Pagar.me recebido:', event.type);
    // console.log('📄 Dados do Evento:', JSON.stringify(event, null, 2));

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
