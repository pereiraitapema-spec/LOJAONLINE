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

  // Proxy para Rastreio CepCerto (API-RASTREIO)
  app.post("/api/cepcerto/rastreio-api", async (req, res) => {
    console.log("CEP CERTO BACKEND REQUEST (RASTREIO-API)", req.body);
    try {
      const response = await fetch('https://cepcerto.com/api-rastreio/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body)
      });
      const data = await response.json();
      console.log("CEP CERTO BACKEND RESPONSE (RASTREIO-API)", data);
      res.json(data);
    } catch (error) {
      console.error("CEP CERTO BACKEND ERROR (RASTREIO-API)", error);
      res.status(500).json({ error: 'Erro ao processar rastreio no CepCerto' });
    }
  });

  // 6. Endpoint de Cotação de Frete Unificado
  app.post("/api/admin/frete/cotacao", async (req, res) => {
    const { cep_destinatario, produtos } = req.body;

    if (!cep_destinatario || !produtos || !Array.isArray(produtos)) {
      return res.status(400).json({ status: "erro", mensagem: "CEP e produtos são obrigatórios" });
    }

    try {
      const { supabase } = await import("./src/lib/supabase");

      // 1. Buscar produtos no banco
      const productIds = produtos.map((p: any) => p.id);
      const { data: dbProducts, error: prodError } = await supabase
        .from('products')
        .select('id, name, price, weight, height, width, length')
        .in('id', productIds);

      if (prodError || !dbProducts) {
        throw new Error("Erro ao buscar produtos: " + (prodError?.message || "Produtos não encontrados"));
      }

      // 2. Somar dados dos produtos
      let totalWeight = 0;
      let maxHeight = 0;
      let maxWidth = 0;
      let maxLength = 0;
      let totalValue = 0;

      produtos.forEach((p: any) => {
        const dbProd = dbProducts.find((dp: any) => dp.id === p.id);
        if (dbProd) {
          const qty = p.quantidade || 1;
          
          totalWeight += (Number(dbProd.weight) || 0.5) * qty;
          maxHeight += (Number(dbProd.height) || 10) * qty;
          maxWidth = Math.max(maxWidth, Number(dbProd.width) || 10);
          maxLength = Math.max(maxLength, Number(dbProd.length) || 10);
          totalValue += (Number(dbProd.price) || 0) * qty;
        }
      });

      if (totalWeight < 0.3) totalWeight = 0.5;
      if (maxHeight < 2) maxHeight = 2;
      if (maxWidth < 11) maxWidth = 11;
      if (maxLength < 16) maxLength = 16;

      // 3. Buscar configurações do sistema
      const { data: carrier, error: carrierError } = await supabase
        .from('shipping_carriers')
        .select('config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      const { data: settings, error: settingsError } = await supabase
        .from('store_settings')
        .select('origin_zip_code')
        .maybeSingle();

      if (carrierError || !carrier) {
        throw new Error("Configuração do CepCerto não encontrada");
      }

      const apiKey = carrier.config?.api_key;
      const originZip = settings?.origin_zip_code || carrier.config?.origin_zip || "88240000";

      if (!apiKey) {
        throw new Error("API Key do CepCerto não configurada");
      }

      // 4. Montar payload para CepCerto
      const payload = {
        token_cliente_postagem: apiKey,
        cep_remetente: originZip.replace(/\D/g, ''),
        cep_destinatario: cep_destinatario.replace(/\D/g, ''),
        peso: totalWeight.toString(),
        altura: Math.max(maxHeight, 2).toString(),
        largura: Math.max(maxWidth, 11).toString(),
        comprimento: Math.max(maxLength, 16).toString(),
        valor_encomenda: totalValue.toFixed(2)
      };

      console.log("📦 Chamando CepCerto para cotação:", payload);

      // 5. Chamar API CepCerto
      const response = await fetch('https://cepcerto.com/api-cotacao-frete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log("📦 Resposta CepCerto (raw):", JSON.stringify(data, null, 2));

      if (data.status === "erro" || !data.frete) {
        console.log("❌ Erro na resposta do CepCerto ou frete vazio:", data);
        return res.json({ 
          status: "erro", 
          mensagem: data.mensagem || "Erro na cotação do frete" 
        });
      }

      // 6. Formatar todas as opções de frete retornadas pela API
      const freteFiltrado: any = {};
      
      // Itera sobre as chaves do objeto frete (ex: valor_pac, prazo_pac, valor_sedex, etc.)
      // e agrupa por tipo de frete
      const tiposFrete = new Set(
        Object.keys(data.frete)
          .map(key => key.replace('valor_', '').replace('prazo_', ''))
      );

      tiposFrete.forEach(tipo => {
        const valor = data.frete[`valor_${tipo}`];
        const prazo = data.frete[`prazo_${tipo}`];
        
        if (valor && prazo) {
          freteFiltrado[tipo] = {
            valor: valor.replace(',', '.'), // Converte "20,81" para "20.81"
            prazo: prazo,
            transportadora: tipo.toUpperCase()
          };
        }
      });

      return res.json({ status: "sucesso", frete: freteFiltrado });

    } catch (error: any) {
      console.error("❌ Erro no endpoint de cotação:", error);
      return res.status(500).json({ status: "erro", mensagem: error.message || "Erro interno no servidor" });
    }
  });

  // 7. Endpoint para Gerar Etiqueta (Seguro, chamado pelo Checkout ou Admin)
  app.post("/api/admin/gerar-etiqueta", async (req, res) => {
    const { id_pedido, tipo_entrega } = req.body;

    if (!id_pedido) {
      return res.status(400).json({ success: false, error: "ID do pedido é obrigatório" });
    }

    try {
      const { supabase } = await import("./src/lib/supabase");

      // 1. Buscar dados completos do pedido e itens
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', id_pedido)
        .maybeSingle();

      if (orderError || !order) {
        throw new Error('Pedido não encontrado');
      }

      // 2. Buscar produtos para pegar dimensões
      const productIds = order.order_items.map((item: any) => item.product_id);
      const { data: productsData } = await supabase
        .from('products')
        .select('id, weight, height, width, length')
        .in('id', productIds);

      let totalWeight = 0;
      let maxHeight = 0;
      let maxWidth = 0;
      let totalLength = 0;
      let totalProductsValue = 0;
      let totalQuantity = 0;

      order.order_items.forEach((item: any) => {
        const product = productsData?.find(p => p.id === item.product_id);
        const qty = item.quantity || 1;
        const weight = Number(product?.weight) || 0.5;
        const height = Number(product?.height) || 10;
        const width = Number(product?.width) || 10;
        const length = Number(product?.length) || 10;

        totalWeight += weight * qty;
        maxHeight = Math.max(maxHeight, height);
        maxWidth = Math.max(maxWidth, width);
        totalLength += length * qty;
        
        totalProductsValue += Number(item.price) * qty;
        totalQuantity += qty;
      });

      if (totalWeight < 0.3) totalWeight = 0.5;
      if (maxHeight < 2) maxHeight = 2;
      if (maxWidth < 11) maxWidth = 11;
      if (totalLength < 16) totalLength = 16;

      // 3. Buscar configurações do sistema (Remetente e API Key)
      const { data: carrier, error: carrierError } = await supabase
        .from('shipping_carriers')
        .select('config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      const { data: senderSettings } = await supabase
        .from('sender_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (carrierError || !carrier || !carrier.config?.api_key) {
        throw new Error("Configuração ou API Key do CepCerto não encontrada");
      }

      const apiKey = carrier.config.api_key;

      // 4. Mapear tipo de entrega
      let tipoEntregaFinal = tipo_entrega || 'sedex';
      const method = (order.shipping_method || '').toLowerCase();
      if (method.includes('pac')) tipoEntregaFinal = 'pac';
      else if (method.includes('jadlog-package')) tipoEntregaFinal = 'jadlog-package';
      else if (method.includes('jadlog-dotcom')) tipoEntregaFinal = 'jadlog-dotcom';

      // 5. Preparar dados do remetente
      const senderCep = (senderSettings?.cep || '').replace(/\D/g, '');
      const shippingCost = order.shipping_cost || 0;
      console.log("DEBUG: senderCep extraído do sender_settings:", senderCep);
      
      if (!senderCep) {
        throw new Error("CEP do remetente não configurado na tabela sender_settings");
      }

      const senderNome = senderSettings?.nome_razao_social?.substring(0, 50) || 'Remetente';
      const senderCpfCnpj = senderSettings?.cpf_cnpj?.replace(/\D/g, '') || '';
      const senderWhatsapp = (senderSettings?.whatsapp || '').replace(/\D/g, '').substring(0, 11);
      const senderEmail = senderSettings?.email?.substring(0, 50) || '';
      const senderLogradouro = senderSettings?.logradouro || 'Endereço não informado';
      const senderNumero = senderSettings?.numero || 'SN';
      const senderBairro = senderSettings?.bairro || 'Centro';
      const senderCidade = senderSettings?.cidade || '';
      const senderEstado = senderSettings?.estado || '';
      const senderComplemento = senderSettings?.complemento || "";

      // 6. Preparar dados do destinatário
      const dest = order.shipping_address || {};
      console.log("DEBUG: Destinatário completo:", JSON.stringify(dest, null, 2));
      
      // 6.1 Buscar configuração de etiqueta
      const { data: config } = await supabase
        .from("shipping_label_config")
        .select("*")
        .eq("id", "0000000000000000000000000001")
        .maybeSingle();
      
      const descricaoPadrao = config?.descricao || "Frasco";
      console.log("📦 [ETIQUETA] Configuração carregada:", config);

      // 7. Montar o payload
      console.log("📦 [ETIQUETA] Payload recebido:", JSON.stringify(req.body, null, 2));
      let orderItems = order.order_items || [];
      console.log("📦 [ETIQUETA] Produtos recebidos:", orderItems);
      
      let totalQty = orderItems.reduce((acc: number, item: any) => acc + (item.quantity || 0), 0);
      let totalProdValue = orderItems.reduce((acc: number, item: any) => acc + ((item.price || 0) * (item.quantity || 0)), 0);

      // Fallback se não houver itens
      if (orderItems.length === 0) {
        console.log("📦 [ETIQUETA] Nenhum item encontrado, usando fallback.");
        totalQty = 1;
        totalProdValue = Number(order.total) - Number(order.shipping_cost || 0);
      }

      console.log("📦 [ETIQUETA] Gerando declaração automática...");
      console.log("📦 [ETIQUETA] Quantidade total:", totalQty);
      console.log("📦 [ETIQUETA] Valor total produtos:", totalProdValue);

      const payload = {
        token_cliente_postagem: apiKey,
        tipo_entrega: tipoEntregaFinal,
        logistica_reversa: "",
        cep_remetente: senderCep,
        cep_destinatario: (dest.cep || '').replace(/\D/g, ''),
        peso: totalWeight.toString(),
        altura: Math.ceil(maxHeight).toString(),
        largura: Math.ceil(maxWidth).toString(),
        comprimento: Math.ceil(totalLength).toString(),
        valor_encomenda: Math.max(50, totalProductsValue).toFixed(2),
        
        // Remetente
        nome_remetente: senderNome,
        cpf_cnpj_remetente: senderCpfCnpj,
        whatsapp_remetente: senderWhatsapp,
        email_remetente: senderEmail,
        logradouro_remetente: senderLogradouro.substring(0, 50),
        bairro_remetente: senderBairro.substring(0, 40),
        numero_endereco_remetente: senderNumero.substring(0, 10),
        complemento_remetente: senderComplemento.substring(0, 20),
        cidade_remetente: senderCidade.substring(0, 50),
        estado_remetente: senderEstado.substring(0, 2),
        
        // Destinatário
        nome_destinatario: (order.customer_name || dest.nome || 'Cliente').substring(0, 50),
        cpf_cnpj_destinatario: (order.customer_document || '').replace(/\D/g, ''),
        whatsapp_destinatario: (order.customer_phone || '').replace(/\D/g, '').substring(0, 11),
        email_destinatario: (order.customer_email || '').substring(0, 50),
        logradouro_destinatario: (dest.logradouro || dest.address || dest.street || 'Endereço não informado').substring(0, 50),
        bairro_destinatario: (dest.bairro || dest.neighborhood || 'Centro').substring(0, 40),
        numero_endereco_destinatario: (dest.numero || dest.number || 'SN').toString().substring(0, 10),
        complemento_destinatario: (dest.complemento || dest.complement || '').substring(0, 20),
        cidade_destinatario: (dest.cidade || dest.city || '').substring(0, 50),
        estado_destinatario: (dest.estado || dest.state || '').substring(0, 2),
        
        tipo_doc_fiscal: "declaracao",
        produtos: [
          {
            descricao: descricaoPadrao,
            valor: totalProdValue.toFixed(2),
            quantidade: totalQty
          }
        ],
        chave_danfe: ""
      };

      console.log("📦 [ETIQUETA] Payload CEPCERTO:", JSON.stringify(payload, null, 2));

      // 7.5. Validar Pagamento antes de gerar etiqueta
      if (order.etiqueta_gerada) {
        console.log("⚠️ Etiqueta já gerada para este pedido, ignorando.");
        return res.json({ success: true, message: "Etiqueta já gerada" });
      }

      // 1. Loop de verificação para aguardar confirmação de pagamento
      let paymentApproved = false;
      let paymentStatus = 'pending';
      let lastWebhook = null;

      console.log(`⏱️ Aguardando confirmação de pagamento para o pedido ${id_pedido}...`);

      for (let i = 0; i < 10; i++) {
        const { data: webhooks, error: webhookError } = await supabase
          .from("webhook_logs")
          .select("*")
          .eq("payload->data->metadata->>order_id", id_pedido)
          .order("created_at", { ascending: false })
          .limit(1);

        if (webhooks && webhooks.length > 0) {
          lastWebhook = webhooks[0];
          const payload = lastWebhook.payload;
          const eventType = lastWebhook.event_type;
          
          // Extrair status corretamente
          paymentStatus = payload?.data?.status || payload?.status || 'pending';
          const success = payload?.data?.charges?.[0]?.last_transaction?.success ?? payload?.success ?? true;

          console.log("💰 Webhook encontrado:", eventType);
          console.log("💰 Status pagamento:", paymentStatus);
          console.log("💰 Success:", success);

          // Regra de falha (Parar fluxo)
          if (
            eventType === "order.payment_failed" || 
            eventType === "charge.payment_failed" || 
            paymentStatus === "failed" || 
            success === false
          ) {
            console.error("❌ Pagamento falhou, cancelando fluxo");
            return res.status(400).json({ 
              success: false, 
              message: payload?.gateway_response?.errors?.[0]?.message || "Pagamento não aprovado" 
            });
          }

          // Regra de sucesso
          if (['charge.paid', 'order.paid', 'charge.payment_succeeded', 'approved', 'paid', 'confirmed', 'success'].includes(paymentStatus) || paymentStatus === 'paid') {
            paymentApproved = true;
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!paymentApproved) {
        console.log("❌ Pagamento não aprovado ou não confirmado, não gerar etiqueta");
        return res.status(400).json({ success: false, message: "Pagamento pendente ou não aprovado" });
      }

      // 8. Chamar API CepCerto
      console.log("LOG 4 — Iniciando geração etiqueta CepCerto");
      console.log("LOG 5 — Payload enviado CepCerto:", JSON.stringify(payload, null, 2));
      
      const response = await fetch('https://cepcerto.com/api-postagem-frete/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const responseText = await response.text();
      console.log('LOG 6 — Resposta API CepCerto:', responseText);

      let result;
      try {
        result = JSON.parse(responseText);
      } catch (e) {
        throw new Error("Resposta inválida da API CepCerto");
      }

      console.log("📦 Resposta CEP CERTO:", result);

      if (result.status === 'erro' || result.sucesso === false) {
        const errorMessage = result.mensagem || result.error || 'Erro ao gerar etiqueta no CepCerto';
        
        // Salvar erro no banco
        await supabase.from('shipping_logs').insert({
          order_id: id_pedido,
          status: 'error',
          error: errorMessage,
          payload: payload,
          response: result
        });
        
        console.error("LOG ERROR — Erro ao gerar etiqueta:", errorMessage);
        
        // Retornar sucesso=false para o checkout saber que falhou, mas não lançar erro 500
        return res.json({ success: false, error: errorMessage });
      }

      // Captura correta conforme estrutura da API
      const frete = result.frete || {};
      const rastreador = frete.codigoObjeto || result.codigoObjeto || result.codigo_objeto || result.tracking_code || result.codigo;
      const etiquetaPdf = frete.pdfUrlEtiqueta || result.pdfUrlEtiqueta || result.shipping_label_url || '';
      const declaracaoUrl = frete.declaracaoUrl || result.declaracaoUrl || '';
      const recibo = frete.idRecibo || result.idRecibo || '';

      console.log("📦 Código rastreador:", rastreador);
      console.log("📦 URL etiqueta:", etiquetaPdf);

      if (!rastreador) {
        console.error('DEBUG: Resposta completa para debug:', JSON.stringify(result, null, 2));
        throw new Error('Código de rastreio não retornado pela API');
      }

      // 9. Salvar no Supabase (orders e shipping_labels)
      const novoStatus = rastreador ? "processing" : "pending";
      
      // Re-buscar status atual do pedido para garantir que não estamos usando status stale
      const { data: orderAtual, error: fetchOrderError } = await supabase
        .from('orders')
        .select('status')
        .eq('id', id_pedido)
        .single();
      
      const statusFinal = (fetchOrderError || !orderAtual) 
        ? (order.status === 'paid' || order.status === 'approved' ? 'processing' : order.status)
        : (orderAtual.status === 'paid' || orderAtual.status === 'approved' ? 'processing' : orderAtual.status);

      console.log(`DEBUG: Atualizando pedido ${id_pedido} com tracking_code: ${rastreador}, status_final: ${statusFinal}, status_original: ${order.status}`);
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          tracking_code: rastreador,
          shipping_label_url: etiquetaPdf,
          shipping_declaration_url: declaracaoUrl,
          shipping_receipt: recibo,
          shipping_status: novoStatus,
          etiqueta_gerada: true,
          erro_etiqueta: 'false',
          status: statusFinal
        })
        .eq('id', id_pedido);
      
      if (updateError) {
        console.error('DEBUG: Erro ao atualizar pedido:', updateError);
        throw new Error(`Erro ao atualizar pedido no Supabase: ${updateError.message}`);
      }
      console.log('📦 Atualizado com sucesso');

      await supabase.from('shipping_labels').upsert({
        order_id: id_pedido,
        codigo_objeto: rastreador,
        nome_destinatario: frete.nome_destinatario || payload.nome_destinatario,
        whatsapp_destinatario: frete.whatsapp_destinatario || payload.whatsapp_destinatario,
        cidade_destinatario: frete.cidade_destinatario || dest.cidade,
        estado_destinatario: frete.estado_destinatario || dest.estado,
        cep_destinatario: frete.cep_destinatario || payload.cep_destinatario,
        email_destinatario: frete.email_destinatario || payload.email_destinatario,
        valor: Number(frete.valor || result.valor) || 0,
        prazo: frete.prazo || '',
        status: 'ativa',
        pdf_url_etiqueta: etiquetaPdf,
        pdf_url_declaracao: declaracaoUrl,
        id_recibo: recibo,
        id_string_correios: frete.idStringCorreios || '',
        token: apiKey,
        transportadora: 'CepCerto',
        tipo_entrega: tipoEntregaFinal,
        data_postagem: new Date().toISOString()
      }, { onConflict: 'codigo_objeto' });

      res.json({ success: true, tracking_code: rastreador, result: result });

    } catch (error: any) {
      console.error("❌ Erro ao gerar etiqueta via Admin:", error);
      
      // Fallback: Salvar status_envio = 'preparando' e erro_etiqueta = true
      try {
        const { supabase } = await import("./src/lib/supabase");
        await supabase
          .from('orders')
          .update({ 
            status_envio: 'preparando',
            erro_etiqueta: true
          })
          .eq('id', id_pedido);
        console.log(`⚠️ Fallback aplicado para o pedido ${id_pedido}: status_envio = preparando, erro_etiqueta = true`);
      } catch (fallbackError) {
        console.error("❌ Erro ao aplicar fallback no Supabase:", fallbackError);
      }

      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 8. Endpoint para Rastreio CepCerto via Admin (Seguro)
  app.post("/api/admin/rastreio", async (req, res) => {
    const { tracking_code } = req.body;

    if (!tracking_code) {
      return res.status(400).json({ success: false, error: "Código de rastreio é obrigatório" });
    }

    try {
      const { supabase } = await import("./src/lib/supabase");

      // 1. Buscar configurações do sistema para obter a API Key
      const { data: carrier, error: carrierError } = await supabase
        .from('shipping_carriers')
        .select('config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      if (carrierError || !carrier || !carrier.config?.api_key) {
        throw new Error("Configuração ou API Key do CepCerto não encontrada");
      }

      const apiKey = carrier.config.api_key;

      // 2. Chamar API CepCerto
      const payload = {
        token_cliente_postagem: apiKey,
        codigo_objeto: tracking_code
      };

      console.log("LOG — Buscando rastreamento:", tracking_code);

      const response = await fetch('https://cepcerto.com/api-rastreio/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      console.log("LOG — Resposta rastreamento:", data);

      res.json(data);
    } catch (error: any) {
      console.error("❌ Erro ao buscar rastreio via Admin:", error);
      res.status(500).json({ success: false, error: error.message });
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
