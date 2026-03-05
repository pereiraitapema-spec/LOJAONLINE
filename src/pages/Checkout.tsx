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
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

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
  const [shippingMethods, setShippingMethods] = useState<{ name: string; price: number; deadline: string; active: boolean }[]>([]);
  const [selectedShipping, setSelectedShipping] = useState<number>(0);
  
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

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

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
        }

        // Fetch shipping methods
        const { data: settings } = await supabase
          .from('store_settings')
          .select('shipping_methods, free_shipping_threshold')
          .maybeSingle();
        
        if (settings?.free_shipping_threshold) {
          setFreeShippingThreshold(settings.free_shipping_threshold);
        }

        if (settings?.shipping_methods) {
          const activeMethods = settings.shipping_methods.filter((m: any) => m.active);
          setShippingMethods(activeMethods);
        } else {
          // Fallback
          setShippingMethods([
            { name: 'Correios (PAC)', price: 25.90, deadline: '7 a 10 dias úteis', active: true },
            { name: 'Correios (SEDEX)', price: 45.90, deadline: '2 a 4 dias úteis', active: true }
          ]);
        }
      } catch (error) {
        console.error('Error loading checkout data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate]);

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

  const currentShipping = shippingMethods[selectedShipping];
  const shippingCost = cartTotal >= freeShippingThreshold ? 0 : (currentShipping?.price || 0);
  const finalTotal = cartTotal + shippingCost;

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
        } else {
          const { data, error } = await supabase
            .from('abandoned_carts')
            .insert([payload])
            .select()
            .single();
          
          if (!error && data) {
            setAbandonedCartId(data.id);
          }
        }
      } catch (error) {
        console.error('Error tracking abandoned cart:', error);
      }
    };

    const timeoutId = setTimeout(trackAbandonedCart, 2000); // Debounce 2s
    return () => clearTimeout(timeoutId);
  }, [customer.email, customer.name, customer.phone, cart, finalTotal, abandonedCartId]);

  const handleCepBlur = async () => {
    const cep = shipping.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;

    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setShipping(prev => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }));
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    }
  };

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
      // 0. Check for Affiliate Code
      let affiliateId = null;
      let commissionValue = 0;
      const affiliateCode = localStorage.getItem('affiliate_code');
      
      if (affiliateCode) {
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id, commission_rate')
          .eq('code', affiliateCode)
          .single();
        
        if (affiliate) {
          affiliateId = affiliate.id;
          
          // Calculate commission based on products
          commissionValue = cart.reduce((acc, item) => {
            const price = item.product.discount_price || item.product.price;
            const productCommissionRate = item.product.affiliate_commission;
            
            // Use product commission rate if set (> 0), otherwise use affiliate's default rate
            const rate = (productCommissionRate !== undefined && productCommissionRate > 0) 
              ? productCommissionRate 
              : (affiliate.commission_rate || 0);
              
            return acc + ((price * rate / 100) * item.quantity);
          }, 0);
        }
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
        unit_price: item.product.discount_price || item.product.price,
        total_price: calculatePrice(item.product, item.quantity).total
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // 3. Simulate Payment Gateway (Pagar.me)
      // In a real scenario, we would call our backend API here, which would call Pagar.me
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call

      // Update order status to paid (simulated success)
      await supabase
        .from('orders')
        .update({ status: 'paid', payment_id: `sim_${Math.random().toString(36).substr(2, 9)}` })
        .eq('id', orderData.id);

      // Clear cart
      localStorage.removeItem('cart_items');
      setCart([]);

      toast.success('Pedido realizado com sucesso!');
      
      // Redirect to success page or clear state
      navigate('/'); // Or create a /success page
      
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
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome Completo *</label>
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
                  <label className="block text-sm font-bold text-slate-700 mb-1">CPF/CNPJ *</label>
                  <input 
                    type="text" 
                    value={customer.document}
                    onChange={e => setCustomer({...customer, document: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
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
                      onChange={e => setCardData({...cardData, number: e.target.value})}
                      placeholder="0000 0000 0000 0000"
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
                        onChange={e => setCardData({...cardData, expiry: e.target.value})}
                        placeholder="MM/AA"
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
                  className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-center"
                >
                  <Landmark size={48} className="mx-auto text-blue-600 mb-4" />
                  <h3 className="font-bold text-blue-800 mb-2">Transferência Bancária</h3>
                  <p className="text-sm text-blue-600 mb-4">Os dados para transferência (TED/DOC) serão exibidos na próxima etapa.</p>
                  <div className="inline-block bg-blue-200 text-blue-800 px-4 py-2 rounded-full text-sm font-bold">
                    Aprovação em até 24h
                  </div>
                </motion.div>
              )}
            </section>
          </div>

          {/* Coluna Direita: Resumo */}
          <div className="lg:col-span-1">
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

              <div className="space-y-3 pt-6 border-t border-slate-100 mb-6">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span className="font-medium">R$ {cartTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span className="flex items-center gap-1"><Truck size={16} /> Frete</span>
                  <span className="font-medium">{shippingCost === 0 ? <span className="text-emerald-500 font-bold uppercase text-xs">Grátis</span> : `R$ ${shippingCost.toFixed(2)}`}</span>
                </div>
                {paymentMethod === 'pix' && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Desconto PIX (5%)</span>
                    <span>- R$ {(finalTotal * 0.05).toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-end pt-6 border-t border-slate-100 mb-8">
                <span className="text-slate-900 font-bold">Total</span>
                <div className="text-right">
                  <span className="text-3xl font-black text-slate-900 tracking-tighter">
                    R$ {(paymentMethod === 'pix' ? finalTotal * 0.95 : finalTotal).toFixed(2)}
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
