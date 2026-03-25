import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  CreditCard, 
  MapPin, 
  Truck, 
  ShieldCheck, 
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Barcode,
  Landmark
} from 'lucide-react';
import { isValidDocument } from '../lib/validation';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { cepService } from '../services/cepService';
import { paymentService } from '../services/paymentService';
import { shippingService, ShippingPackage, ShippingQuote } from '../services/shippingService';
import { leadService } from '../services/leadService';

interface Product {
  id: string;
  name: string;
  price: number;
  discount_price?: number;
  image_url?: string;
  min_installment_value?: number;
  affiliate_commission?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'pix' | 'boleto' | 'transfer'>('pix');
  const [shippingMethods, setShippingMethods] = useState<ShippingQuote[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<number>(0);
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [appliedDiscounts, setAppliedDiscounts] = useState<{ name: string; value: number }[]>([]);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [gateways, setGateways] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [affiliateCoupon, setAffiliateCoupon] = useState<any>(null);
  
  // Form state
  const [customer, setCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    document: ''
  });

  const [shipping, setShipping] = useState({
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: ''
  });

  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: '',
    installments: '1'
  });

  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(299);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        // Carregar cupom do link se existir
        const searchParams = new URLSearchParams(window.location.search);
        const urlCoupon = searchParams.get('coupon');
        if (urlCoupon) {
          localStorage.setItem('applied_coupon', urlCoupon.toUpperCase());
          setCouponCode(urlCoupon.toUpperCase());
        }

        const savedCoupon = localStorage.getItem('applied_coupon');
        if (savedCoupon) {
          setCouponCode(savedCoupon);
          
          // Buscar detalhes do cupom de afiliado
          const { data: affCoupon } = await supabase
            .from('affiliate_coupons')
            .select('*, affiliate:affiliates(name)')
            .eq('code', savedCoupon.toUpperCase())
            .eq('active', true)
            .maybeSingle();
          
          if (affCoupon) {
            setAffiliateCoupon(affCoupon);
            toast.success(`Cupom de afiliado ${savedCoupon} aplicado!`, { icon: '🤝' });
          }
        }

        // Lógica de Produto Direto via URL (?product=ID)
        const urlProductId = searchParams.get('product');
        const urlQuantity = parseInt(searchParams.get('quantity') || '1');

        if (urlProductId) {
          const { data: directProduct, error: prodError } = await supabase
            .from('products')
            .select('*')
            .eq('id', urlProductId)
            .eq('active', true)
            .single();
          
          if (directProduct && !prodError) {
            const newCartItem = { product: directProduct, quantity: urlQuantity };
            setCart([newCartItem]);
            localStorage.setItem('cart_items', JSON.stringify([newCartItem]));
          } else {
            toast.error('Produto não encontrado ou indisponível.');
            navigate('/');
            return;
          }
        } else {
          const savedCart = localStorage.getItem('cart_items');
          if (savedCart) {
            const parsedCart = JSON.parse(savedCart);
            if (parsedCart.length === 0) {
              navigate('/');
              return;
            }
            setCart(parsedCart);
          } else {
            navigate('/');
            return;
          }
        }

        // Fetch shipping methods and discount rules
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('*')
          .maybeSingle();
        
        if (settingsData) {
          setSettings(settingsData);
          if (settingsData.free_shipping_threshold) {
            setFreeShippingThreshold(settingsData.free_shipping_threshold);
          }
          if (settingsData.shipping_methods) {
            const activeMethods = settingsData.shipping_methods.filter((m: any) => m.active);
            setShippingMethods(activeMethods);
          }
        } else {
          // Fallback
          setShippingMethods([
            { id: 'pac', name: 'Correios (PAC)', price: 25.90, deadline: '7 a 10 dias úteis', provider: 'correios' },
            { id: 'sedex', name: 'Correios (SEDEX)', price: 45.90, deadline: '2 a 4 dias úteis', provider: 'correios' }
          ]);
        }

        // Fetch Discount Rules
        const { data: rulesData } = await supabase
          .from('discount_rules')
          .select('*')
          .eq('active', true);
        setDiscountRules(rulesData || []);

        // Fetch Campaigns with discounts
        const { data: campaignsData } = await supabase
          .from('campaigns')
          .select('*')
          .eq('active', true);
        setCampaigns(campaignsData || []);

        // Fetch Payment Gateways
        const { data: gatewaysData } = await supabase
          .from('payment_gateways')
          .select('*')
          .eq('active', true);
        setGateways(gatewaysData || []);

        // Fetch Shipping Carriers
        const { data: carriersData } = await supabase
          .from('shipping_carriers')
          .select('*')
          .eq('active', true);
        setCarriers(carriersData || []);

        // Check for first purchase
        if (session?.user) {
          const { count } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .eq('status', 'paid');
          setIsFirstPurchase(count === 0);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  // Validar cupom quando o código mudar
  useEffect(() => {
    const validateCoupon = async () => {
      if (!couponCode) {
        setAffiliateCoupon(null);
        return;
      }

      // Se já for o mesmo cupom, não busca de novo
      if (affiliateCoupon && affiliateCoupon.code.toUpperCase() === couponCode.toUpperCase()) {
        return;
      }

      const { data: affCoupon } = await supabase
        .from('affiliate_coupons')
        .select('*, affiliate:affiliates(name)')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true)
        .maybeSingle();
      
      if (affCoupon) {
        setAffiliateCoupon(affCoupon);
        localStorage.setItem('applied_coupon', couponCode.toUpperCase());
      } else {
        setAffiliateCoupon(null);
      }
    };

    const timer = setTimeout(validateCoupon, 500);
    return () => clearTimeout(timer);
  }, [couponCode]);

  const calculatePrice = (product: Product, quantity: number) => {
    const unitPrice = product.discount_price || product.price;
    return {
      unitPrice,
      total: unitPrice * quantity
    };
  };

  const cartTotal = cart.reduce((acc, item) => {
    const { total } = calculatePrice(item.product, item.quantity);
    return acc + total;
  }, 0);

  // Calculate Discounts
  useEffect(() => {
    const calculateDiscounts = async () => {
      let newDiscounts: { name: string; value: number }[] = [];
      let currentTotal = cartTotal;

      // 1. Check Legacy Discount Rules
      for (const rule of discountRules) {
        let apply = false;

        if (rule.type === 'first_purchase' && isFirstPurchase) {
          apply = true;
        } else if (rule.type === 'pix' && paymentMethod === 'pix') {
          apply = true;
        }

        if (apply) {
          let discountValue = (currentTotal * rule.value) / 100;
          newDiscounts.push({ name: rule.name, value: discountValue });
        }
      }

      // 2. Check Campaign Rules
      for (const campaign of campaigns) {
        if (!campaign.discount_value) continue;

        let apply = false;
        const trigger = campaign.trigger_type || 'automatic';

        if (trigger === 'automatic') {
          apply = true;
        } else if (trigger === 'coupon' && couponCode.toUpperCase() === campaign.coupon_code?.toUpperCase()) {
          apply = true;
        } else if (trigger === 'min_value' && cartTotal >= (campaign.trigger_value || 0)) {
          apply = true;
        } else if (trigger === 'first_purchase' && isFirstPurchase) {
          apply = true;
        }

        if (apply) {
          let discountValue = 0;
          if (campaign.discount_type === 'percentage') {
            discountValue = (currentTotal * campaign.discount_value) / 100;
          } else {
            discountValue = campaign.discount_value;
          }
          newDiscounts.push({ name: campaign.title, value: discountValue });
        }
      }

      // 3. Check Affiliate Coupon
      if (affiliateCoupon && couponCode.toUpperCase() === affiliateCoupon.code.toUpperCase()) {
        const discountValue = (currentTotal * affiliateCoupon.discount_percentage) / 100;
        newDiscounts.push({ 
          name: `Cupom Afiliado: ${affiliateCoupon.code}`, 
          value: discountValue 
        });
      }

      setAppliedDiscounts(newDiscounts);
    };

    calculateDiscounts();
  }, [cartTotal, discountRules, campaigns, paymentMethod, isFirstPurchase, couponCode, affiliateCoupon]);

  const totalDiscount = appliedDiscounts.reduce((acc, d) => acc + d.value, 0);
  const currentShipping = shippingMethods[selectedShipping];
  const shippingCost = cartTotal >= freeShippingThreshold ? 0 : (currentShipping?.price || 0);
  const finalTotal = Math.max(0, cartTotal - totalDiscount + shippingCost);

  // Abandoned Cart Logic
  useEffect(() => {
    const trackAbandonedCart = async () => {
      if (!customer.email || cart.length === 0) return;

      try {
        const payload = {
          customer_email: customer.email,
          customer_name: customer.name,
          customer_phone: customer.phone,
          cart_items: cart,
          total: finalTotal,
          status: 'abandoned',
          updated_at: new Date().toISOString()
        };

        if (abandonedCartId) {
          await supabase
            .from('abandoned_carts')
            .update(payload)
            .eq('id', abandonedCartId);
          
          // Trigger n8n webhook for update
          leadService.sendToWebhook('cart_updated', {
            id: abandonedCartId,
            ...payload
          });
        } else {
          const { data, error } = await supabase
            .from('abandoned_carts')
            .insert([payload])
            .select()
            .single();
          
          if (!error && data) {
            setAbandonedCartId(data.id);
            // Trigger n8n webhook for new abandoned cart
            leadService.sendToWebhook('cart_abandoned', {
              id: data.id,
              ...payload
            });
          }
        }
      } catch (error) {
        console.error('Error tracking abandoned cart:', error);
      }
    };

    const timeoutId = setTimeout(trackAbandonedCart, 2000); // Debounce 2s
    return () => clearTimeout(timeoutId);
  }, [customer.email, customer.name, customer.phone, cart, finalTotal, abandonedCartId]);

  const handleDocumentBlur = () => {
    if (customer.document && !isValidDocument(customer.document)) {
      toast.error('CPF ou CNPJ inválido.');
    }
  };

  const handleCepBlur = async () => {
    const cep = shipping.cep.replace(/\D/g, '');
    console.log('CEP digitado:', cep);
    if (cep.length !== 8) {
      console.log('CEP inválido ou incompleto');
      return;
    }

    setLoading(true);
    try {
      const address = await cepService.fetchAddress(cep);
      console.log('Endereço retornado:', address);
      if (address) {
        setShipping(prev => ({
          ...prev,
          ...address
        }));

        // Calculate shipping automatically
        const packages: ShippingPackage[] = cart.map(item => ({
          weight: (item.product as any).weight || 0.5,
          height: (item.product as any).height || 10,
          width: (item.product as any).width || 10,
          length: (item.product as any).length || 10
        }));

        const quotes = await shippingService.calculateShipping(cep, packages);
        console.log('Cotações de frete:', quotes);
        if (quotes.length > 0) {
          setShippingMethods(quotes);
          setSelectedShipping(0);
        } else {
          console.log('Nenhuma cotação de frete encontrada');
        }
      } else {
        console.log('Endereço não encontrado para o CEP');
      }
    } catch (error) {
      console.error('Error fetching CEP or calculating shipping:', error);
    } finally {
      setLoading(false);
    }
  };

  // Injeção de Pixels de Rastreamento
  useEffect(() => {
    const activePixels: string[] = [];
    
    if (settings?.tracking_pixels) {
      settings.tracking_pixels.forEach((pixel: any) => {
        if (pixel.active && pixel.pixel_id) {
          const pixelKey = `pixel-${pixel.platform}-${pixel.pixel_id}`;
          if (document.getElementById(pixelKey)) return;

          activePixels.push(pixelKey);

          if (pixel.platform === 'facebook') {
            const script = document.createElement('script');
            script.id = pixelKey;
            script.innerHTML = `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${pixel.pixel_id}');
              fbq('track', 'InitiateCheckout');
            `;
            document.head.appendChild(script);
          } else if (pixel.platform === 'google_analytics') {
            const script1 = document.createElement('script');
            const jsKey = `${pixelKey}-js`;
            script1.id = jsKey;
            script1.async = true;
            script1.src = `https://www.googletagmanager.com/gtag/js?id=${pixel.pixel_id}`;
            document.head.appendChild(script1);
            activePixels.push(jsKey);

            const script2 = document.createElement('script');
            script2.id = pixelKey;
            script2.innerHTML = `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${pixel.pixel_id}');
            `;
            document.head.appendChild(script2);
          }
        }
      });
    }

    return () => {
      activePixels.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentNode) {
          try {
            el.parentNode.removeChild(el);
          } catch (e) {
            console.warn('⚠️ Erro ao remover pixel:', e);
          }
        }
      });
    };
  }, [settings]);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customer.name || !customer.email || !customer.phone || !customer.document) {
      toast.error('Preencha todos os dados pessoais.');
      return;
    }

    if (!shipping.cep || !shipping.street || !shipping.number || !shipping.city || !shipping.state) {
      toast.error('Preencha todos os campos obrigatórios do endereço.');
      return;
    }

    if (paymentMethod === 'credit_card') {
      if (!cardData.number || !cardData.name || !cardData.expiry || !cardData.cvv) {
        toast.error('Preencha todos os dados do cartão.');
        return;
      }
    }

    setProcessing(true);

    try {
      // 0. Check for Affiliate Code or Coupon
      let affiliateId = null;
      let commissionValue = 0;
      let commissionRate = 0;
      
      if (affiliateCoupon) {
        affiliateId = affiliateCoupon.affiliate_id;
        // Buscar taxa de comissão do afiliado do cupom
        const { data: affData } = await supabase
          .from('affiliates')
          .select('commission_rate')
          .eq('id', affiliateId)
          .maybeSingle();
        commissionRate = affData?.commission_rate || 0;
      } else {
        const affiliateCode = localStorage.getItem('affiliate_code');
        if (affiliateCode) {
          const { data: affiliate } = await supabase
            .from('affiliates')
            .select('id, commission_rate')
            .eq('code', affiliateCode)
            .maybeSingle();
          
          if (affiliate) {
            affiliateId = affiliate.id;
            commissionRate = affiliate.commission_rate || 0;
          }
        }
      }
      
      if (affiliateId) {
        // Encontrar a maior taxa entre os produtos no carrinho e a taxa padrão do afiliado
        const productRates = cart.map(item => item.product.affiliate_commission || 0);
        let maxRate = Math.max(commissionRate, ...productRates);
        
        // Se houver cupom de afiliado, descontar metade do valor do cupom da comissão do afiliado
        if (affiliateCoupon) {
          const commissionDeduction = affiliateCoupon.discount_percentage / 2;
          maxRate = Math.max(0, maxRate - commissionDeduction);
        }
        
        // Calculate commission based on the highest rate (adjusted by coupon if applicable)
        commissionValue = cart.reduce((acc, item) => {
          const price = item.product.discount_price || item.product.price;
          return acc + ((price * maxRate / 100) * item.quantity);
        }, 0);
      }

      // 1. Create Order in Supabase
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: user?.id || null, // Allow guest checkout if RLS permits, or require login
          affiliate_id: affiliateId,
          commission_value: commissionValue,
          customer_name: customer.name,
          customer_email: customer.email,
          customer_phone: customer.phone,
          customer_document: customer.document,
          status: 'pending',
          discount_value: totalDiscount,
          total: finalTotal,
          subtotal: cartTotal,
          shipping_cost: shippingCost,
          payment_method: paymentMethod,
          shipping_method: currentShipping?.name || 'Padrão',
          shipping_address: shipping
        }])
        .select()
        .single();

      if (orderError) throw orderError;
      
      // Marcar como lead quente ao realizar pedido
      leadService.updateStatus('quente');

      // 1.1 Mark abandoned cart as recovered
      if (abandonedCartId) {
        await supabase
          .from('abandoned_carts')
          .update({ status: 'recovered' })
          .eq('id', abandonedCartId);
      }

      // 2. Create Order Items
      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.product.id,
        quantity: item.quantity,
        price: item.product.discount_price || item.product.price,
        product_name: item.product.name
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 2.1 Update Inventory Logs and Product Stock
      const inventoryLogs = cart.map(item => ({
        product_id: item.product.id,
        change_amount: -item.quantity,
        reason: `Venda Pedido #${orderData.id.split('-')[0].toUpperCase()}`
      }));

      await supabase
        .from('inventory_logs')
        .insert(inventoryLogs);

      // Update stock for each product
      for (const item of cart) {
        const { data: currentProduct } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product.id)
          .single();
        
        if (currentProduct) {
          await supabase
            .from('products')
            .update({ stock: Math.max(0, currentProduct.stock - item.quantity) })
            .eq('id', item.product.id);
        }
      }

      // 3. Process Payment Gateway
      const activeGateway = gateways.find(g => g.active);
      let paymentResponse: any = { success: true, payment_id: `sim_${activeGateway?.provider || 'internal'}_${Math.random().toString(36).substr(2, 9)}` };

      if (activeGateway && activeGateway.provider === 'pagarme') {
        try {
          paymentResponse = await paymentService.processPagarmePayment({
            items: cart.map(item => ({
              price: item.product.discount_price || item.product.price,
              product_name: item.product.name,
              quantity: item.quantity,
              product_id: item.product.id
            })),
            customer_name: customer.name,
            customer_email: customer.email,
            customer_document: customer.document,
            payment_method: paymentMethod,
            card_number: cardData.number.replace(/\D/g, ''),
            card_name: cardData.name,
            expiry: cardData.expiry,
            cvv: cardData.cvv,
            installments: cardData.installments
          }, activeGateway.config);
        } catch (err: any) {
          paymentResponse = { success: false, error: err.message };
        }
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      }

      // Determine initial status based on payment method
      // For simulation: Credit Card is paid immediately, others are pending
      const initialStatus = paymentResponse.success ? (paymentMethod === 'credit_card' ? 'paid' : 'pending') : 'failed';

      // Update order status
      await supabase
        .from('orders')
        .update({ 
          status: initialStatus, 
          payment_id: paymentResponse.id || paymentResponse.payment_id,
          payment_url: paymentResponse.charges?.[0]?.last_transaction?.pdf || paymentResponse.charges?.[0]?.last_transaction?.url // Exemplo para boleto/pix
        })
        .eq('id', orderData.id);

      // 3.1 Se houver comissão e for pago, atualizar saldo do afiliado
      // (Em um sistema real, isso seria feito após a confirmação do pagamento)
      if (initialStatus === 'paid' && commissionValue > 0 && affiliateId) {
        const { data: aff } = await supabase
          .from('affiliates')
          .select('balance')
          .eq('id', affiliateId)
          .single();
        
        if (aff) {
          await supabase
            .from('affiliates')
            .update({ balance: (aff.balance || 0) + commissionValue })
            .eq('id', affiliateId);
        }
      }

      // Clear cart
      localStorage.removeItem('cart_items');
      setCart([]);

      toast.success('Pedido realizado com sucesso!');
      
      // Trigger n8n webhook for purchase
      leadService.sendToWebhook('purchase_complete', {
        order_id: orderData.id,
        customer_email: customer.email,
        customer_name: customer.name,
        total: finalTotal,
        items: cart.map(item => ({
          name: item.product.name,
          qty: item.quantity,
          price: item.product.discount_price || item.product.price
        }))
      });

      // Trigger Purchase Event
      if (settings?.tracking_pixels) {
        settings.tracking_pixels.forEach((pixel: any) => {
          if (pixel.active && pixel.pixel_id) {
            if (pixel.platform === 'facebook' && (window as any).fbq) {
              (window as any).fbq('track', 'Purchase', {
                value: finalTotal,
                currency: 'BRL'
              });
            } else if (pixel.platform === 'google_analytics' && (window as any).gtag) {
              (window as any).gtag('event', 'purchase', {
                transaction_id: orderData.id,
                value: finalTotal,
                currency: 'BRL',
                items: cart.map(item => ({
                  item_id: item.product.id,
                  item_name: item.product.name,
                  quantity: item.quantity,
                  price: item.product.discount_price || item.product.price
                }))
              });
            }
          }
        });
      }

      // Redirect to success page
      navigate(`/success?orderId=${orderData.id}`);
      
    } catch (error: any) {
      toast.error('Erro ao processar pagamento: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <Loading message="Preparando checkout..." />;

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>
          <div className="flex items-center gap-2 text-emerald-600 font-black tracking-tighter text-xl">
            <ShieldCheck size={24} />
            CHECKOUT SEGURO
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Coluna Esquerda: Dados e Pagamento */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Dados Pessoais */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <ShieldCheck size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Dados Pessoais</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo / Razão Social *</label>
                  <input 
                    type="text" 
                    value={customer.name}
                    onChange={e => setCustomer({...customer, name: e.target.value})}
                    placeholder="João da Silva"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">E-mail *</label>
                  <input 
                    type="email" 
                    value={customer.email}
                    onChange={e => setCustomer({...customer, email: e.target.value})}
                    placeholder="joao@email.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">CPF / CNPJ *</label>
                  <input 
                    type="text" 
                    value={customer.document}
                    onChange={e => setCustomer({...customer, document: e.target.value})}
                    onBlur={handleDocumentBlur}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Inscrição Estadual (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000.000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input 
                    type="text" 
                    value={customer.phone}
                    onChange={e => setCustomer({...customer, phone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
            </section>

            {/* Endereço de Entrega */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <MapPin size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Endereço de Entrega</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">CEP *</label>
                  <input 
                    type="text" 
                    value={shipping.cep}
                    onChange={e => setShipping({...shipping, cep: e.target.value})}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Rua / Avenida *</label>
                  <input 
                    type="text" 
                    value={shipping.street}
                    onChange={e => setShipping({...shipping, street: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Número *</label>
                  <input 
                    type="text" 
                    value={shipping.number}
                    onChange={e => setShipping({...shipping, number: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Complemento</label>
                  <input 
                    type="text" 
                    value={shipping.complement}
                    onChange={e => setShipping({...shipping, complement: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Bairro *</label>
                  <input 
                    type="text" 
                    value={shipping.neighborhood}
                    onChange={e => setShipping({...shipping, neighborhood: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Cidade *</label>
                    <input 
                      type="text" 
                      value={shipping.city}
                      onChange={e => setShipping({...shipping, city: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">UF *</label>
                    <input 
                      type="text" 
                      value={shipping.state}
                      onChange={e => setShipping({...shipping, state: e.target.value})}
                      maxLength={2}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase"
                      required
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Entrega */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                  <Truck size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Forma de Entrega</h2>
              </div>

              <div className="space-y-3">
                {shippingMethods.map((method, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedShipping(index)}
                    className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedShipping === index ? 'border-indigo-500 bg-indigo-50' : 'border-slate-100 hover:border-slate-200'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedShipping === index ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                        {selectedShipping === index && <div className="w-2 h-2 bg-white rounded-full" />}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-slate-900">{method.name}</p>
                        <p className="text-xs text-slate-500">{method.deadline}</p>
                      </div>
                    </div>
                    <p className="font-bold text-slate-900">
                      {method.price === 0 ? 'Grátis' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(method.price)}
                    </p>
                  </button>
                ))}
                
                {cartTotal >= freeShippingThreshold && freeShippingThreshold > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Truck size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Frete Grátis Ativado!</p>
                      <p className="text-xs opacity-80">Você economizou no frete por comprar acima de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(freeShippingThreshold)}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Pagamento */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center text-emerald-600">
                  <CreditCard size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Pagamento</h2>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('pix')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <QrCode size={24} />
                  <span className="font-bold text-sm">PIX</span>
                  {paymentMethod === 'pix' && <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-200 px-2 py-0.5 rounded-md">5% OFF</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <CreditCard size={24} />
                  <span className="font-bold text-sm text-center">Cartão</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Até 12x</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('boleto')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'boleto' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <Barcode size={24} />
                  <span className="font-bold text-sm">Boleto</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">À Vista</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${paymentMethod === 'transfer' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                >
                  <Landmark size={24} />
                  <span className="font-bold text-sm text-center">Transferência</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">TED/DOC</span>
                </button>
              </div>

              {paymentMethod === 'credit_card' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Número do Cartão *</label>
                    <input 
                      type="text" 
                      value={cardData.number}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 16) val = val.slice(0, 16);
                        const masked = val.match(/.{1,4}/g)?.join('.') || val;
                        setCardData({...cardData, number: masked});
                      }}
                      placeholder="0000.0000.0000.0000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required={paymentMethod === 'credit_card'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome Impresso no Cartão *</label>
                    <input 
                      type="text" 
                      value={cardData.name}
                      onChange={e => setCardData({...cardData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase"
                      required={paymentMethod === 'credit_card'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Validade *</label>
                      <input 
                        type="text" 
                        value={cardData.expiry}
                        onChange={e => {
                          let val = e.target.value.replace(/\D/g, '');
                          if (val.length > 4) val = val.slice(0, 4);
                          if (val.length > 2) {
                            val = val.slice(0, 2) + '/' + val.slice(2);
                          }
                          setCardData({...cardData, expiry: val});
                        }}
                        placeholder="MM/AA"
                        maxLength={5}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required={paymentMethod === 'credit_card'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">CVV *</label>
                      <input 
                        type="text" 
                        value={cardData.cvv}
                        onChange={e => setCardData({...cardData, cvv: e.target.value})}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required={paymentMethod === 'credit_card'}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Parcelamento</label>
                    <select 
                      value={cardData.installments}
                      onChange={e => setCardData({...cardData, installments: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      {(() => {
                        // Calcula o menor valor mínimo de parcela entre os produtos no carrinho
                        const minInstallmentValue = cart.reduce((min, item) => {
                          const productMin = item.product.min_installment_value || 50;
                          return productMin < min ? productMin : min;
                        }, 50);

                        const maxInstallments = 10;
                        let possibleInstallments = Math.floor(finalTotal / minInstallmentValue);
                        if (possibleInstallments > maxInstallments) possibleInstallments = maxInstallments;
                        if (possibleInstallments < 1) possibleInstallments = 1;

                        const options = [];
                        for (let i = 1; i <= possibleInstallments; i++) {
                          options.push(
                            <option key={i} value={i.toString()}>
                              {i}x de R$ {(finalTotal / i).toFixed(2)} sem juros
                            </option>
                          );
                        }
                        return options;
                      })()}
                    </select>
                  </div>
                </motion.div>
              )}

              {paymentMethod === 'pix' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-center"
                >
                  <QrCode size={48} className="mx-auto text-emerald-600 mb-4" />
                  <h3 className="font-bold text-emerald-800 mb-2">Pagamento Rápido e Seguro</h3>
                  <p className="text-sm text-emerald-600 mb-4">O código PIX será gerado na próxima etapa. A aprovação é imediata!</p>
                  <div className="inline-block bg-emerald-200 text-emerald-800 px-4 py-2 rounded-full text-sm font-bold">
                    Desconto de 5% aplicado: R$ {(finalTotal * 0.05).toFixed(2)}
                  </div>
                </motion.div>
              )}

              {paymentMethod === 'boleto' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-amber-50 p-6 rounded-2xl border border-amber-100 text-center"
                >
                  <Barcode size={48} className="mx-auto text-amber-600 mb-4" />
                  <h3 className="font-bold text-amber-800 mb-2">Boleto Bancário</h3>
                  <p className="text-sm text-amber-600 mb-4">O boleto será gerado na próxima etapa. A aprovação pode levar até 3 dias úteis.</p>
                  <div className="inline-block bg-amber-200 text-amber-800 px-4 py-2 rounded-full text-sm font-bold">
                    Vencimento em 3 dias
                  </div>
                </motion.div>
              )}

              {paymentMethod === 'transfer' && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left"
                >
                  <Landmark size={48} className="mx-auto text-blue-600 mb-4" />
                  <h3 className="font-bold text-blue-800 mb-2 text-center">Dados para Transferência</h3>
                  {settings?.payment_methods?.find((m: any) => m.type === 'bank') ? (
                    <div className="text-sm text-blue-700 bg-white p-4 rounded-xl border border-blue-200 whitespace-pre-line">
                      {settings.payment_methods.find((m: any) => m.type === 'bank').details || 'Dados bancários não configurados.'}
                    </div>
                  ) : (
                    <p className="text-sm text-blue-600 text-center">Dados bancários não configurados.</p>
                  )}
                  <div className="mt-4 text-center">
                    <div className="inline-block bg-blue-200 text-blue-800 px-4 py-2 rounded-full text-sm font-bold">
                      Aprovação em até 24h
                    </div>
                  </div>
                </motion.div>
              )}
            </section>
          </div>

          {/* Coluna Direita: Resumo */}
          <div className="lg:col-span-1 space-y-6">
            {/* Box de Teste */}
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <AlertCircle size={18} />
                Modo de Teste Ativo
              </div>
              <p className="text-xs text-amber-700 mb-4">
                Use os dados abaixo para simular uma compra aprovada:
              </p>
              <div className="space-y-2 font-mono text-[10px] text-amber-900 bg-white/50 p-3 rounded-xl border border-amber-100">
                <p><strong>Cartão:</strong> 4444 4444 4444 4444</p>
                <p><strong>Validade:</strong> 12/29</p>
                <p><strong>CVV:</strong> 123</p>
                <p><strong>Nome:</strong> TESTE APROVADO</p>
                {gateways.find(g => g.active)?.config?.public_key && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <p className="break-all"><strong>Public Key:</strong> {gateways.find(g => g.active)?.config?.public_key}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 sticky top-28">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Resumo do Pedido</h2>
              
              <div className="space-y-4 mb-6 max-h-[300px] overflow-y-auto pr-2">
                {cart.map((item) => (
                  <div key={item.product.id} className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-50 rounded-xl overflow-hidden flex-shrink-0 border border-slate-100">
                      {item.product.image_url && (
                        <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 line-clamp-2">{item.product.name}</h4>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-slate-500">Qtd: {item.quantity}</span>
                        <span className="text-sm font-black text-indigo-600">
                          R$ {calculatePrice(item.product, item.quantity).total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cupom de Desconto */}
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Possui um cupom?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="DIGITE O CÓDIGO"
                    className="flex-1 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  />
                </div>
                {couponCode && appliedDiscounts.some(d => campaigns.some(c => c.title === d.name && c.trigger_type === 'coupon')) && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Cupom aplicado com sucesso!
                  </p>
                )}
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100 mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1"><Truck size={16} /> Frete</span>
                  <span className="font-medium">{shippingCost === 0 ? <span className="text-emerald-500 font-bold uppercase text-xs">Grátis</span> : `R$ ${shippingCost.toFixed(2)}`}</span>
                </div>
                {appliedDiscounts.map((discount, idx) => (
                  <div key={idx} className="flex justify-between text-emerald-600 font-medium">
                    <span>{discount.name}</span>
                    <span>- R$ {discount.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-end pt-6 border-t border-slate-100 mb-8">
                <span className="text-slate-900 font-bold">Total</span>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">
                    R$ {finalTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  'Processando...'
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    Finalizar Pedido
                  </>
                )}
              </button>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                <ShieldCheck size={14} />
                Ambiente 100% Seguro
              </div>
            </div>
          </div>

        </form>
      </div>
    </div>
  );
}
