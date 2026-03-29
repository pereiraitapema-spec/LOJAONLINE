import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Filter,
  Plus,
  User,
  Trash2,
  Save,
  X,
  Printer,
  Ban,
  MapPin,
  Zap,
  QrCode,
  ExternalLink
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { shippingService } from '../services/shippingService';
import { cepService } from '../services/cepService';

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  payment_method: string;
  shipping_address: any;
  user_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_document?: string;
  tracking_code?: string;
  shipping_label_url?: string;
  shipping_method?: string;
}

interface AbandonedCart {
  id: string;
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  cart_items: any[];
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [abandonedCarts, setAbandonedCarts] = useState<AbandonedCart[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [dateFilter, setDateFilter] = useState(''); // '30', '60', '90', 'all'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'orders' | 'abandoned'>('orders');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [tempTrackingCode, setTempTrackingCode] = useState('');
  const [realTimeTracking, setRealTimeTracking] = useState<any>(null);
  const [loadingRealTime, setLoadingRealTime] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Manual Order State
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPickingModal, setShowPickingModal] = useState(false);
  const [pickingData, setPickingData] = useState<{ summary: Record<string, number>, orders: any[] } | null>(null);
  const [manualTracking, setManualTracking] = useState<Record<string, string>>({});
  const [isUpdatingTracking, setIsUpdatingTracking] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [manualOrderData, setManualOrderData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    customer_document: '',
    payment_method: 'cash',
    shipping_method: 'pickup',
    affiliate_id: '',
    discount: 0,
    shipping_cost: 0,
    operational_cost: 0,
    marketing_cost: 0
  });
  const [savingManualOrder, setSavingManualOrder] = useState(false);
  const [affiliates, setAffiliates] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
    if (isAdmin) {
      fetchProducts();
      fetchAffiliates();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (selectedOrder) {
      setTempTrackingCode(selectedOrder.tracking_code || '');
      setRealTimeTracking(null);
      
      // Se já tem rastreio, tenta buscar o status real
      if (selectedOrder.tracking_code) {
        fetchRealTimeTracking(selectedOrder.tracking_code);
      }
    }
  }, [selectedOrder]);

  const fetchRealTimeTracking = async (code: string) => {
    if (!code) return;
    setLoadingRealTime(true);
    try {
      const { data: carrier } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .single();
      
      if (carrier?.config) {
        const status = await shippingService.getTrackingStatus(code);
        setRealTimeTracking(status);
      }
    } catch (err) {
      console.error('Erro ao buscar rastreio real:', err);
    } finally {
      setLoadingRealTime(false);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('active', true);
    setProducts(data || []);
  };

  const fetchAffiliates = async () => {
    const { data } = await supabase.from('affiliates').select('id, name, code').eq('active', true);
    setAffiliates(data || []);
  };

  const addItemToOrder = (product: any) => {
    const existing = selectedItems.find(item => item.id === product.id);
    if (existing) {
      setSelectedItems(selectedItems.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setSelectedItems([...selectedItems, { 
        id: product.id, 
        name: product.name, 
        price: product.discount_price || product.price, 
        cost_price: product.cost_price || 0,
        tax_percentage: product.tax_percentage || 0,
        affiliate_commission: product.affiliate_commission || 0,
        quantity: 1 
      }]);
    }
  };

  const removeItemFromOrder = (id: string) => {
    setSelectedItems(selectedItems.filter(item => item.id !== id));
  };

  const calculateManualTotal = () => {
    const subtotal = selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    return subtotal + manualOrderData.shipping_cost - manualOrderData.discount;
  };

  const saveManualOrder = async () => {
    if (selectedItems.length === 0) {
      toast.error('Adicione pelo menos um produto.');
      return;
    }
    if (!manualOrderData.customer_name) {
      toast.error('Nome do cliente é obrigatório.');
      return;
    }

    setSavingManualOrder(true);
    try {
      const total = calculateManualTotal();
      
      // 0. Calcular comissão do afiliado se houver
      let commissionValue = 0;
      if (manualOrderData.affiliate_id) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('commission_rate')
          .eq('id', manualOrderData.affiliate_id)
          .single();
        
        const defaultRate = affiliate?.commission_rate || 0;
        
        // Encontrar a maior taxa entre os produtos selecionados e a taxa padrão do afiliado
        const productRates = selectedItems.map(item => item.affiliate_commission || 0);
        const maxRate = Math.max(defaultRate, ...productRates);
        
        commissionValue = selectedItems.reduce((acc, item) => {
          return acc + ((item.price * maxRate / 100) * item.quantity);
        }, 0);
      }

      // 1. Criar o pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          customer_name: manualOrderData.customer_name,
          customer_email: manualOrderData.customer_email,
          customer_phone: manualOrderData.customer_phone,
          customer_document: manualOrderData.customer_document,
          total: total,
          status: 'paid',
          payment_method: manualOrderData.payment_method,
          shipping_method: manualOrderData.shipping_method,
          affiliate_id: manualOrderData.affiliate_id || null,
          commission_value: commissionValue,
          shipping_address: { type: 'pickup', street: 'Balcão/Local' },
          user_id: (await supabase.auth.getSession()).data.session?.user?.id,
          shipping_cost: manualOrderData.shipping_cost,
          operational_cost: manualOrderData.operational_cost,
          marketing_cost: manualOrderData.marketing_cost
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // 1.1 Se houver comissão, atualizar saldo do afiliado
      if (commissionValue > 0 && manualOrderData.affiliate_id) {
        const { data: aff } = await supabase
          .from('affiliates')
          .select('balance')
          .eq('id', manualOrderData.affiliate_id)
          .single();
        
        if (aff) {
          await supabase
            .from('affiliates')
            .update({ balance: (aff.balance || 0) + commissionValue })
            .eq('id', manualOrderData.affiliate_id);
        }
      }

      // 2. Criar os itens do pedido
      const itemsToInsert = selectedItems.map(item => ({
        order_id: order.id,
        product_id: item.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      // 3. Atualizar estoque
      for (const item of selectedItems) {
        const { data: prod } = await supabase.from('products').select('stock').eq('id', item.id).single();
        if (prod) {
          await supabase.from('products').update({ stock: Math.max(0, prod.stock - item.quantity) }).eq('id', item.id);
        }
      }

      toast.success('Pedido de balcão registrado com sucesso!');
      setShowManualOrderModal(false);
      setSelectedItems([]);
      setManualOrderData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        customer_document: '',
        payment_method: 'cash',
        shipping_method: 'pickup',
        affiliate_id: '',
        discount: 0,
        shipping_cost: 0,
        operational_cost: 0,
        marketing_cost: 0
      });
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar pedido: ' + error.message);
    } finally {
      setSavingManualOrder(false);
    }
  };

  const [processingShipping, setProcessingShipping] = useState(false);
  const [processingLogistics, setProcessingLogistics] = useState(false);

  const handleManualLabelRedirect = (order: any) => {
    const addr = order.shipping_address || {};
    const url = `https://www.cepcerto.com/`; 
    window.open(url, '_blank');
    
    // Copia dados para o clipboard para facilitar o preenchimento manual
    const dataToCopy = `
DADOS PARA ETIQUETA:
Nome: ${order.customer_name}
CEP: ${addr.zip_code}
Endereço: ${addr.street}, ${addr.number}
Bairro: ${addr.neighborhood}
Cidade: ${addr.city}/${addr.state}
Complemento: ${addr.complement || 'N/A'}
    `.trim();
    
    navigator.clipboard.writeText(dataToCopy);
    toast.success('Dados do cliente copiados! Basta colar no site do CepCerto.');
  };

  const handleGenerateLabel = async (orderId: string) => {
    setProcessingShipping(true);
    try {
      const result = await shippingService.generateLabel(orderId);
      console.log('🔍 Resultado da geração de etiqueta:', result);
      if (result.success) {
        await updateTrackingCode(orderId, result.tracking_code || '', result.shipping_label_url);
        toast.success('Etiqueta gerada com sucesso!');
      } else {
        toast.error('Falha ao gerar etiqueta: ' + (result.error || 'Erro desconhecido'));
      }
    } catch (error: any) {
      console.error('❌ Erro em handleGenerateLabel:', error);
      toast.error('Erro ao gerar etiqueta: ' + error.message);
    } finally {
      setProcessingShipping(false);
    }
  };

  const handlePrintInvoice = async (orderId: string) => {
    setProcessingLogistics(true);
    try {
      // Baixa o arquivo de texto com os dados do pedido para preenchimento manual da NF
      const invoiceUrl = `/api/logistics/invoice-data/${orderId}`;
      window.open(invoiceUrl, '_blank');
      toast.success('Arquivo de dados da Nota Fiscal gerado com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao gerar Nota Fiscal: ' + error.message);
    } finally {
      setProcessingLogistics(false);
    }
  };

  const handlePrintPickingList = async (orderId: string) => {
    generateBatchPickingList([orderId]);
  };

  const handleCancelLabel = async (orderId: string) => {
    setProcessingShipping(true);
    try {
      const result = await shippingService.cancelLabel(orderId);
      if (result.success) {
        await updateTrackingCode(orderId, '');
        toast.success('Etiqueta cancelada!');
      }
    } catch (error: any) {
      toast.error('Erro ao cancelar etiqueta: ' + error.message);
    } finally {
      setProcessingShipping(false);
    }
  };

  const handleManualCepBlur = async (cep: string) => {
    try {
      const address = await cepService.fetchAddress(cep);
      if (address) {
        toast.success('Endereço preenchido via CEP!');
        // Aqui poderíamos adicionar campos de endereço ao manualOrderData se existissem
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    }
  };
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [trackingStatus, setTrackingStatus] = useState<any>(null);
  const [loadingTracking, setLoadingTracking] = useState(false);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [searchTerm, statusFilter, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      const userIsAdmin = profile?.role === 'admin' || session.user.email === 'pereira.itapema@gmail.com';
      setIsAdmin(userIsAdmin);

      if (activeTab === 'orders') {
        let query = supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (!userIsAdmin) {
          query = query.eq('user_id', session.user.id);
        }

        const { data, error } = await query;
        if (error) throw error;
        
        const ordersData = data || [];
        setOrders(ordersData);

        // Busca automática de rastreamento para clientes
        if (!userIsAdmin) {
          for (const order of ordersData) {
            if (order.tracking_code) {
              fetchTrackingStatus(order.id);
            }
          }
        }
      } else if (activeTab === 'abandoned' && userIsAdmin) {
        // ... (resto da lógica de abandonados)
        const { data, error } = await supabase
          .from('abandoned_carts')
          .select('*')
          .order('updated_at', { ascending: false });
        
        if (error) throw error;
        setAbandonedCarts(data || []);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds(prev => {
      const next = prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId];
      console.log('Selected order IDs:', next);
      return next;
    });
  };

  useEffect(() => {
    if (!showPickingModal) {
      setPickingData(null);
    }
  }, [showPickingModal]);

  const printPickingList = () => {
    if (!pickingData) {
      toast.error('Sem dados para imprimir');
      return;
    }

    // Cria um iframe oculto para isolar totalmente a impressão
    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    // Gera o HTML do Resumo Geral
    const summaryHtml = Object.entries(pickingData.summary)
      .map(([name, qty]) => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding: 10px 0; font-size: 16px;">
          <span style="font-weight: 600;">${name}</span>
          <span style="font-weight: 800; color: #4f46e5;">${qty} unidades</span>
        </div>
      `).join('');

    // Gera o HTML dos Pedidos Individuais
    const ordersHtml = pickingData.orders.map((order: any) => {
      // Lógica robusta para encontrar a cidade em diferentes formatos de objeto
      const addr = order.shipping_address || {};
      const city = addr.city || addr.localidade || addr.neighborhood || addr.street || 'Balcão/Local';
      const tracking = order.tracking_code || 'Aguardando postagem';
      const orderId = order.id.split('-')[0].toUpperCase();
      const orderDate = new Date(order.created_at).toLocaleDateString('pt-BR');

      return `
        <div style="border: 2px solid #000; margin-bottom: 25px; padding: 15px; border-radius: 8px; page-break-inside: avoid;">
          <div style="border-bottom: 2px solid #eee; margin-bottom: 10px; padding-bottom: 10px;">
            <div style="font-size: 14px; font-weight: 800; color: #1a1a1a;">
              PEDIDO: #${orderId} | CLIENTE: ${order.customer_name}
            </div>
            <div style="font-size: 12px; color: #444; margin-top: 5px;">
              DATA: ${orderDate} | CIDADE: ${city} | RASTREIO: <span style="font-family: monospace; font-weight: bold;">${tracking}</span>
            </div>
          </div>
          <div style="margin-left: 10px;">
            ${order.order_items.map((item: any) => `
              <div style="font-size: 13px; margin: 5px 0;">
                • <strong>${item.product_name}</strong> - Quantidade: <strong>${item.quantity}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Injeta o documento completo no iframe
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Lista de Separação - G-Fit</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #333; line-height: 1.4; margin: 0; padding: 0; }
            .header { text-align: center; border-bottom: 3px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
            .section-title { background: #f0f0f0; padding: 8px 15px; font-weight: bold; font-size: 18px; margin-bottom: 15px; border-left: 5px solid #4f46e5; }
            .summary-box { border: 1px solid #ccc; padding: 20px; border-radius: 10px; margin-bottom: 40px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">LISTA DE SEPARAÇÃO</h1>
            <p style="margin: 5px 0; font-size: 12px; color: #666;">Gerado em: ${new Date().toLocaleString('pt-BR')}</p>
          </div>

          <div class="section-title">RESUMO DE PRODUTOS (TOTAL PARA SEPARAR)</div>
          <div class="summary-box">
            ${summaryHtml}
          </div>

          <div class="section-title">DETALHAMENTO POR PEDIDO</div>
          ${ordersHtml}

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Limpeza após a impressão
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 5000);
  };

  const getTrackingUrl = (trackingCode: string, shippingMethod?: string) => {
    const method = (shippingMethod || '').toUpperCase();
    if (method.includes('CORREIOS') || method.includes('SEDEX') || method.includes('PAC')) {
      return `https://rastreamento.correios.com.br/app/index.php?codigo=${trackingCode}`;
    }
    if (method.includes('JADLOG')) {
      return `https://www.jadlog.com.br/siteInstitucional/tracking.jad?tracking=${trackingCode}`;
    }
    return `https://www.google.com/search?q=rastreio+${trackingCode}`;
  };

  const updateOrderTracking = async (orderId: string) => {
    const code = manualTracking[orderId];
    if (!code) {
      toast.error('Informe o código de rastreio');
      return;
    }

    try {
      setIsUpdatingTracking(true);
      await shippingService.updateTrackingCode(orderId, code);
      
      // Update local state
      setPickingData((prev: any) => ({
        ...prev,
        orders: prev.orders.map((o: any) => 
          o.id === orderId ? { ...o, tracking_code: code } : o
        )
      }));
      
      toast.success('Rastreio atualizado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao atualizar rastreio');
    } finally {
      setIsUpdatingTracking(false);
    }
  };

  const printShippingLabels = async () => {
    if (!pickingData) {
      toast.error('Sem dados para etiquetas');
      return;
    }

    const ordersWithTracking = pickingData.orders.filter((o: any) => o.tracking_code || manualTracking[o.id]);
    
    if (ordersWithTracking.length === 0) {
      toast.error('Nenhum pedido com código de rastreio');
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    const labelsHtml = ordersWithTracking.map((order: any) => {
      const tracking = order.tracking_code || manualTracking[order.id];
      const trackingUrl = getTrackingUrl(tracking, order.shipping_method);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(trackingUrl)}`;

      const addr = order.shipping_address || {};
      const recipient = `
        <strong>${order.customer_name}</strong><br/>
        ${addr.street || 'Endereço não informado'}, ${addr.number || 'S/N'}${addr.complement ? ` - ${addr.complement}` : ''}<br/>
        ${addr.neighborhood || ''} - ${addr.city || ''}/${addr.state || ''}<br/>
        CEP: ${addr.zip_code || ''}
      `;

      return `
        <div style="width: 100mm; height: 140mm; border: 2px solid #000; padding: 15px; margin-bottom: 20px; box-sizing: border-box; font-family: 'Segoe UI', Tahoma, sans-serif; position: relative; page-break-after: always; background: #fff;">
          <div style="display: flex; justify-content: space-between; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
            <div style="font-size: 22px; font-weight: 900; letter-spacing: -1px;">DESTINATÁRIO</div>
            <div style="font-size: 12px; text-align: right; font-weight: bold;">PEDIDO: #${order.id.split('-')[0].toUpperCase()}</div>
          </div>
          
          <div style="font-size: 16px; line-height: 1.5; margin-bottom: 30px; color: #000;">
            ${recipient}
          </div>

          <div style="border: 2px solid #000; padding: 15px; border-radius: 8px; background: #f9f9f9;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-size: 11px; font-weight: 800; color: #666; text-transform: uppercase; margin-bottom: 4px;">Código de Rastreio</div>
                <div style="font-size: 24px; font-weight: 900; font-family: 'Courier New', monospace; letter-spacing: 1px;">${tracking}</div>
                <div style="font-size: 12px; margin-top: 8px; font-weight: 600;">Transportadora: ${order.shipping_method || 'Padrão'}</div>
              </div>
              <div style="text-align: center; background: #fff; padding: 5px; border: 1px solid #eee;">
                <img src="${qrCodeUrl}" style="width: 110px; height: 110px; display: block;" />
                <div style="font-size: 8px; font-weight: bold; margin-top: 4px; color: #000;">RASTREIO RÁPIDO</div>
              </div>
            </div>
          </div>

          <div style="position: absolute; bottom: 15px; left: 15px; right: 15px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 10px; color: #444;">
            <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 2px; font-size: 9px;">Remetente:</div>
            Magnifique4Life - Itapema/SC - contato@magnifique4life.com.br
          </div>
        </div>
      `;
    }).join('');

    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas de Envio</title>
          <style>
            @page { size: 100mm 150mm; margin: 0; }
            body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; background: #f0f0f0; }
            @media print {
              body { background: #fff; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 800);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();

    // Limpeza
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 10000);
  };

  const toggleSelectAll = () => {
    console.log('Toggle select all. Current selection:', selectedOrderIds);
    console.log('Filtered orders count:', filteredOrders.length);
    if (selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map(o => o.id));
    }
  };
  const generateBatchPickingList = async (ids?: string[]) => {
    const targetIds = ids || selectedOrderIds;
    
    if (!targetIds || targetIds.length === 0) {
      toast.error('Nenhum pedido selecionado para separação.');
      return;
    }

    console.log('Generating batch picking list for:', targetIds);
    try {
      setLoadingItems(true);
      
      // 1. Busca os pedidos com seus itens (incluindo endereço e rastreio)
      const { data: detailedOrders, error } = await supabase
        .from('orders')
        .select('id, created_at, customer_name, shipping_address, tracking_code, order_items(product_name, quantity)')
        .in('id', targetIds);
      
      console.log('Detailed orders returned from Supabase:', detailedOrders);
      
      if (error) throw error;

      if (!detailedOrders || detailedOrders.length === 0) {
        throw new Error('Nenhum dado encontrado para os pedidos selecionados.');
      }

      // 2. Agrupa os produtos para o resumo
      const summary: Record<string, number> = {};
      detailedOrders.forEach(order => {
        if (order.order_items) {
          order.order_items.forEach((item: any) => {
            summary[item.product_name] = (summary[item.product_name] || 0) + item.quantity;
          });
        }
      });

      // 3. Estrutura os dados para o modal
      setPickingData({
        summary,
        orders: detailedOrders
      });
      setShowPickingModal(true);
      toast.success('Lista de separação gerada!');
    } catch (error: any) {
      toast.error('Erro ao gerar separação: ' + error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchOrderItems = async (orderId: string) => {
    setLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId);
      
      if (error) throw error;
      setOrderItems(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar itens do pedido: ' + error.message);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchTrackingStatus = async (orderId: string) => {
    try {
      setLoadingTracking(true);
      const status = await shippingService.getTrackingStatus(orderId);
      setTrackingStatus(status);
    } catch (error: any) {
      console.error('Erro ao buscar rastreio:', error);
      setTrackingStatus({ status: 'Erro ao buscar rastreio', history: [] });
    } finally {
      setLoadingTracking(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      toast.success('Status do pedido atualizado!');

      // Automação: Se o status mudou para 'paid', tenta gerar a etiqueta automaticamente
      if (newStatus === 'paid') {
        toast.loading('Pagamento confirmado! Gerando etiqueta automaticamente...');
        await handleGenerateLabel(orderId);
      }
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const updateTrackingCode = async (orderId: string, trackingCode: string, shippingLabelUrl?: string) => {
    try {
      const updateData: any = { tracking_code: trackingCode };
      if (shippingLabelUrl !== undefined) {
        updateData.shipping_label_url = shippingLabelUrl;
      }

      // Se o status atual for 'paid' ou 'processing', muda para 'shipped' ao adicionar rastreio
      const currentOrder = orders.find(o => o.id === orderId);
      if (currentOrder && (currentOrder.status === 'paid' || currentOrder.status === 'processing')) {
        updateData.status = 'shipped';
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.map(o => o.id === orderId ? { ...o, ...updateData } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, ...updateData });
      }
      toast.success('Rastreio atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar rastreio: ' + error.message);
    }
  };

  const deleteOrder = async (orderId: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId);

      if (error) throw error;
      
      setOrders(orders.filter(o => o.id !== orderId));
      toast.success('Pedido excluído com sucesso!');
    } catch (error: any) {
      toast.error('Erro ao excluir pedido: ' + error.message);
    }
  };

  const [sendingRecovery, setSendingRecovery] = useState<string | null>(null);

  const handleManualRecovery = async (cart: AbandonedCart) => {
    try {
      setSendingRecovery(cart.id);
      const { data: settings } = await supabase
        .from('store_settings')
        .select('n8n_webhook_url')
        .maybeSingle();

      if (!settings?.n8n_webhook_url) {
        toast.error('Configure a URL do Webhook n8n nas Configurações > Marketing.');
        return;
      }

      const payload = {
        event: 'manual_recovery',
        timestamp: new Date().toISOString(),
        id: cart.id,
        customer_email: cart.customer_email,
        customer_name: cart.customer_name,
        customer_phone: cart.customer_phone,
        cart_items: cart.cart_items,
        total: cart.total,
        status: cart.status
      };

      const response = await fetch(settings.n8n_webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Falha ao enviar para n8n');

      // Atualizar status para 'notified'
      await supabase
        .from('abandoned_carts')
        .update({ status: 'notified', updated_at: new Date().toISOString() })
        .eq('id', cart.id);

      toast.success('Solicitação de recuperação enviada para o n8n!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao enviar recuperação: ' + error.message);
    } finally {
      setSendingRecovery(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'processing': return 'bg-blue-100 text-blue-700';
      case 'shipped': return 'bg-indigo-100 text-indigo-700';
      case 'delivered': return 'bg-emerald-100 text-emerald-700';
      case 'cancelled': return 'bg-rose-100 text-rose-700';
      case 'refunded': return 'bg-slate-100 text-slate-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'paid': return 'Pago';
      case 'pending': return 'Pendente';
      case 'processing': return 'Em Processamento';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      case 'refunded': return 'Reembolsado';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 size={16} />;
      case 'pending': return <Clock size={16} />;
      case 'processing': return <Package size={16} />;
      case 'shipped': return <Truck size={16} />;
      case 'delivered': return <CheckCircle2 size={16} />;
      case 'cancelled': return <XCircle size={16} />;
      default: return <Clock size={16} />;
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (order.customer_email && order.customer_email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_name && order.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.customer_document && order.customer_document.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    let matchesDate = true;
    const orderDate = new Date(order.created_at);
    if (startDate) {
      matchesDate = matchesDate && orderDate >= new Date(startDate);
    }
    if (endDate) {
      // Ajusta para o final do dia
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && orderDate <= end;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) return <Loading message="Carregando pedidos..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
            >
              <ArrowLeft size={18} />
              Voltar ao Painel
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <ShoppingBag className="text-indigo-600" />
              {activeTab === 'orders' ? (isAdmin ? 'Gestão de Pedidos' : 'Meus Pedidos') : 'Carrinhos Abandonados'}
            </h1>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowManualOrderModal(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
              >
                <Plus size={20} />
                Novo Pedido (Balcão)
              </button>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Pedidos
                </button>
                <button
                  onClick={() => setActiveTab('abandoned')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'abandoned' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Abandonados
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'orders' ? (
          <>
            {/* Filtros */}
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black text-slate-900">Gestão de Pedidos</h2>
                {selectedOrderIds.length > 0 && (
                  <button 
                    onClick={() => generateBatchPickingList()}
                    className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
                  >
                    <Package size={16} />
                    Gerar Separação ({selectedOrderIds.length})
                  </button>
                )}
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input 
                    type="text" 
                    placeholder="Buscar por ID, Nome, Email ou CPF..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
            
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-colors ${showFilters ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              <Filter size={20} />
              Filtros Avançados
            </button>
          </div>

          {showFilters && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100"
            >
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status do Pedido</label>
                <select 
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="all">Todos os Status</option>
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="processing">Em Processamento</option>
                  <option value="shipped">Enviado</option>
                  <option value="delivered">Entregue</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Inicial</label>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Data Final</label>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </motion.div>
          )}
        </div>

        {/* Lista de Pedidos */}
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
          <div className="overflow-auto max-h-[calc(100vh-320px)] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 transition-colors">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <input type="checkbox" checked={selectedOrderIds.length === filteredOrders.length && filteredOrders.length > 0} onChange={toggleSelectAll} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  </th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID do Pedido</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                  {isAdmin && <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>}
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <input type="checkbox" checked={selectedOrderIds.includes(order.id)} onChange={() => toggleOrderSelection(order.id)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-bold text-slate-600">
                        {order.id.split('-')[0].toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-900">
                            {order.customer_name || 'Cliente'}
                          </span>
                          <span className="text-xs text-slate-500">{order.customer_email || 'Sem email'}</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <span className="text-sm font-black text-slate-900">
                        R$ {order.total.toFixed(2)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailsModal(true);
                          fetchOrderItems(order.id);
                          fetchTrackingStatus(order.id);
                        }}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors inline-flex"
                        title="Ver Detalhes"
                      >
                        <Eye size={18} />
                      </button>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteOrder(order.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex"
                          title="Excluir Pedido"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 6 : 5} className="px-6 py-12 text-center text-slate-500">
                      Nenhum pedido encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>
    ) : (
          <div className="space-y-4">
            {abandonedCarts.length === 0 ? (
              <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-200 text-center">
                <ShoppingBag size={48} className="mx-auto text-slate-200 mb-4" />
                <h3 className="text-lg font-bold text-slate-900">Nenhum carrinho abandonado</h3>
                <p className="text-slate-500">Ótimo sinal! Todos os seus clientes estão finalizando as compras.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {abandonedCarts.map((cart) => (
                  <div key={cart.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${cart.status === 'recovered' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                            {cart.status === 'recovered' ? 'Recuperado' : 'Abandonado'}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">
                            {new Date(cart.updated_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <h3 className="font-black text-slate-900 uppercase italic tracking-tight text-lg">
                          {cart.customer_name || 'Cliente Sem Nome'}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500 font-medium">
                          <span className="flex items-center gap-1"><Eye size={14} /> {cart.customer_email}</span>
                          <span className="flex items-center gap-1"><Package size={14} /> {cart.cart_items.length} itens</span>
                          <span className="font-black text-indigo-600">Total: R$ {cart.total.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleManualRecovery(cart)}
                          disabled={sendingRecovery === cart.id}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-lg ${
                            cart.status === 'notified' 
                              ? 'bg-slate-100 text-slate-500 cursor-not-allowed' 
                              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                          }`}
                        >
                          {sendingRecovery === cart.id ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : <Zap size={16} />}
                          {cart.status === 'notified' ? 'Notificado' : 'Recuperar via n8n'}
                        </button>
                        <a 
                          href={`https://wa.me/55${cart.customer_phone?.replace(/\D/g, '')}?text=Olá ${cart.customer_name}, vimos que você deixou alguns itens no carrinho da G-Fit Life. Gostaria de finalizar sua compra?`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-xl font-bold text-sm hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-slate-50 flex gap-2 overflow-x-auto pb-2">
                      {cart.cart_items.map((item: any, idx: number) => (
                        <div key={idx} className="flex-shrink-0 w-12 h-12 bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                          <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-contain p-1" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal de Pedido Manual (Balcão) */}
      {showManualOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-600 text-white">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag size={24} />
                Novo Pedido de Balcão
              </h2>
              <button onClick={() => setShowManualOrderModal(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Esquerda: Seleção de Produtos */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Package size={18} className="text-emerald-600" />
                    Produtos Disponíveis
                  </h3>
                  <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Buscar produto..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto pr-2">
                    {products.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addItemToOrder(product)}
                        className="flex items-center gap-3 p-2 bg-slate-50 hover:bg-emerald-50 border border-slate-100 rounded-xl transition-all text-left group"
                      >
                        <img src={product.image_url} alt="" className="w-10 h-10 object-contain bg-white rounded-lg border border-slate-200" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                          <p className="text-xs text-slate-500">Estoque: {product.stock} | R$ {(product.discount_price || product.price).toFixed(2)}</p>
                        </div>
                        <Plus size={16} className="text-slate-400 group-hover:text-emerald-600" />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <ShoppingBag size={18} className="text-emerald-600" />
                    Itens Selecionados
                  </h3>
                  <div className="space-y-2">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.quantity}x R$ {item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              if (item.quantity > 1) {
                                setSelectedItems(selectedItems.map(i => i.id === item.id ? { ...i, quantity: i.quantity - 1 } : i));
                              } else {
                                removeItemFromOrder(item.id);
                              }
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </button>
                          <span className="font-bold text-slate-900 w-8 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => addItemToOrder(item)}
                            className="p-1 text-slate-400 hover:text-emerald-600"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedItems.length === 0 && (
                      <div className="text-center py-8 text-slate-400 italic text-sm">Nenhum item selecionado</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Direita: Dados do Cliente e Custos */}
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <User size={18} className="text-emerald-600" />
                    Dados do Cliente
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                      <input 
                        type="text"
                        value={manualOrderData.customer_name}
                        onChange={e => setManualOrderData({...manualOrderData, customer_name: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="Nome do cliente"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                      <input 
                        type="text"
                        value={manualOrderData.customer_phone}
                        onChange={e => setManualOrderData({...manualOrderData, customer_phone: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CPF/CNPJ</label>
                      <input 
                        type="text"
                        value={manualOrderData.customer_document}
                        onChange={e => setManualOrderData({...manualOrderData, customer_document: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">CEP (Auto-preencher)</label>
                      <input 
                        type="text"
                        onChange={e => handleManualCepBlur(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                        placeholder="00000-000"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Clock size={18} className="text-emerald-600" />
                    Pagamento e Custos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Forma de Pagamento</label>
                      <select 
                        value={manualOrderData.payment_method}
                        onChange={e => setManualOrderData({...manualOrderData, payment_method: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="cash">Dinheiro</option>
                        <option value="pix">PIX</option>
                        <option value="credit_card">Cartão de Crédito</option>
                        <option value="debit_card">Cartão de Débito</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Afiliado (Opcional)</label>
                      <select 
                        value={manualOrderData.affiliate_id}
                        onChange={e => setManualOrderData({...manualOrderData, affiliate_id: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Nenhum</option>
                        {affiliates.map(aff => (
                          <option key={aff.id} value={aff.id}>{aff.name} ({aff.code})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Desconto (R$)</label>
                      <input 
                        type="number"
                        value={manualOrderData.discount}
                        onChange={e => setManualOrderData({...manualOrderData, discount: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Frete/Entrega (R$)</label>
                      <input 
                        type="number"
                        value={manualOrderData.shipping_cost}
                        onChange={e => setManualOrderData({...manualOrderData, shipping_cost: parseFloat(e.target.value) || 0})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
                  <div className="flex justify-between items-center text-sm opacity-70">
                    <span>Subtotal</span>
                    <span>R$ {selectedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-rose-400">
                    <span>Desconto</span>
                    <span>- R$ {manualOrderData.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-emerald-400">
                    <span>Frete</span>
                    <span>+ R$ {manualOrderData.shipping_cost.toFixed(2)}</span>
                  </div>
                  <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                    <span className="font-bold uppercase tracking-widest text-xs">Total Final</span>
                    <span className="text-3xl font-black">R$ {calculateManualTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setShowManualOrderModal(false)}
                className="px-6 py-3 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={saveManualOrder}
                disabled={savingManualOrder || selectedItems.length === 0}
                className="px-10 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50 flex items-center gap-2"
              >
                {savingManualOrder ? <Loading message="" /> : <Save size={20} />}
                Finalizar Pedido
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Separação */}
      {showPickingModal && pickingData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm print:hidden">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Lista de Separação</h2>
            
            {/* Conteúdo para Impressão */}
            <div id="picking-list-content" className="print:block print:w-full">
              <div className="bg-slate-50 p-4 rounded-2xl mb-6">
                <h3 className="font-bold text-slate-900 mb-2">Resumo Geral</h3>
                <div className="space-y-1">
                  {Object.entries(pickingData.summary).map(([name, qty]) => (
                    <div key={name} className="flex justify-between border-b border-slate-200 py-1">
                      <span className="text-sm text-slate-700">{name}</span>
                      <span className="font-bold text-slate-900">{qty}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {pickingData.orders.map((order: any) => (
                  <div key={order.id} className="border border-slate-300 p-4 rounded-lg">
                    <div className="font-bold text-slate-900 mb-2 border-b border-slate-200 pb-2 flex justify-between items-center">
                      <span>
                        Pedido: {order.id.split('-')[0].toUpperCase()} | 
                        Cliente: {order.customer_name} | 
                        Cidade: {order.shipping_address?.city || 'N/A'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">Rastreio:</span>
                        {order.tracking_code ? (
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">{order.tracking_code}</span>
                            <div className="p-1 bg-white border border-slate-200 rounded shadow-sm">
                              <QRCodeCanvas 
                                value={getTrackingUrl(order.tracking_code, order.shipping_method)} 
                                size={40}
                                level="L"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input 
                              type="text" 
                              placeholder="Código manual"
                              className="text-xs border border-slate-300 rounded px-2 py-1 w-32 focus:ring-1 focus:ring-indigo-500 outline-none"
                              value={manualTracking[order.id] || ''}
                              onChange={(e) => setManualTracking(prev => ({ ...prev, [order.id]: e.target.value.toUpperCase() }))}
                            />
                            <button 
                              onClick={() => updateOrderTracking(order.id)}
                              disabled={isUpdatingTracking}
                              className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                              title="Salvar Rastreio"
                            >
                              <Save size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      {order.order_items.map((item: any, idx: number) => (
                        <div key={idx} className="text-sm text-slate-700">
                          Produto: {item.product_name} - Quantidade: {item.quantity}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 mt-8 print:hidden">
              <button 
                onClick={printPickingList} 
                className="flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
              >
                <Printer size={20} />
                Imprimir / Salvar PDF
              </button>
              <button 
                onClick={printShippingLabels} 
                className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
              >
                <QrCode size={20} />
                Gerar Etiquetas (Auto)
              </button>
              <button 
                onClick={() => {
                  if (pickingData && pickingData.orders.length > 0) {
                    handleManualLabelRedirect(pickingData.orders[0]);
                  } else {
                    toast.error('Nenhum pedido selecionado');
                  }
                }} 
                className="flex-1 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <ExternalLink size={20} />
                Manual (Site)
              </button>
              <button onClick={() => setShowPickingModal(false)} className="px-6 py-3 bg-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-300">Fechar</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Detalhes do Pedido */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
              <div>
                <h2 className="text-xl font-bold">Pedido #{selectedOrder.id.split('-')[0].toUpperCase()}</h2>
                {selectedOrder.tracking_code && (
                  <p className="text-xs font-bold text-amber-300 uppercase tracking-widest mt-1">
                    Rastreio: {selectedOrder.tracking_code}
                  </p>
                )}
                <p className="text-xs opacity-80">{new Date(selectedOrder.created_at).toLocaleString('pt-BR')}</p>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="hover:rotate-90 transition-transform">
                <XCircle size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto">
              {/* Status e Ações */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Status Atual</p>
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(selectedOrder.status)}`}>
                    {getStatusIcon(selectedOrder.status)}
                    {getStatusText(selectedOrder.status)}
                  </span>
                </div>
                
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <div className="w-full mb-2">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Ações de Logística</p>
                    </div>
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleGenerateLabel(selectedOrder.id)}
                          disabled={processingShipping || !!selectedOrder.tracking_code}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                          title="Gera etiqueta usando seus créditos CepCerto"
                        >
                          <Zap size={14} />
                          Automática
                        </button>
                        <button 
                          onClick={() => handleManualLabelRedirect(selectedOrder)}
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                          title="Abre o site do CepCerto com dados copiados"
                        >
                          <ExternalLink size={14} />
                          Manual (Site)
                        </button>
                      </div>

                      <div className="flex flex-col gap-1 mt-2">
                        <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Código de Rastreio</p>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={tempTrackingCode}
                            onChange={(e) => setTempTrackingCode(e.target.value)}
                            placeholder="Ex: AA123456789BR"
                            className="flex-1 px-3 py-2 bg-white border border-indigo-100 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button 
                            onClick={() => {
                              updateTrackingCode(selectedOrder.id, tempTrackingCode);
                              fetchRealTimeTracking(tempTrackingCode);
                            }}
                            className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-200 transition-all"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>

                      {realTimeTracking && (
                        <div className="mt-2 p-3 bg-white rounded-xl border border-indigo-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Status Real-Time</p>
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                              {realTimeTracking.status}
                            </span>
                          </div>
                          {realTimeTracking.history && realTimeTracking.history.length > 0 && (
                            <div className="text-[10px] text-slate-500 italic line-clamp-1">
                              Última atualização: {realTimeTracking.history[0].description} ({realTimeTracking.history[0].location})
                            </div>
                          )}
                        </div>
                      )}

                      <button 
                        onClick={() => handlePrintPickingList(selectedOrder.id)}
                        disabled={processingLogistics}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-xs font-bold hover:bg-amber-700 transition-all disabled:opacity-50"
                      >
                        <Printer size={16} />
                        Separar Produto
                      </button>
                    </div>
                    <button 
                      onClick={() => handleCancelLabel(selectedOrder.id)}
                      disabled={processingShipping || !selectedOrder.tracking_code}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-100 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-200 transition-all disabled:opacity-50"
                    >
                      <Ban size={16} />
                      Cancelar Etiqueta
                    </button>

                    <div className="w-full mt-2 pt-2 border-t border-indigo-100">
                      <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-1">Alterar Status</p>
                      <select 
                        value={selectedOrder.status}
                        onChange={(e) => updateOrderStatus(selectedOrder.id, e.target.value)}
                        className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="pending">Pendente</option>
                        <option value="paid">Pago</option>
                        <option value="processing">Em Processamento</option>
                        <option value="shipped">Enviado</option>
                        <option value="delivered">Entregue</option>
                        <option value="cancelled">Cancelado</option>
                        <option value="refunded">Reembolsado</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Informações do Cliente */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Dados do Cliente</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Nome:</span> {selectedOrder.customer_name || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Email:</span> {selectedOrder.customer_email || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Telefone:</span> {selectedOrder.customer_phone || 'N/A'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">CPF/CNPJ:</span> {selectedOrder.customer_document || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Pagamento e Envio</h3>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Método Pag.:</span> {selectedOrder.payment_method.toUpperCase()}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Método Envio:</span> {selectedOrder.shipping_method || 'Padrão'}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Total:</span> R$ {selectedOrder.total.toFixed(2)}</p>
                    <p className="text-sm text-slate-600"><span className="font-bold text-slate-900">Endereço:</span> {selectedOrder.shipping_address?.street}, {selectedOrder.shipping_address?.number}</p>
                    <p className="text-sm text-slate-500 text-xs">
                      {selectedOrder.shipping_address?.city} - {selectedOrder.shipping_address?.state}, 
                      CEP: {selectedOrder.shipping_address?.zipCode || selectedOrder.shipping_address?.zip || selectedOrder.shipping_address?.cep || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Dados para Faturamento e Logística */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Faturamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nome/Razão Social</p>
                    <p className="text-sm font-bold text-slate-900">{selectedOrder.customer_name}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">CPF/CNPJ</p>
                    <p className="text-sm font-bold text-slate-900">{selectedOrder.customer_document}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Endereço Completo</p>
                    <p className="text-sm text-slate-700">
                      {selectedOrder.shipping_address?.street}, {selectedOrder.shipping_address?.number} {selectedOrder.shipping_address?.complement && `- ${selectedOrder.shipping_address.complement}`}
                      <br />
                      {selectedOrder.shipping_address?.neighborhood}, {selectedOrder.shipping_address?.city} - {selectedOrder.shipping_address?.state}
                      <br />
                      CEP: {selectedOrder.shipping_address?.zipCode}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total do Pedido</p>
                    <p className="text-sm font-bold text-slate-900">R$ {selectedOrder.total.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Peso Total (Est.)</p>
                    <p className="text-sm font-bold text-slate-900">{orderItems.reduce((acc, item) => acc + (item.quantity * 0.5), 0).toFixed(2)} kg</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const text = `Nome: ${selectedOrder.customer_name}\nDoc: ${selectedOrder.customer_document}\nEndereço: ${selectedOrder.shipping_address?.street}, ${selectedOrder.shipping_address?.number}, ${selectedOrder.shipping_address?.neighborhood}, ${selectedOrder.shipping_address?.city}-${selectedOrder.shipping_address?.state}, CEP: ${selectedOrder.shipping_address?.zipCode}\nTotal: R$ ${selectedOrder.total.toFixed(2)}`;
                      navigator.clipboard.writeText(text);
                      toast.success('Dados copiados para a área de transferência!');
                    }}
                    className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-300 transition-colors"
                  >
                    Copiar todos os dados
                  </button>
                  <button 
                    onClick={() => handlePrintInvoice(selectedOrder.id)}
                    disabled={processingLogistics}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                  >
                    <Printer size={16} />
                    Emitir Nota Fiscal (Manual)
                  </button>
                </div>
              </div>

              {/* Código de Rastreio */}
              {(selectedOrder.tracking_code || isAdmin) && (
                <div className="space-y-4">
                  {/* Tracking info display */}
                  {selectedOrder.tracking_code && (
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 mb-4">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold mb-2">
                        <Truck size={18} />
                        Rastreamento
                      </div>
                      <p className="text-sm text-indigo-600 font-mono">{selectedOrder.tracking_code}</p>
                      <div className="flex flex-col gap-2 mt-2">
                        <Link 
                          to={`/tracking/${selectedOrder.tracking_code}`} 
                          className="text-xs font-bold text-indigo-700 hover:underline block"
                        >
                          Acompanhar no site da transportadora
                        </Link>
                        {selectedOrder.shipping_label_url && (
                          <a 
                            href={selectedOrder.shipping_label_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-emerald-600 hover:underline block flex items-center gap-1"
                          >
                            <Printer size={14} />
                            Imprimir Etiqueta
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                      <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-2">Código de Rastreio</p>
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          placeholder="Ex: BR123456789"
                          defaultValue={selectedOrder.tracking_code || ''}
                          onBlur={(e) => updateTrackingCode(selectedOrder.id, e.target.value)}
                          className="flex-1 px-4 py-2 bg-white border border-indigo-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <p className="text-[10px] text-indigo-400 mt-1 italic">* O código é salvo automaticamente ao sair do campo.</p>
                    </div>
                  )}

                  {/* Status de Rastreamento Dinâmico */}
                  {loadingTracking ? (
                    <div className="text-center py-4 text-slate-500">Carregando rastreamento...</div>
                  ) : trackingStatus && (
                    <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-indigo-400">Status de Rastreamento</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono bg-white/10 px-2 py-1 rounded uppercase">{selectedOrder.tracking_code || 'Manual'}</span>
                          {selectedOrder.tracking_code && (
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(selectedOrder.tracking_code);
                                toast.success('Código copiado!');
                              }}
                              className="text-[10px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                            >
                              Copiar
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {trackingStatus.history && trackingStatus.history.length > 0 ? (
                        <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/10">
                          {trackingStatus.history.map((h: any, idx: number) => (
                            <div key={idx} className="relative">
                              <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-slate-900 flex items-center justify-center ${idx === 0 ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                                <Truck size={12} className="text-white" />
                              </div>
                              <p className="text-xs font-bold">{h.status || h.description}</p>
                              <p className="text-[10px] text-slate-400">{h.location} | {h.date}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-slate-400 italic text-sm">
                          {trackingStatus.status || 'Aguardando atualização da transportadora'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Itens do Pedido */}
              <div className="space-y-4">
                <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2">Itens do Pedido</h3>
                {loadingItems ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : orderItems.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-4 text-center text-slate-400 text-sm italic">
                    Nenhum item encontrado para este pedido.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="w-12 h-12 bg-white rounded-xl border border-slate-200 overflow-hidden flex-shrink-0">
                          <img 
                            src={'https://picsum.photos/seed/product/200/200'} 
                            alt={item.product_name} 
                            className="w-full h-full object-contain p-1"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">{item.product_name}</p>
                          <p className="text-xs text-slate-500">{item.quantity}x R$ {item.price.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">R$ {(item.quantity * item.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal dos Itens</span>
                      <span className="font-bold text-slate-900">R$ {orderItems.reduce((acc, item) => acc + (item.quantity * item.price), 0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="px-6 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
