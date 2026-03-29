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

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy para Pagar.me (Segurança: chaves no servidor)
  app.post("/api/payments/pagarme", express.json(), async (req, res) => {
    console.log('📥 Rota /api/payments/pagarme atingida!');
    const { orderData, config } = req.body;
    
    console.log('🚀 Iniciando pagamento Pagar.me...');
    console.log('📦 Dados do Pedido:', JSON.stringify(orderData, null, 2));
    
    if (!config?.access_token) {
      console.error('❌ Erro: Access Token não configurado no gateway.');
      return res.status(400).json({ success: false, error: 'Access Token não configurado.' });
    }

    try {
      console.log('🔍 Verificando token...');
      if (!config?.access_token) {
        console.error('❌ Erro: Access Token não configurado no gateway.');
        return res.status(400).json({ success: false, error: 'Access Token não configurado.' });
      }
      
      const token = config.access_token.trim();
      console.log('🔑 Token lido com sucesso. Preparando Auth Header...');
      const authHeader = `Basic ${Buffer.from(token + ':').toString('base64')}`;
      
      console.log('📡 Enviando requisição para Pagar.me V5...');
      
      const pagarmeStartTime = Date.now();
      
      // Timeout de 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch('https://api.pagar.me/core/v5/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        body: JSON.stringify(orderData),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const pagarmeDuration = Date.now() - pagarmeStartTime;
      console.log(`⏱️ Tempo de resposta do Pagar.me: ${pagarmeDuration}ms`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erro na resposta do Pagar.me:', response.status, errorText);
        return res.status(response.status).json({ success: false, error: 'Erro no Pagar.me', details: errorText });
      }

      const data = await response.json();
      
      console.log(`📡 Resposta Pagar.me (Status ${response.status}):`, JSON.stringify(data, null, 2));

      if (response.ok) {
        console.log('✅ Pagamento processado com sucesso pela API.');
        
        // Atualiza o status no Supabase imediatamente
        const supabaseUrl = process.env.VITE_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseKey);
        
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('payment_id', data.id);
        console.log(`💰 Pedido ${data.id} atualizado para 'paid' no Supabase.`);
      } else {
        res.status(response.status).json(data);
      }
    } catch (error: any) {
      console.error('💥 Erro crítico no proxy Pagar.me:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Proxy para CepCerto
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

  // Webhook Pagar.me
  app.post("/api/webhooks/pagarme", express.json(), async (req, res) => {
    console.log('🔔 Webhook Pagar.me recebido!');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    const event = req.body;
    console.log('📄 Dados do Evento:', JSON.stringify(event, null, 2));

    const supabaseUrl = process.env.VITE_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    try {
      // 1. Idempotência: Verifica o status atual no Supabase
      const { data: order, error: fetchError } = await supabaseAdmin
        .from('orders')
        .select('status')
        .eq('payment_id', event.data.id)
        .single();

      if (fetchError) {
        console.error(`❌ Erro ao buscar pedido ${event.data.id}:`, fetchError.message);
        return res.status(500).send('Erro interno');
      }

      if (order.status === 'paid') {
        console.log(`⚠️ Pedido ${event.data.id} já processado. Ignorando webhook.`);
        return res.status(200).send('OK (Já processado)');
      }

      // Lógica para atualizar o status do pedido com base no evento
      // Eventos comuns: order.paid, order.payment_failed, order.canceled
      if (!event.data || !event.data.id) {
        console.error('❌ Erro: Evento sem ID de pedido.');
        return res.status(400).send('Erro: Evento inválido');
      }

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

        // Atualiza status para 'paid'
        await supabaseAdmin
          .from('orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('payment_id', orderId);

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
    } catch (error: any) {
      console.error('💥 Erro no Webhook:', error.message);
      res.status(500).send('Erro interno');
    }
  });

  // Rota para buscar rastreamento no Pagar.me
  app.get("/api/pagarme/tracking/:orderId", express.json(), async (req, res) => {
    const { orderId } = req.params;
    console.log(`🔍 Buscando rastreamento para o pedido ${orderId} no Pagar.me...`);

    const pagarmeApiKey = process.env.PAGARME_API_KEY;
    
    if (!pagarmeApiKey) {
      return res.status(400).json({ success: false, error: 'Chave API Pagar.me não configurada.' });
    }

    const authHeader = `Basic ${Buffer.from(pagarmeApiKey + ':').toString('base64')}`;

    try {
      const response = await fetch(`https://api.pagar.me/core/v5/orders/${orderId}`, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({ success: false, error: 'Erro ao buscar no Pagar.me', details: errorText });
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Worker profissional: Supabase Realtime (escuta eventos em tempo real)
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

  console.log('👂 Iniciando listener Realtime para webhooks...');

  supabaseAdmin
    .channel('webhook_logs')
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'webhook_logs' 
    }, async (payload) => {
      const webhook = payload.new;
      console.log(`🔔 Novo webhook recebido em tempo real: ${webhook.id}`);
      
      const orderId = webhook.payload.data.id;
      try {
        if (webhook.event_type === 'order.paid') {
          console.log(`💰 Processando logística para pedido ${orderId}...`);
          await logisticsService.notifyCarrier(orderId);
          await logisticsService.generateTrackingCode(orderId);
          await logisticsService.generateShippingLabel(orderId);
          await logisticsService.generateInvoice(orderId);
          await logisticsService.generatePickingList(orderId);
          await logisticsService.addLogisticsStep(orderId, {
            status: 'preparing',
            description: 'Pagamento confirmado. O produto está sendo preparado para envio.',
            date: new Date().toISOString(),
            location: 'Centro de Distribuição'
          });
          
          await supabaseAdmin
            .from('orders')
            .update({ status: 'paid', updated_at: new Date().toISOString() })
            .eq('payment_id', orderId);
        }
        
        await supabaseAdmin
          .from('webhook_logs')
          .update({ status: 'processed', processed_at: new Date().toISOString() })
          .eq('id', webhook.id);
          
        console.log(`✅ Webhook ${webhook.id} processado instantaneamente.`);
      } catch (err: any) {
        console.error(`❌ Erro ao processar webhook ${webhook.id}:`, err.message);
        await supabaseAdmin
          .from('webhook_logs')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', webhook.id);
      }
    })
    .subscribe();

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
        .eq('id', orderId)
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
        .eq('id', orderId)
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
