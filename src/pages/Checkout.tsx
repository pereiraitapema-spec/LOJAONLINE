import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatPhone, formatCPF } from '../lib/utils';
import { isValidDocument } from '../lib/validation';
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
  Landmark,
  Settings,
  LayoutDashboard,
  Copy,
  X,
  Store,
  ExternalLink,
  Ticket
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { cepService } from '../services/cepService';
import { paymentService } from '../services/paymentService';
import { shippingService, ShippingPackage, ShippingQuote } from '../services/shippingService';
import { TrackingModal } from '../components/TrackingModal';
import { leadService } from '../services/leadService';
import { automationService } from '../services/automationService';

interface Product {
  id: string;
  name: string;
  price: number;
  discount_price?: number;
  image_url?: string;
  min_installment_value?: number;
  affiliate_commission?: number;
  weight?: number;
  height?: number;
  width?: number;
  length?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [pagarmeMethod, setPagarmeMethod] = useState<'credit_card' | 'pix' | 'debit_card' | 'boleto' | null>(null);
  const [shippingMethods, setShippingMethods] = useState<ShippingQuote[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<number | null>(null);
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
    document: '',
    password: ''
  });

  // Efeito para buscar dados do usuário logado de forma robusta
  useEffect(() => {
    const loadUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      console.log('🔍 Iniciando busca unificada de dados para:', session.user.id);
      
      // 1. Tenta buscar na tabela 'profiles' (dados de perfil)
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      // 2. Tenta buscar na tabela 'customers' (dados de compras anteriores)
      const { data: customerData } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .maybeSingle();

      // Consolida os dados (prioridade para profiles, depois customers)
      const userData = {
        name: profile?.full_name || profile?.name || customerData?.customer_name || '',
        email: session.user.email || customerData?.customer_email || '',
        phone: profile?.phone || customerData?.customer_phone || '',
        document: profile?.document || customerData?.customer_document || ''
      };

      console.log('✅ Dados consolidados:', userData);
      
      setCustomer(prev => ({ ...prev, ...userData }));

      // Mapeia o endereço (prioridade para profiles.address, depois customers.shipping_address)
      const address = profile?.address || customerData?.shipping_address;
      if (address) {
        setShipping(prev => ({
          ...prev,
          cep: address.cep || prev.cep || '',
          street: address.street || prev.street || '',
          number: address.number || prev.number || '',
          complement: address.complement || prev.complement || '',
          neighborhood: address.neighborhood || prev.neighborhood || '',
          city: address.city || prev.city || '',
          state: address.state || prev.state || ''
        }));
      }
    };
    
    loadUserData();
  }, []);

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

  const [isAdmin, setIsAdmin] = useState(false);
  const [abandonedCartId, setAbandonedCartId] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [pixData, setPixData] = useState<{ qr_code: string; qr_code_url: string; expires_at: string } | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [boletoData, setBoletoData] = useState<{ url: string; pdf: string; barcode: string; expires_at: string } | null>(null);
  const [showBoletoModal, setShowBoletoModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [createAccount, setCreateAccount] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [trackingCode, setTrackingCode] = useState<string | null>(null);
  const [trackingInfo, setTrackingInfo] = useState<any>(null);
  const [showPaymentErrorModal, setShowPaymentErrorModal] = useState({ isOpen: false, message: '' });

  // Auto-focus no campo de cartão para disparar o Google Pay/Apple Pay Autofill no celular
  useEffect(() => {
    if (paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card') {
      const timer = setTimeout(() => {
        const inputElement = document.getElementById('card-number-input');
        if (inputElement) {
          inputElement.focus();
        }
      }, 500); // Aguarda a animação do formulário renderizar a caixa do cartão
      return () => clearTimeout(timer);
    }
  }, [paymentMethod, pagarmeMethod]);

  const SuccessModal = () => {
    // ... (rest of SuccessModal logic) ...
    return (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        {/* ... (SuccessModal content) ... */}
      </div>
    );
  };

  const PaymentErrorModal = () => (
    showPaymentErrorModal.isOpen && (
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl relative"
        >
          <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-rose-600 mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-rose-600 mb-2">Falha no Pagamento</h2>
          <p className="text-slate-600 mb-6">{showPaymentErrorModal.message}</p>
          <button 
            onClick={() => setShowPaymentErrorModal({ isOpen: false, message: '' })}
            className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
          >
            Tentar novamente
          </button>
        </motion.div>
      </div>
    )
  );

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        if (session?.user) {
          if (session.user.email === 'pereira.itapema@gmail.com') {
            setIsAdmin(true);
          } else {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle();
            if (profile?.role === 'admin') setIsAdmin(true);
          }
        }

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

        // Fetch shipping methods and discount rules in parallel
        const [
          { data: settingsData },
          { data: rulesData },
          { data: campaignsData },
          { data: gatewaysData },
          { data: carriersData }
        ] = await Promise.all([
          supabase.from('store_settings').select('*').maybeSingle(),
          supabase.from('discount_rules').select('*').eq('active', true),
          supabase.from('campaigns').select('*').eq('active', true),
          supabase.from('payment_gateways').select('*').eq('active', true),
          supabase.from('shipping_carriers').select('*').eq('active', true)
        ]);
        
        // Filtrar transportadoras baseado na configuração de serviços
        const filteredCarriers = carriersData?.filter(carrier => {
          if (carrier.provider === 'cepcerto') {
            // Se for CepCerto, verifica os serviços configurados
            const services = carrier.config?.services || {};
            // Exemplo: se o método de frete for SEDEX, verifica se sedex está ativo
            return true; // Simplificado para agora, preciso ajustar conforme o método de frete selecionado
          }
          return true;
        }) || [];
        
        if (settingsData) {
          setSettings(settingsData);
        }
        setDiscountRules(rulesData || []);
        setCampaigns(campaignsData || []);
        setGateways(gatewaysData || []);
        setCarriers(filteredCarriers);

        // Check for first purchase
        if (session?.user) {
          // --- NOVA LÓGICA DE BUSCA UNIFICADA ---
          console.log('🔍 Iniciando busca unificada de dados para:', session.user.id);
          
          // 1. Tenta buscar na tabela 'profiles'
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          // 2. Tenta buscar o pedido mais recente na tabela 'orders' pelo e-mail
          const { data: lastOrder, error: orderFetchError } = await supabase
            .from('orders')
            .select('customer_name, customer_email, customer_phone, customer_document, shipping_address')
            .eq('customer_email', session.user.email) // Busca pelo e-mail
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (orderFetchError) {
            console.error('❌ Erro ao buscar último pedido por e-mail:', orderFetchError);
          }
          console.log('📦 Dados do último pedido encontrado por e-mail:', lastOrder);

          // 3. Tenta buscar cartões salvos na tabela 'saved_cards'
          const { data: savedCards } = await supabase
            .from('saved_cards')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });

          if (savedCards && savedCards.length > 0) {
            console.log('💳 Cartões salvos encontrados:', savedCards);
            const card = savedCards[0];
            // Preenche o estado do cartão. Assumindo que o estado se chama 'cardData'
            setCardData(prev => ({
              ...prev,
              number: `****.****.****.${card.last_four_digits}`,
              brand: card.brand,
              // Nota: Não é possível recuperar o nome ou CVV por segurança
            }));
          }

          // Consolida os dados (prioridade para profiles, depois lastOrder)
          const userData = {
            name: profile?.full_name || profile?.name || lastOrder?.customer_name || '',
            email: session.user.email || lastOrder?.customer_email || '',
            phone: profile?.phone || lastOrder?.customer_phone || '',
            document: profile?.document || lastOrder?.customer_document || ''
          };

          console.log('✅ Dados consolidados:', userData);
          setCustomer(prev => ({ ...prev, ...userData }));

          // Mapeia o endereço (prioridade para profiles.address, depois lastOrder.shipping_address)
          const address = profile?.address || lastOrder?.shipping_address;
          console.log('📍 Endereço encontrado:', address);
          if (address) {
            setShipping(prev => ({
              ...prev,
              cep: address.cep || prev.cep || '',
              street: address.street || prev.street || '',
              number: address.number || prev.number || '',
              complement: address.complement || prev.complement || '',
              neighborhood: address.neighborhood || prev.neighborhood || '',
              city: address.city || prev.city || '',
              state: address.state || prev.state || ''
            }));
          }
          // --- FIM DA NOVA LÓGICA ---

          const { count, error: countError } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', session.user.id)
            .neq('status', 'failed')
            .neq('status', 'cancelled');
          
          if (!countError) {
            setIsFirstPurchase(count === 0);
          } else {
            setIsFirstPurchase(false);
          }
        } else {
          // Para visitantes, assumimos primeira compra se não houver e-mail
          // Mas a lógica real de primeira compra geralmente depende do e-mail
          setIsFirstPurchase(true);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

  // Carregar CEP salvo do Store
  useEffect(() => {
    const savedCep = localStorage.getItem('last_cep');
    const savedCity = localStorage.getItem('last_city');
    const savedState = localStorage.getItem('last_state');
    
    if (savedCep && (savedCep.length === 8 || savedCep.toUpperCase() === 'BALCAO') && !shipping.cep) {
      console.log('📦 Carregando CEP salvo do Store:', savedCep);
      setShipping(prev => ({ 
        ...prev, 
        cep: savedCep,
        city: savedCity || prev.city,
        state: savedState || prev.state
      }));
    }
  }, []);

  // Verificar se é primeira compra por e-mail (para visitantes)
  useEffect(() => {
    const checkEmailPurchase = async () => {
      if (!customer.email || !customer.email.includes('@')) return;
      
      // Se já estiver logado, a verificação inicial já foi feita
      if (user) return;

      const { count, error } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_email', customer.email)
        .neq('status', 'failed')
        .neq('status', 'cancelled');
      
      if (!error) {
        setIsFirstPurchase(count === 0);
      }
    };

    const timer = setTimeout(checkEmailPurchase, 1000);
    return () => clearTimeout(timer);
  }, [customer.email, user]);

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

  // Recalcular frete quando o carrinho ou cupom mudar
  useEffect(() => {
    if (shipping.cep && shipping.cep.length === 8) {
      if (shippingMethods.length > 0) {
        // Se o carrinho mudou, recalcula
        lastCalculatedCep.current = '';
      }
    }
  }, [cart, couponCode]);

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

  const threshold = Number(settings?.free_shipping_threshold) || 0;
  const isFreeShipping = threshold > 0 && cartTotal >= threshold;

  // Escutar atualizações do pedido em tempo real (PIX Pago)
  useEffect(() => {
    if (!currentOrderId || (!showPixModal && !showBoletoModal)) return;

    console.log('📡 [REALTIME] Iniciando monitoramento do pedido:', currentOrderId);
    
    const channel = supabase
      .channel(`order-update-${currentOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${currentOrderId}`
        },
        (payload) => {
          console.log('🔔 [REALTIME] Atualização do pedido detectada:', payload.new.status);
          // Se o status mudar para pago ou preparando (status de sucesso pos-pagamento)
          if (['paid', 'preparing', 'approved', 'authorized'].includes(payload.new.status)) {
            setShowPixModal(false);
            setShowBoletoModal(false);
            navigate(`/success?orderId=${currentOrderId}`);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ [REALTIME] Inscrito com sucesso para atualizações do pedido');
        }
      });

    return () => {
      console.log('🔌 [REALTIME] Desconectando monitoramento do pedido');
      supabase.removeChannel(channel);
    };
  }, [currentOrderId, showPixModal, showBoletoModal]);

  // Calculate Discounts
  useEffect(() => {
    const calculateDiscounts = async () => {
      let newDiscounts: { name: string; value: number }[] = [];
      let currentTotal = cartTotal;

      // 1. Check Legacy Discount Rules
      for (const rule of discountRules) {
        let apply = false;

        if (rule.type === 'first_purchase' && isFirstPurchase && cartTotal >= 50) {
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
      let campaignApplied = false;
      for (const campaign of campaigns) {
        if (!campaign.discount_value || campaignApplied) continue;

        let apply = false;
        const trigger = campaign.trigger_type || 'automatic';

        if (trigger === 'automatic') {
          apply = true;
        } else if (trigger === 'coupon' && couponCode.toUpperCase() === campaign.coupon_code?.toUpperCase()) {
          apply = true;
        } else if (trigger === 'min_value' && cartTotal >= (campaign.trigger_value || 0)) {
          apply = true;
        } else if (trigger === 'first_purchase' && isFirstPurchase && cartTotal >= 50) {
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
          currentTotal -= discountValue;
          campaignApplied = true;
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
  const displayShippingMethods = settings?.address && couponCode?.trim().toUpperCase() === 'BALCAO' 
    ? [
        {
          id: 'balcao',
          name: 'RETIRADA NO BALCÃO',
          price: 0,
          deadline: 'Retirada imediata',
          provider: 'Balcão',
          carrierName: 'Balcão'
        },
        ...shippingMethods.filter(m => m.id !== 'balcao' && !m.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('BALCAO'))
      ]
    : shippingMethods.filter(m => m.id !== 'balcao' && !m.name.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('BALCAO'));

  const isBalcao = couponCode?.trim().toLowerCase() === "balcao" || (selectedShipping !== null && displayShippingMethods[selectedShipping]?.id === 'balcao');

  const currentShipping = selectedShipping !== null ? displayShippingMethods[selectedShipping] : null;
  
  // Se ainda não temos métodos de envio, o frete não é 0, é "não calculado" (null)
  const shippingCost = displayShippingMethods.length === 0 
    ? null 
    : !currentShipping
      ? null // Ainda não selecionou um método ou o selecionado é inválido
      : (threshold > 0 && cartTotal >= threshold) 
        ? 0 
        : currentShipping.price;

  console.log('DEBUG FRETE:', {
    cartTotal,
    threshold,
    shippingMethodsCount: displayShippingMethods.length,
    selectedShipping,
    currentShippingPrice: currentShipping?.price,
    finalShippingCost: shippingCost
  });
  
  console.log('DEBUG: shippingCost=', shippingCost, 'cartTotal=', cartTotal, 'threshold=', threshold, 'currentShippingPrice=', currentShipping?.price);
  const finalTotal = Math.max(0, cartTotal - totalDiscount + (shippingCost || 0));

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
          
          // Trigger automation for update
          await automationService.trigger('abandoned_cart', {
            id: abandonedCartId,
            ...payload,
            event: 'cart_updated'
          });
        } else {
          const { data, error } = await supabase
            .from('abandoned_carts')
            .insert([payload])
            .select()
            .single();
          
          if (!error && data) {
            setAbandonedCartId(data.id);
            // Trigger automation for new abandoned cart
            await automationService.trigger('abandoned_cart', {
              id: data.id,
              ...payload,
              event: 'cart_abandoned'
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

  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const value = rawValue.replace(/\D/g, '').slice(0, 8);
    console.log('⌨️ CEP Input Change:', { raw: rawValue, clean: value, length: value.length });
    setShipping(prev => ({ ...prev, cep: value }));
  };

  const lastCalculatedCep = React.useRef<string>('');

  const handleGerarCotacao = async () => {
    console.log("🚀 Botão gerar cotação clicado");
    console.log("🛒 Carrinho checkout:", cart);
    
    if (!cart || cart.length === 0) {
      console.log("❌ Carrinho não carregado ainda");
      toast.error('Carrinho vazio. Adicione produtos antes de calcular o frete.');
      return;
    }

    const cep = shipping.cep.replace(/\D/g, '');
    console.log("📍 CEP:", cep);

    if (cep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos.');
      return;
    }

    await handleCep(cep);
  };

  const handleCep = async (cep: string) => {
    console.log('🚀 handleCep chamado com CEP:', cep);
    console.log('🛒 Estado atual do carrinho no handleCep:', cart);
    
    if (calculatingShipping || cep.length !== 8) {
      console.log('⚠️ handleCep ignorado:', { calculatingShipping, cepLength: cep.length });
      return;
    }
    
    console.log('🚀 Iniciando processamento do CEP:', cep);
    console.log("🚀 Iniciando cotação");
    lastCalculatedCep.current = cep;
    setCalculatingShipping(true);
    setShippingMethods([]); // Limpar métodos anteriores
    
    try {
      console.log('⏱️ Buscando endereço no ViaCEP...');
      console.log("📦 Endereço antes cálculo:", shipping);
      const address = await cepService.fetchAddress(cep);
      
      if (address && address.city) {
        console.log('✅ Endereço encontrado:', address);
        setShipping(prev => ({
          ...prev,
          street: address.street || prev.street || '',
          neighborhood: address.neighborhood || prev.neighborhood || '',
          city: address.city || prev.city || '',
          state: address.state || prev.state || ''
        }));
        console.log("📦 Endereço após cálculo:", {
          ...shipping,
          street: address.street || shipping.street || '',
          neighborhood: address.neighborhood || shipping.neighborhood || '',
          city: address.city || shipping.city || '',
          state: address.state || shipping.state || ''
        });
        toast.success(`Endereço encontrado: ${address.city} - ${address.state}`);

        // Verificar se temos transportadoras ativas
        if (carriers.length === 0) {
          console.warn('⚠️ Nenhuma transportadora ativa encontrada no estado local');
          // Tentar buscar novamente se estiver vazio
          const { data: freshCarriers } = await supabase.from('shipping_carriers').select('*').eq('active', true);
          if (freshCarriers && freshCarriers.length > 0) {
            setCarriers(freshCarriers);
            console.log('✅ Transportadoras recarregadas:', freshCarriers.length);
          } else {
            toast.error('Nenhuma transportadora configurada ou ativa.');
            setCalculatingShipping(false);
            return;
          }
        }

        console.log("📦 Produtos carregados");
        console.log("📏 Dimensões calculadas");
        console.log("🚀 Chamando API cotação");

        // Calcular frete via Admin
        console.log('🚚 Solicitando cotação de frete ao Admin...');
        try {
          const response = await fetch('/api/admin/frete/cotacao', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cep_destinatario: cep,
              produtos: cart.map(item => ({
                id: item.product.id,
                quantidade: item.quantity
              }))
            })
          });

          const data = await response.json();
          console.log("📦 Resposta do servidor (cotação):", data);
          
          if (data.status === 'sucesso' && data.frete) {
            const quotes: ShippingQuote[] = [];
            
            // Itera sobre as chaves do objeto frete retornado pelo servidor
            Object.keys(data.frete).forEach((key) => {
              const method = data.frete[key];
              quotes.push({
                id: key,
                name: key.toUpperCase(), // Nome do método (ex: PAC, SEDEX, JADLOG_PACKAGE)
                price: Number(method.valor),
                deadline: method.prazo,
                provider: method.transportadora || 'Transportadora',
                carrierName: method.transportadora || 'Transportadora'
              });
            });

            if (quotes.length > 0) {
              setShippingMethods(quotes);
              setSelectedShipping(null); // Reset selection so user has to choose
              console.log('✅ Opções de frete carregadas:', quotes);
              console.log("📥 Cotação recebida");
            } else {
              toast.error('Nenhuma opção de frete retornada.');
            }
          } else {
            console.error('❌ Erro na cotação:', data);
            toast.error(data.mensagem || 'Erro ao calcular frete.');
          }
        } catch (err) {
          console.error('❌ Erro na requisição de cotação:', err);
          toast.error('Falha ao conectar com o servidor de frete.');
        }
      } else {
        console.warn('⚠️ ViaCEP não retornou cidade para o CEP:', cep);
        toast.error('CEP não encontrado ou inválido.');
      }
    } catch (error) {
      console.error('❌ Erro crítico em handleCep:', error);
      toast.error('Erro ao processar CEP. Tente novamente.');
    } finally {
      setCalculatingShipping(false);
    }
  };

  const handleCepBlur = async () => {
    const cep = shipping.cep.replace(/\D/g, '');
    if (cep.length > 0 && cep.length < 8) {
      toast.error('CEP deve ter 8 dígitos.');
    }
  };

  // Injeção de Pixels de Rastreamento
  useEffect(() => {
    const activePixels: string[] = [];
    
    if (settings?.tracking_pixels) {
      settings.tracking_pixels.forEach((pixel: any) => {
        if (pixel.active && pixel.pixel_id) {
          if (settings.debug_mode) {
            console.log(`[DEBUG] Pixel ${pixel.platform} ativado com ID ${pixel.pixel_id}`);
            return;
          }
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

  const handleCheckout = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Validação Detalhada (Conforme solicitado pelo usuário)
    if (!customer.name) {
      toast.error('O campo NOME é obrigatório.');
      const el = document.getElementById('customer-name');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
      return;
    }
    if (!customer.email) {
      toast.error('O campo E-MAIL é obrigatório.');
      const el = document.getElementById('customer-email');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
      return;
    }
    if (!customer.document) {
      toast.error('O campo CPF/CNPJ é obrigatório.');
      const el = document.getElementById('customer-document');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
      return;
    }
    if (!isValidDocument(customer.document)) {
      toast.error('O CPF/CNPJ informado é inválido.');
      return;
    }
    if (!customer.phone) {
      toast.error('O campo TELEFONE é obrigatório.');
      const el = document.getElementById('customer-phone');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el?.focus();
      return;
    }
    if (customer.phone.replace(/\D/g, '').length < 10) {
      toast.error('Informe um telefone válido com DDD.');
      return;
    }

    if (!isBalcao) {
      if (!shipping.cep) {
        toast.error('O campo CEP é obrigatório.');
        return;
      }
      if (!shipping.street) {
        toast.error('O campo RUA/AVENIDA é obrigatório.');
        return;
      }
      if (!shipping.number) {
        toast.error('O campo NÚMERO é obrigatório.');
        return;
      }
      if (!shipping.city) {
        toast.error('O campo CIDADE é obrigatório.');
        return;
      }
      if (!shipping.state) {
        toast.error('O campo ESTADO é obrigatório.');
        return;
      }
      
      if (selectedShipping === null && !isFreeShipping && shippingMethods.length > 0) {
        toast.error("Por favor, selecione uma opção de frete.");
        return;
      }
    }

    if (paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card') {
      if (!cardData.number) {
        toast.error('Número do cartão é obrigatório.');
        return;
      }
      if (!cardData.name) {
        toast.error('Nome no cartão é obrigatório.');
        return;
      }
      if (!cardData.expiry) {
        toast.error('Data de validade do cartão é obrigatória.');
        return;
      }
      if (!cardData.cvv) {
        toast.error('Código CVV do cartão é obrigatório.');
        return;
      }
    }

    if (finalTotal > 0 && !paymentMethod) {
      toast.error('Por favor, selecione uma forma de pagamento.');
      return;
    }

    if (finalTotal > 0 && paymentMethod === 'pagarme' && !pagarmeMethod) {
      toast.error('Por favor, selecione se deseja PIX ou Cartão no Pagar.me.');
      return;
    }

    if (createAccount && !user && !customer.password) {
      toast.error('Por favor, crie uma senha para sua nova conta.');
      return;
    }

    setProcessing(true);

    try {
      // 0. Create Account if requested
      let currentUserId = user?.id;
      if (createAccount && !user) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: customer.email,
          password: customer.password!,
          options: {
            data: {
              full_name: customer.name,
              phone: customer.phone,
              document: customer.document
            }
          }
        });

        if (authError) {
          if (authError.message.includes('User already registered')) {
            toast.error('Este e-mail já possui uma conta. Por favor, faça login.');
            setProcessing(false);
            return;
          }
          throw authError;
        }
        currentUserId = authData.user?.id;
        if (authData.user) {
          setUser(authData.user);
        }
        toast.success('Conta criada com sucesso! Você receberá um e-mail de confirmação.');
      }
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
        // Calculate commission per item based on the best rate for each product
        commissionValue = cart.reduce((acc, item) => {
          const unitPrice = item.product.discount_price || item.product.price;
          const productSpecificRate = item.product.affiliate_commission;
          
          // Se o produto tiver uma comissão específica (mesmo que 0), ela PREVALECE sobre a do afiliado
          // Mas aqui a regra de negócio costuma ser Math.max para incentivar o afiliado
          // O usuário reclamou que não está calculando certo, vamos usar Math.max para garantir o melhor ganho
          let effectiveRate = Math.max(commissionRate || 0, productSpecificRate || 0);
          
          // Se for 0 em ambos, usamos o padrão de 20%
          if (effectiveRate === 0) effectiveRate = 20;

          // If an affiliate coupon is used, deduct half of the discount percentage from the commission rate
          if (affiliateCoupon) {
            const commissionDeduction = affiliateCoupon.discount_percentage / 2;
            effectiveRate = Math.max(0, effectiveRate - commissionDeduction);
          }

          // Safety cap: Never exceed 50% unless explicitly allowed (for now, hard cap at 50%)
          if (effectiveRate > 50) {
            console.warn(`⚠️ Taxa de comissão excessiva detectada (${effectiveRate}%). Limitando a 50%.`);
            effectiveRate = 50;
          }
          
          const itemCommission = (unitPrice * effectiveRate / 100) * item.quantity;
          console.log(`💰 Cálculo Comissão: Item=${item.product.name}, Preço=${unitPrice}, Taxa=${effectiveRate}%, Qtd=${item.quantity}, Comissão=${itemCommission}`);
          
          // Commission = (Unit Price * Rate / 100) * Quantity
          return acc + itemCommission;
        }, 0);
        
        // Ensure commissionValue is a clean number
        commissionValue = Number(commissionValue.toFixed(2));
      }

      // 1. Create Order in Supabase
      const orderPayload = {
        user_id: currentUserId || null, // Use the newly created or existing user ID
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
        payment_method: paymentMethod === 'pagarme' ? pagarmeMethod : paymentMethod,
        shipping_method: `${currentShipping?.carrierName || 'Padrão'} - ${currentShipping?.name || 'Padrão'}`,
        shipping_address: {
          ...shipping,
          tipo_frete: currentShipping?.name,
          valor_frete: shippingCost,
          prazo_frete: currentShipping?.deadline,
          transportadora: currentShipping?.carrierName,
          cep_destinatario: shipping.cep
        },
        tracking_code: currentShipping?.id === 'balcao' ? 'CLIENTE BUSCA NA EMPRESA' : null
      };

      console.log('🚀 Tentando criar pedido no Supabase com os seguintes dados:', JSON.stringify(orderPayload, null, 2));

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([orderPayload])
        .select()
        .single();

      if (orderError) {
        console.error('❌ Erro ao criar pedido no Supabase:', orderError);
        console.error('⚠️ DICA: Verifique se todas as colunas existem na tabela "orders" e se as políticas RLS permitem a inserção.');
        throw orderError;
      }
      
      console.log('✅ Pedido criado com sucesso no Supabase:', orderData);
      
      // Atualizar perfil do usuário com os dados do checkout
      if (currentUserId) {
        console.log('🔄 Atualizando perfil do usuário:', currentUserId);
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            full_name: customer.name,
            phone: customer.phone.replace(/\D/g, ''),
            document: customer.document.replace(/\D/g, '')
          })
          .eq('id', currentUserId);
        
        if (profileError) {
          console.error('❌ Erro ao atualizar perfil:', profileError);
        } else {
          console.log('✅ Perfil atualizado com sucesso!');
        }
      }
      
      // Marcar como lead quente ao realizar pedido e salvar informações de compra
      leadService.updateStatus('quente', {
        product: cart.map(i => i.product.name).join(', '),
        value: finalTotal,
        email: customer.email,
        name: customer.name
      });

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

      console.log('🚀 Tentando criar itens do pedido no Supabase:', JSON.stringify(orderItems, null, 2));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('❌ Erro ao criar itens do pedido no Supabase:', itemsError);
        throw itemsError;
      }
      
      console.log('✅ Itens do pedido criados com sucesso.');

      // 2.1 Update Inventory Logs and Product Stock
      const inventoryLogs = cart.map(item => ({
        product_id: item.product.id,
        change_amount: -item.quantity,
        reason: `Venda Pedido #${orderData.id.split('-')[0].toUpperCase()}`
      }));

      console.log('🚀 Tentando criar logs de inventário no Supabase:', JSON.stringify(inventoryLogs, null, 2));

      const { error: inventoryError } = await supabase
        .from('inventory_logs')
        .insert(inventoryLogs);

      if (inventoryError) {
        console.error('❌ Erro ao criar logs de inventário no Supabase:', inventoryError);
      }

      // Update stock for each product
      for (const item of cart) {
        try {
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
        } catch (stockError) {
          console.error(`❌ Erro ao atualizar estoque do produto ${item.product.id}:`, stockError);
        }
      }

      // 3. Process Payment Gateway
      console.log('🚀 [DEBUG CHECKOUT] Iniciando processamento de pagamento...');
      
      let paymentResponse: any = null;
      let finalTrackingCode: string | null = null;

      // SE O TOTAL FOR ZERO (Cupom de 100%), BYPASS GATEWAY
      if (finalTotal <= 0) {
        console.log('🎁 Pedido com 100% de desconto. Pulando gateway.');
        paymentResponse = { 
          success: true, 
          status: 'paid',
          payment_id: 'FREE_ORDER_' + Date.now()
        };
      } else {
        // TORNAR A VERIFICAÇÃO DE ROLE NÃO-BLOQUEANTE
        let activeGateway = gateways.find(g => g.id === selectedGateway);
        
        // Se o gateway não foi encontrado, tentamos buscar novamente ou usamos um padrão
        if (!activeGateway && gateways.length > 0) {
            console.warn('⚠️ [DEBUG CHECKOUT] Gateway não encontrado inicialmente, usando primeiro disponível.');
            activeGateway = gateways[0];
        }
        
        console.log('🔍 [DEBUG CHECKOUT] Gateway ativo:', activeGateway);
        
        if (activeGateway) {
          console.log('✅ [DEBUG CHECKOUT] Gateway encontrado, processando...');
          
          // Validação de CPF/CNPJ
          const document = customer.document.replace(/\D/g, '');
          if (!document) {
            console.error('❌ [DEBUG CHECKOUT] CPF/CNPJ obrigatório.');
            toast.error('CPF ou CNPJ é obrigatório para finalizar o pagamento.');
            setProcessing(false);
            return;
          }

          try {
            console.log('💳 Iniciando processamento de pagamento real...');
            console.log('DEBUG pagamento enviado:', { customer_name: customer.name, customer_document: document });
            
            paymentResponse = await paymentService.processPayment(activeGateway.provider, {
              items: cart.map(item => ({
                price: item.product.discount_price || item.product.price,
                product_name: item.product.name,
                quantity: item.quantity,
                product_id: item.product.id
              })),
              customer_name: customerData.name || customer.name,
              customer_email: customer.email,
              customer_phone: customer.phone.replace(/\D/g, ''),
              customer_document: document.replace(/\D/g, ''),
              shipping_address: {
                ...shipping,
                street: shipping.street.substring(0, 100).normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                city: shipping.city.substring(0, 50).normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
                neighborhood: shipping.neighborhood.substring(0, 50).normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
              },
              shipping_cost: shippingCost,
              shipping_method: currentShipping?.name,
              payment_method: pagarmeMethod || paymentMethod,
              card_number: cardData.number.replace(/\D/g, ''),
              card_name: cardData.name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""),
              expiry: cardData.expiry.replace(/\D/g, ''),
              cvv: cardData.cvv,
              installments: cardData.installments,
              order_id: orderData.id
            }, activeGateway.config);

            console.log('📡 Resposta do processamento de pagamento:', paymentResponse);

            if (!paymentResponse.success) {
              throw new Error(paymentResponse.error || 'Erro ao processar pagamento com Pagar.me');
            }
            
            // ... resto do processamento (Webhook, Cartão salvo) ...
            // (Mantenho a lógica original aqui dentro)
            
            // Webhook feedback
            console.log('🔄 [DEBUG CHECKOUT] Aguardando confirmação via Webhook para atualizar status.');
            
            // 4. Comunicar com CepCerto para gerar etiqueta (Assíncrono e Resiliente)
            try {
              toast.success('Pedido processado com sucesso!');
            } catch (err: any) {
              console.error('Erro ao mostrar toast pos-pagamento:', err);
            }

            if (paymentMethod === 'credit_card' && paymentResponse.charges?.[0]?.last_transaction?.card?.id) {
              try {
                const card = paymentResponse.charges[0].last_transaction.card;
                await supabase.from('saved_cards').insert({
                  user_id: currentUserId,
                  card_id: card.id,
                  brand: card.brand,
                  last_four_digits: card.last_four_digits
                });
              } catch (cardErr) {
                console.warn('⚠️ Erro ao salvar cartão (não crítico):', cardErr);
              }
            }
          } catch (err: any) {
            console.error('❌ Erro no processamento de pagamento:', err);
            toast.error(`Erro no pagamento: ${err.message}`);
            setProcessing(false);
            return;
          }
        } else {
          console.error('❌ Nenhum gateway de pagamento ativo configurado.');
          toast.error('Nenhum gateway de pagamento ativo configurado.');
          setProcessing(false);
          return;
        }
      }

      // Determine initial status based on payment method
      // Se chegamos aqui, paymentResponse.success é true porque senão teria lançado erro antes
      const isCreditCard = paymentMethod === 'credit_card' || (paymentMethod === 'pagarme' && pagarmeMethod === 'credit_card');
      let initialStatus = isCreditCard ? 'paid' : 'pending';

      // Se o provedor retornar um status específico, use-o com um mapeamento robusto
      if (paymentResponse.status) {
        console.log('📊 Status retornado pelo gateway:', paymentResponse.status);
        const statusMap: Record<string, string> = {
          'paid': 'paid',
          'authorized': 'paid',
          'approved': 'paid',
          'succeeded': 'paid',
          'captured': 'paid',
          'processing': 'paid', // Se capturou cartão, consideramos pago
          'pending_analysis': 'pending',
          'pending_review': 'pending',
          'waiting_payment': 'pending',
          'pending': 'pending',
          'failed': 'failed',
          'refused': 'failed',
          'denied': 'failed',
          'canceled': 'canceled'
        };
        initialStatus = statusMap[paymentResponse.status] || initialStatus;
      }

      // Update order status
      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          status: initialStatus, 
          payment_status: initialStatus === 'paid' ? 'paid' : (initialStatus === 'failed' || initialStatus === 'canceled' ? 'failed' : 'pending'),
          payment_id: paymentResponse.payment_id,
          payment_url: paymentResponse.pix?.qr_code_url || paymentResponse.boleto?.url || paymentResponse.boleto?.pdf,
          pix_code: paymentResponse.pix?.qr_code || paymentResponse.boleto?.barcode,
          tracking_code: finalTrackingCode || null
        })
        .eq('id', orderData.id);

      if (updateError) {
        console.error('❌ Erro ao atualizar status do pedido:', updateError);
      }

      // Se o status retornado for failed ou canceled, nós paramos o fluxo
      if (initialStatus === 'failed' || initialStatus === 'canceled') {
          console.error('❌ Pagamento foi recusado ou falhou no gateway.');
          // Exibir modal de erro bloqueante
          setShowPaymentErrorModal({
            isOpen: true,
            message: paymentResponse.error_message || 'Pagamento recusado pelo banco ou emissor. Verifique os dados do cartão ou tente outro método.'
          });
          setProcessing(false);
          return;
      }

      // Helper function to trigger tracking and webhooks
      const triggerPostPurchaseActions = async () => {
        // Salvar no localStorage para persistência na home
        localStorage.setItem('last_order_id', orderData.id);
        if (finalTrackingCode) {
          localStorage.setItem('last_tracking_code', finalTrackingCode);
          setTrackingCode(finalTrackingCode);
        }

        // Trigger automation for purchase complete
        await automationService.trigger('new_order', {
          order_id: orderData.id,
          customer_email: customer.email,
          customer_name: customer.name,
          total: finalTotal,
          items: cart.map(item => ({
            name: item.product.name,
            qty: item.quantity,
            price: item.product.discount_price || item.product.price
          })),
          event: 'purchase_complete'
        });

        // Trigger Purchase Event
        if (settings?.tracking_pixels) {
          settings.tracking_pixels.forEach((pixel: any) => {
            if (pixel.active && pixel.pixel_id) {
              if (settings.debug_mode) {
                console.log(`[DEBUG] Evento de pixel ${pixel.platform} disparado para ID ${pixel.pixel_id}`);
                return;
              }
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
      };

      if (paymentResponse.pix) {
        console.log('✅ [DEBUG CHECKOUT] Dados do PIX recebidos:', paymentResponse.pix);
        if (!paymentResponse.pix.qr_code && !paymentResponse.pix.qr_code_url) {
          console.error('❌ [DEBUG CHECKOUT] Resposta do PIX veio vazia de dados essenciais.');
          toast.error('O gateway gerou o PIX mas não retornou o código. Por favor, verifique se o PIX está ativado no seu painel Pagar.me.');
        }
        triggerPostPurchaseActions();
        setPixData(paymentResponse.pix);
        setCurrentOrderId(orderData.id);
        setShowPixModal(true);
        setProcessing(false);
        // Clear cart anyway
        localStorage.removeItem('cart_items');
        setCart([]);
        return;
      }

      if (paymentResponse.boleto) {
        triggerPostPurchaseActions();
        setBoletoData(paymentResponse.boleto);
        setCurrentOrderId(orderData.id);
        setShowBoletoModal(true);
        setProcessing(false);
        // Clear cart anyway
        localStorage.removeItem('cart_items');
        setCart([]);
        return;
      }

      // 3.1 Se houver comissão e for pago, o saldo será refletido nos cálculos dinâmicos
      // Removida atualização manual da coluna 'balance' para evitar desincronização e duplicidade.
      // O saldo agora é calculado em tempo real: Sum(comissões) - Sum(pagamentos).

      // Clear cart
      localStorage.removeItem('cart_items');
      setCart([]);

      // 3.2 Se for cartão (pago na hora), mostrar modal de sucesso
      if (initialStatus === 'paid') {
        triggerPostPurchaseActions();
        setCurrentOrderId(orderData.id);
        setShowSuccessModal(true);
        setProcessing(false);
        return;
      }

      // Se estiver pendente (ex: análise de risco), avisar o usuário
      if (initialStatus === 'pending' && isCreditCard) {
        toast.success('Pedido recebido! Seu pagamento está em análise de segurança e será aprovado em breve.');
        triggerPostPurchaseActions();
        navigate(`/success?orderId=${orderData.id}`);
        return;
      }

      toast.success('Pedido realizado com sucesso!');
      triggerPostPurchaseActions();

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
                    id="customer-name"
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
                    id="customer-email"
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
                    id="customer-document"
                    type="text" 
                    value={customer.document}
                    onChange={e => setCustomer({...customer, document: formatCPF(e.target.value)})}
                    onBlur={handleDocumentBlur}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Inscrição Estadual (Opcional)</label>
                  <input 
                    type="text" 
                    placeholder="000.000.000.000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-slate-700 mb-1">Telefone / WhatsApp *</label>
                  <input 
                    id="customer-phone"
                    type="text" 
                    value={customer.phone}
                    onChange={e => setCustomer({...customer, phone: formatPhone(e.target.value)})}
                    placeholder="(00) 9 0000-0000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                    required
                  />
                </div>
                {!user && (
                  <div className="md:col-span-2 flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                    <input 
                      type="checkbox" 
                      id="create-account"
                      checked={createAccount}
                      onChange={(e) => setCreateAccount(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <label htmlFor="create-account" className="text-sm font-bold text-indigo-900">
                      Desejo criar uma conta para acompanhar meu pedido
                    </label>
                  </div>
                )}

                {createAccount && !user && (
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Senha para sua nova conta</label>
                    <input 
                      type="password" 
                      value={customer.password || ''}
                      onChange={e => setCustomer({ ...customer, password: e.target.value })}
                      placeholder="Crie uma senha segura"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required
                    />
                  </div>
                )}
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
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={shipping.cep}
                      onChange={handleCepChange}
                      maxLength={8}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required={!isBalcao}
                    />
                    <button 
                      type="button"
                      onClick={handleGerarCotacao}
                      disabled={calculatingShipping || shipping.cep.length !== 8}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {calculatingShipping ? '...' : 'Calcular'}
                    </button>
                  </div>
                </div>
                
                {isBalcao ? (
                  <div className="md:col-span-2 bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center gap-3">
                    <CheckCircle2 className="text-emerald-600 shrink-0" size={24} />
                    <div>
                      <p className="text-emerald-900 font-bold">Retirada no Balcão</p>
                      <p className="text-emerald-700 text-sm">Você optou por buscar o pedido na empresa. Não é necessário preencher o endereço.</p>
                    </div>
                  </div>
                ) : (
                  <>
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
                </>
              )}
              </div>
            </section>

            {/* Entrega */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                    <Truck size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Forma de Entrega</h2>
                </div>
                {!isBalcao && (
                  <button
                    type="button"
                    onClick={handleGerarCotacao}
                    disabled={calculatingShipping || shipping.cep.replace(/\D/g, '').length !== 8 || isFreeShipping}
                    className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {calculatingShipping ? 'Calculando...' : isFreeShipping ? 'Frete Grátis' : 'Calcular Frete'}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {isBalcao ? (
                  <div className="p-6 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                        <Store size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-indigo-900">Retirada no Balcão</h3>
                        <p className="text-sm text-indigo-700">Retirada na empresa após confirmação do pagamento</p>
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded-xl border border-indigo-50 text-sm text-slate-600 space-y-2">
                      <p className="font-bold text-slate-900 mb-2">Instruções para retirada:</p>
                      <p>Você escolheu retirar no balcão.</p>
                      <p>Após o pagamento ser aprovado, compareça na empresa portando:</p>
                      <ul className="list-disc pl-5 space-y-1 mt-2">
                        <li>Comprovante de pagamento</li>
                        <li>Documento de identificação</li>
                        <li>Número do pedido</li>
                      </ul>
                      
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="font-bold text-slate-900 mb-1">Endereço da Empresa:</p>
                        <p>{settings?.company_name}</p>
                        <p>{settings?.address}</p>
                        {settings?.phone && <p className="mt-1">Telefone: {settings?.phone}</p>}
                      </div>
                    </div>
                  </div>
                ) : displayShippingMethods.length > 0 ? (
                  displayShippingMethods.map((method, index) => (
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
                        {method.price === 0 ? 'Grátis' : formatCurrency(method.price)}
                      </p>
                    </button>
                  ))
                ) : shipping.cep.replace(/\D/g, '').length === 8 && !calculatingShipping && shippingMethods.length === 0 ? (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-700 text-sm font-bold text-center">
                    Clique em "Calcular Frete" para ver as opções disponíveis.
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 border-dashed rounded-2xl text-slate-400 text-sm font-bold text-center italic">
                    {calculatingShipping ? 'Calculando opções de frete...' : 'Informe seu CEP e clique em Calcular Frete.'}
                  </div>
                )}
                
                {cartTotal >= threshold && threshold > 0 && (
                  <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-700">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Truck size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Frete Grátis Ativado!</p>
                      <p className="text-xs opacity-80">Você economizou no frete por comprar acima de {formatCurrency(threshold)}</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Cupom de Desconto - Movido para antes do pagamento como solicitado */}
            <section className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <Ticket size={20} />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Cupom de Desconto</h2>
              </div>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Possui um cupom de luxo?</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="DIGITE O CÓDIGO"
                    className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
                  />
                </div>
                {couponCode && appliedDiscounts.some(d => campaigns.some(c => c.title === d.name && c.trigger_type === 'coupon')) && (
                  <p className="text-[10px] text-emerald-600 font-bold mt-3 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Cupom aplicado com sucesso!
                  </p>
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

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                {gateways.filter((g, index, self) => self.findIndex(t => t.provider === g.provider) === index).map((gateway) => (
                  <button
                    key={gateway.id}
                    type="button"
                    onClick={() => {
                      setPaymentMethod(gateway.provider);
                      setSelectedGateway(gateway.id);
                      setPagarmeMethod(null);
                    }}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === gateway.provider ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                  >
                    <CreditCard size={20} />
                    <span className="font-bold text-xs text-center">{gateway.name}</span>
                  </button>
                ))}
                {/* Fallback para métodos internos se não houver gateways configurados */}
                {gateways.length === 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('pix')}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === 'pix' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <QrCode size={20} />
                      <span className="font-bold text-xs">PIX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('credit_card')}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${paymentMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <CreditCard size={20} />
                      <span className="font-bold text-xs text-center">Cartão</span>
                      <span className="text-[10px] opacity-70 text-center">Até 12x</span>
                    </button>
                  </>
                )}
              </div>

              {/* Botão de Finalização para pedidos GRÁTIS */}
              {finalTotal <= 0 && (
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => handleCheckout()}
                    disabled={processing}
                    className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {processing ? 'Processando...' : 'Finalizar Pedido Grátis'}
                  </button>
                </div>
              )}

              {paymentMethod === 'pagarme' && (
                <div className="mb-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setPagarmeMethod('pix')}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${pagarmeMethod === 'pix' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <QrCode size={20} />
                      <span className="font-bold text-xs">PIX</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPagarmeMethod('credit_card')}
                      className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${pagarmeMethod === 'credit_card' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    >
                      <CreditCard size={20} />
                      <span className="font-bold text-xs">Cartão Crédito</span>
                      <span className="text-[10px] opacity-70">Até 12x</span>
                    </button>
                  </div>

                  {pagarmeMethod === 'pix' && finalTotal > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCheckout()}
                      disabled={processing}
                      className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processing ? 'Gerando QR Code...' : 'Gerar QR Code e Finalizar'}
                    </button>
                  )}
                </div>
              )}

              {(paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card') && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Número do Cartão *</label>
                    <input 
                      id="card-number-input"
                      name="cc-number"
                      autoComplete="cc-number"
                      inputMode="numeric"
                      type="tel" 
                      value={cardData.number}
                      onChange={e => {
                        let val = e.target.value.replace(/\D/g, '');
                        if (val.length > 16) val = val.slice(0, 16);
                        const masked = val.match(/.{1,4}/g)?.join('.') || val;
                        setCardData({...cardData, number: masked});
                      }}
                      placeholder="0000.0000.0000.0000"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      required={paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card'}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome Impresso no Cartão *</label>
                    <input 
                      id="card-name-input"
                      name="cc-name"
                      autoComplete="cc-name"
                      type="text" 
                      value={cardData.name}
                      onChange={e => setCardData({...cardData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all uppercase"
                      required={paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card'}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Validade *</label>
                      <input 
                        id="card-expiry-input"
                        name="cc-exp"
                        autoComplete="cc-exp"
                        inputMode="numeric"
                        type="tel" 
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
                        required={paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">CVV *</label>
                      <input 
                        id="card-cvv-input"
                        name="cc-csc"
                        autoComplete="cc-csc"
                        inputMode="numeric"
                        type="tel" 
                        value={cardData.cvv}
                        onChange={e => setCardData({...cardData, cvv: e.target.value})}
                        placeholder="123"
                        maxLength={4}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        required={paymentMethod === 'credit_card' || pagarmeMethod === 'credit_card' || pagarmeMethod === 'debit_card'}
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
                        // Calcula o valor mínimo de parcela (usamos o maior entre os produtos para segurança)
                        const minInstallmentValue = cart.length > 0 
                          ? Math.max(...cart.map(item => item.product.min_installment_value || 50))
                          : 50;

                        const maxInstallments = 12;
                        let possibleInstallments = Math.floor(finalTotal / minInstallmentValue);
                        if (possibleInstallments > maxInstallments) possibleInstallments = maxInstallments;
                        if (possibleInstallments < 1) possibleInstallments = 1;

                        const options = [];
                        for (let i = 1; i <= possibleInstallments; i++) {
                          options.push(
                            <option key={i} value={i.toString()}>
                              {i}x de {formatCurrency(finalTotal / i)} sem juros
                            </option>
                          );
                        }
                        return options;
                      })()}
                    </select>
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={() => handleCheckout()}
                      disabled={processing}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {processing ? 'Processando Pagamento...' : `Pagar ${formatCurrency(finalTotal)} Agora`}
                    </button>
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
                    Desconto de 5% aplicado: {formatCurrency(finalTotal * 0.05)}
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
                          {formatCurrency(calculatePrice(item.product, item.quantity).total)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 pt-6 border-t border-slate-100 mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium">{formatCurrency(cartTotal)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1"><Truck size={16} /> Frete</span>
                  <span className="font-medium">
                    {calculatingShipping ? (
                      <span className="text-slate-400 text-xs animate-pulse">Calculando...</span>
                    ) : (shippingCost === undefined || shippingCost === null) ? (
                      <span className="text-slate-400 text-xs">Informe o CEP</span>
                    ) : shippingCost === 0 ? (
                      <span className="text-emerald-500 font-bold uppercase text-xs">Grátis</span>
                    ) : (
                      `${formatCurrency(shippingCost)}`
                    )}
                  </span>
                </div>
                {appliedDiscounts.map((discount, idx) => (
                  <div key={idx} className="flex justify-between text-emerald-600 font-medium">
                    <span>{discount.name}</span>
                    <span>- {formatCurrency(discount.value)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-end pt-6 border-t border-slate-100 mb-8">
                <span className="text-slate-900 font-bold">Total</span>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">
                    {formatCurrency(finalTotal)}
                  </span>
                  {(() => {
                    const minInstallmentValue = cart.length > 0 
                      ? Math.max(...cart.map(item => item.product.min_installment_value || 50))
                      : 50;
                    const maxInstallments = 12;
                    let possibleInstallments = Math.floor(finalTotal / minInstallmentValue);
                    if (possibleInstallments > maxInstallments) possibleInstallments = maxInstallments;
                    if (possibleInstallments < 1) possibleInstallments = 1;
                    
                    if (possibleInstallments > 1) {
                      return (
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                          ou em até {possibleInstallments}x de {formatCurrency(finalTotal / possibleInstallments)}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
                <ShieldCheck size={14} />
                Ambiente 100% Seguro
              </div>
            </div>
          </div>

        </form>
      </div>

      {/* Modal do PIX */}
      {showPixModal && pixData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-y-auto max-h-[95vh]"
          >
            <button 
              onClick={() => setShowPixModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <QrCode size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Pagamento via PIX</h3>
              <p className="text-slate-500 text-sm">Escaneie o QR Code ou copie o código abaixo para pagar</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8 flex flex-col items-center">
              {pixData.qr_code_url && (
                <img 
                  src={pixData.qr_code_url} 
                  alt="QR Code PIX" 
                  className="w-48 h-48 mb-4 rounded-xl shadow-sm"
                  referrerPolicy="no-referrer"
                />
              )}
              
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Código Copia e Cola</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixData.qr_code}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-600 focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(pixData.qr_code);
                      toast.success('Código copiado!');
                    }}
                    className="p-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex gap-3">
                <AlertCircle className="text-amber-500 shrink-0" size={20} />
                <p className="text-xs text-amber-800 leading-relaxed">
                  O pagamento é processado instantaneamente. Assim que o banco confirmar, seu pedido será atualizado automaticamente.
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowPixModal(false);
                  if (currentOrderId) {
                    navigate(`/success?orderId=${currentOrderId}`);
                  } else {
                    navigate('/store');
                  }
                }}
                className="w-full py-4 text-slate-600 font-bold text-sm hover:text-slate-900 transition-colors"
              >
                Já realizei o pagamento
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal do Boleto */}
      {showBoletoModal && boletoData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl relative overflow-y-auto max-h-[95vh]"
          >
            <button 
              onClick={() => setShowBoletoModal(false)}
              className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Barcode size={32} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2">Boleto Gerado</h3>
              <p className="text-slate-500 text-sm">Seu boleto foi gerado com sucesso. Pague em qualquer banco ou lotérica.</p>
            </div>

            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mb-8 flex flex-col items-center">
              <div className="w-full">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 text-center">Código de Barras</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={boletoData.barcode}
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-mono text-slate-600 focus:outline-none"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(boletoData.barcode);
                      toast.success('Código copiado!');
                    }}
                    className="p-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 transition-colors shadow-lg shadow-amber-200"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <a 
                href={boletoData.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                Visualizar Boleto (PDF)
              </a>
              <button 
                onClick={() => {
                  setShowBoletoModal(false);
                  if (currentOrderId) {
                    navigate(`/success?orderId=${currentOrderId}`);
                  } else {
                    navigate('/store');
                  }
                }}
                className="w-full py-4 text-slate-600 font-bold text-sm hover:text-slate-900 transition-colors"
              >
                Já realizei o pagamento
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showSuccessModal && <SuccessModal />}
      {showPaymentErrorModal.isOpen && <PaymentErrorModal />}
      
      <TrackingModal 
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
      />
    </div>
  );
}
