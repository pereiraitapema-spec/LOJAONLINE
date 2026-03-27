import express from "express";
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
        // Se for erro 401, pode ser problema de chave V4 vs V5
        if (response.status === 401) {
          console.error('⚠️ DICA: O erro 401 indica chave inválida. Verifique se está usando as chaves do Pagar.me V5 (sk_... e pk_...) e não as do V4 (ak_... e ek_...).');
        }
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
        console.log(`💰 Pedido ${orderId} PAGO! Iniciando logística...`);
        
        // 1. Notificar CepCerto
        await logisticsService.notifyCarrier(orderId);
        
        // 2. Gerar Rastreio
        const trackingCode = await logisticsService.generateTrackingCode(orderId);
        
        // 3. Gerar Etiqueta
        await logisticsService.generateShippingLabel(orderId);
        
        // 4. Gerar Nota Fiscal
        await logisticsService.generateInvoice(orderId);
        
        // 5. Gerar Lista de Separação
        await logisticsService.generatePickingList(orderId);
        
        // 6. Adicionar primeiro passo na logística
        await logisticsService.addLogisticsStep(orderId, {
          status: 'preparing',
          description: 'Pagamento confirmado. O produto está sendo preparado para envio.',
          date: new Date().toISOString(),
          location: 'Centro de Distribuição'
        });

        console.log(`✅ Logística completa para pedido ${orderId}.`);
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

  // Endpoint para gerar arquivo de texto da Nota Fiscal
  app.get("/api/logistics/invoice-data/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const supabaseUrl = process.env.VITE_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('payment_id', orderId)
        .single();

      if (error || !order) {
        return res.status(404).send('Pedido não encontrado');
      }

      let textContent = `DADOS PARA EMISSÃO DE NOTA FISCAL\n`;
      textContent += `=================================\n\n`;
      textContent += `PEDIDO: ${order.id}\n`;
      textContent += `DATA: ${new Date(order.created_at).toLocaleString('pt-BR')}\n\n`;
      
      textContent += `[ DADOS DO CLIENTE ]\n`;
      textContent += `Nome: ${order.customer_name}\n`;
      textContent += `CPF/CNPJ: ${order.customer_cpf}\n`;
      textContent += `Email: ${order.customer_email}\n`;
      textContent += `Telefone: ${order.customer_phone}\n\n`;

      textContent += `[ ENDEREÇO DE ENTREGA ]\n`;
      textContent += `CEP: ${order.shipping_zip}\n`;
      textContent += `Logradouro: ${order.shipping_street}, ${order.shipping_number}\n`;
      if (order.shipping_complement) textContent += `Complemento: ${order.shipping_complement}\n`;
      textContent += `Bairro: ${order.shipping_neighborhood}\n`;
      textContent += `Cidade/UF: ${order.shipping_city} - ${order.shipping_state}\n\n`;

      textContent += `[ ITENS DO PEDIDO ]\n`;
      order.order_items.forEach((item: any, index: number) => {
        textContent += `${index + 1}. ${item.product_name}\n`;
        textContent += `   Qtd: ${item.quantity} | Vlr Unit: R$ ${item.price.toFixed(2)} | Total: R$ ${(item.quantity * item.price).toFixed(2)}\n`;
      });
      textContent += `\n`;
      textContent += `Subtotal: R$ ${order.subtotal.toFixed(2)}\n`;
      textContent += `Frete: R$ ${order.shipping_cost.toFixed(2)}\n`;
      textContent += `TOTAL DA NOTA: R$ ${order.total.toFixed(2)}\n`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dados_nf_${orderId}.txt"`);
      res.send(textContent);
    } catch (error: any) {
      res.status(500).send('Erro ao gerar arquivo: ' + error.message);
    }
  });

  // Endpoint para gerar arquivo de texto da Lista de Separação (Picking List)
  app.get("/api/logistics/picking-data/:orderId", async (req, res) => {
    try {
      const { orderId } = req.params;
      const supabaseUrl = process.env.VITE_SUPABASE_URL!;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('*, order_items(*)')
        .eq('payment_id', orderId)
        .single();

      if (error || !order) {
        return res.status(404).send('Pedido não encontrado');
      }

      let textContent = `LISTA DE SEPARAÇÃO (PICKING LIST)\n`;
      textContent += `=================================\n\n`;
      textContent += `PEDIDO: ${order.id}\n`;
      textContent += `DATA DO PEDIDO: ${new Date(order.created_at).toLocaleString('pt-BR')}\n`;
      textContent += `CLIENTE: ${order.customer_name}\n`;
      textContent += `CIDADE/UF: ${order.shipping_city} - ${order.shipping_state}\n\n`;

      textContent += `[ ITENS PARA SEPARAR ]\n`;
      textContent += `---------------------------------\n`;
      order.order_items.forEach((item: any, index: number) => {
        textContent += `[ ] ${item.quantity}x - ${item.product_name}\n`;
        if (item.attributes) {
          textContent += `    Detalhes: ${JSON.stringify(item.attributes)}\n`;
        }
      });
      textContent += `---------------------------------\n\n`;
      
      textContent += `Separado por: _________________________\n`;
      textContent += `Data da Separação: ___/___/______\n`;

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="picking_list_${orderId}.txt"`);
      res.send(textContent);
    } catch (error: any) {
      res.status(500).send('Erro ao gerar arquivo: ' + error.message);
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
