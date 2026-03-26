import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, ShieldCheck, User, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Image as ImageIcon, X, Search, Menu, 
  Heart, Truck, CreditCard, Phone, Instagram, Facebook, Twitter, Youtube, Linkedin,
  Star, Zap, Leaf, Droplets, Activity, Flame, Megaphone,
  QrCode, Barcode, Landmark, Package, DollarSign, Tag, BarChart, Users, Copy, Link as LinkIcon
} from 'lucide-react';
import { Loading } from '../components/Loading';
import SmartChat from '../components/SmartChat';
import { DebugModeIndicator } from '../components/DebugModeIndicator';

import { leadService } from '../services/leadService';
import { shippingService } from '../services/shippingService';
import { cepService } from '../services/cepService';

interface Banner {
  id: string;
  title: string;
  url: string;
  type: 'image' | 'video';
  duration: number;
  active: boolean;
}

interface ProductTier {
  quantity: number;
  discount_percentage: number;
}

interface ProductMedia {
  url: string;
  type: 'image' | 'video';
  position: number;
}

interface Category {
  id: string;
  name: string;
  icon?: string;
  image_url?: string;
}

interface Campaign {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  rules_text: string;
  link_url?: string;
  is_highlight?: boolean;
  active: boolean;
  display_order: number;
  badge_text?: string;
  button_text?: string;
  background_color?: string;
  text_color?: string;
  discount_value?: number;
  discount_type?: 'percentage' | 'fixed';
  trigger_type?: 'automatic' | 'coupon' | 'min_value';
  trigger_value?: number;
  coupon_code?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  composition: string;
  price: number;
  discount_price: number | null;
  image_url: string;
  stock: number;
  min_installment_value?: number;
  tiers: ProductTier[];
  media: ProductMedia[];
  quantity_info?: string;
  usage_instructions?: string;
  affiliate_commission?: number;
}

interface StoreSettings {
  company_name: string;
  cnpj: string;
  address: string;
  cep: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  facebook: string;
  social_links: { platform: string; url: string; active: boolean }[];
  business_hours: string;
  business_hours_details: string;
  payment_methods: { name: string; type: string; active: boolean }[];
  shipping_methods: { name: string; price: number; deadline: string; active: boolean }[];
  free_shipping_threshold?: number;
  institutional_links: { label: string; url: string; content: string }[];
  affiliate_terms: string;
  top_bar_text: string;
  promotions_section_title?: string;
  promotions_section_subtitle?: string;
  products_section_title?: string;
  products_section_subtitle?: string;
  tracking_pixels?: { platform: string; pixel_id: string; active: boolean }[];
  debug_mode?: boolean;
}

export default function Store() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [affiliateData, setAffiliateData] = useState<any>(null);
  
  // Cache initialization
  const [banners, setBanners] = useState<Banner[]>(() => {
    const saved = localStorage.getItem('cache_banners');
    return saved ? JSON.parse(saved) : [];
  });
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => {
    const saved = localStorage.getItem('cache_campaigns');
    return saved ? JSON.parse(saved) : [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('cache_products');
    return saved ? JSON.parse(saved) : [];
  });
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('cache_categories');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<StoreSettings | null>(() => {
    const saved = localStorage.getItem('cache_settings');
    return saved ? JSON.parse(saved) : null;
  });
  const [siteContent, setSiteContent] = useState<any[]>(() => {
    const saved = localStorage.getItem('cache_site_content');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: carriersData } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('active', true);
      setCarriers(carriersData || []);
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (videoRef.current && banners[currentBannerIndex]?.type === 'video') {
      videoRef.current.muted = isMuted;
      videoRef.current.play().catch(err => {
        console.warn("Autoplay with sound blocked, falling back to muted:", err);
        if (!isMuted) {
          videoRef.current!.muted = true;
          videoRef.current!.play();
        }
      });
    }
  }, [currentBannerIndex, banners, isMuted]);
  const lastCalculatedCep = React.useRef<string>('');

  const handleCalculateShipping = async () => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('CEP deve ter 8 dígitos.');
      return;
    }

    if (calculatingShipping || cleanCep === lastCalculatedCep.current) return;
    
    lastCalculatedCep.current = cleanCep;
    setCalculatingShipping(true);
    setCity(''); // Limpar cidade anterior
    setShippingQuotes([]); // Limpar cotações anteriores
    
    try {
      console.log('Buscando endereço para o CEP:', cleanCep);
      const address = await cepService.fetchAddress(cleanCep);
      
      if (address && address.city) {
        setCity(`${address.city} - ${address.state}`);

        const packages = cart.map(item => ({
          weight: (item.product as any).weight || 0.5,
          height: (item.product as any).height || 10,
          width: (item.product as any).width || 10,
          length: (item.product as any).length || 10
        }));

        let allQuotes: any[] = [];
        for (const carrier of carriers) {
          if (!carrier.active) continue;
          console.log(`Calculando frete para ${carrier.name}...`);
          const quotes = await shippingService.calculateShipping(cleanCep, packages, carrier.id);
          allQuotes = [...allQuotes, ...quotes];
        }
        
        console.log('Total de cotações recebidas:', allQuotes.length);
        setShippingQuotes(allQuotes);
        
        // Salvar CEP para o checkout
        localStorage.setItem('last_cep', cleanCep);
        
        // Selecionar automaticamente a opção mais barata se houver
        if (allQuotes.length > 0) {
          const cheapest = [...allQuotes].sort((a, b) => a.price - b.price)[0];
          setSelectedShippingQuote(cheapest);
          toast.success('Frete calculado!');
        } else {
          setSelectedShippingQuote(null);
          toast.error('Nenhuma opção de frete disponível para este CEP.');
        }
      } else {
        setCity('CEP não encontrado');
        toast.error('CEP não encontrado. Verifique os números digitados.');
      }
    } catch (error) {
      console.error('Error calculating shipping:', error);
      toast.error('Erro ao calcular frete.');
    } finally {
      setCalculatingShipping(false);
    }
  };

  const copyAffiliateLink = (productId?: string) => {
    if (!affiliateData) return;
    const baseUrl = window.location.origin;
    let url = `${baseUrl}/?ref=${affiliateData.id}`;
    if (productId) url += `&product=${productId}`;
    
    navigator.clipboard.writeText(url);
    toast.success('Link de afiliado copiado!', { icon: '🔗' });
  };

  const [isModalMuted, setIsModalMuted] = useState(false);
  const [cep, setCep] = useState('');
  const [city, setCity] = useState('');
  const [shippingQuotes, setShippingQuotes] = useState<any[]>([]);
  const [selectedShippingQuote, setSelectedShippingQuote] = useState<any>(null);
  const [calculatingShipping, setCalculatingShipping] = useState(false);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const applyCoupon = (code: string) => {
    localStorage.setItem('applied_coupon', code.toUpperCase());
    toast.success(`Cupom ${code.toUpperCase()} aplicado!`, {
      icon: '🎁',
      duration: 3000
    });
  };
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [selectedInstitutionalLink, setSelectedInstitutionalLink] = useState<{ label: string; content: string } | null>(null);
  const [affiliateCoupon, setAffiliateCoupon] = useState<any>(null);
  
  // Favoritos
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('favorite_products');
    return saved ? JSON.parse(saved) : [];
  });

  // Carrinho
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>(() => {
    const saved = localStorage.getItem('cart_items');
    return saved ? JSON.parse(saved) : [];
  });
  const [showCart, setShowCart] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  
  const productsRef = useRef<HTMLDivElement>(null);

  const scrollToProducts = () => {
    if (productsRef.current) {
      productsRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  useEffect(() => {
    localStorage.setItem('cart_items', JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    localStorage.setItem('favorite_products', JSON.stringify(favorites));
  }, [favorites]);
  
  // Detalhes do Produto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const closeProductModal = () => {
    setSelectedProduct(null);
    setActiveMediaIndex(0);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('product');
    navigate(`/?${newParams.toString()}`, { replace: true });
  };

  // Marcar como lead morno ao ver detalhes do produto
  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setQuantity(1);
    leadService.updateStatus('morno');
  };

  const calculateInstallments = (price: number, minValue: number = 50) => {
    const maxInstallments = 10;
    let installments = Math.floor(price / minValue);
    if (installments > maxInstallments) installments = maxInstallments;
    if (installments < 1) installments = 1;
    
    return {
      count: installments,
      value: price / installments
    };
  };

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  useEffect(() => {
    const coupon = searchParams.get('coupon');
    if (coupon) {
      localStorage.setItem('applied_coupon', coupon.toUpperCase());
      toast.success(`Cupom ${coupon.toUpperCase()} aplicado via link!`, {
        icon: '🎁',
        duration: 4000
      });
    }

    const catId = searchParams.get('category');
    if (catId) {
      setSelectedCategoryId(catId);
    }

    const prodId = searchParams.get('product');
    if (prodId) {
      setSelectedProductId(prodId);
    } else {
      setSelectedProductId(null);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedProductId && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        setSelectedProduct(product);
        setQuantity(1);
      }
    }
  }, [selectedProductId, products]);

  // Helper para timeout em chamadas Supabase
  const withTimeout = async <T,>(promise: PromiseLike<T>, timeoutMs: number = 30000): Promise<T> => {
    return Promise.race([
      promise as Promise<T>,
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms atingido`)), timeoutMs)
      )
    ]);
  };

  const isFetchingRef = React.useRef(false);

  useEffect(() => {
    // Se já temos dados em cache, liberamos o loading IMEDIATAMENTE
    if (products.length > 0 || banners.length > 0 || settings) {
      setLoading(false);
    }

    // Timeout de segurança para não travar a tela
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 2000);

    const checkUser = async () => {
      try {
        console.log('⏱️ Store: Verificando sessão...');
        const { data: { session } } = await withTimeout(supabase.auth.getSession(), 5000);
        setSession(session);
        
        if (session) {
          console.log('✅ Store: Usuário logado:', session.user.email);
          const { data: profile } = await withTimeout(
            supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle(),
            5000
          );

          console.log('📊 Store: Perfil carregado:', profile);
          if (profile?.role === 'admin' || session.user.email === 'pereira.itapema@gmail.com') {
            console.log('👑 Store: Admin detectado!');
            setIsAdmin(true);
          }

          // Buscar dados do afiliado
          const { data: affData } = await withTimeout(
            supabase
              .from('affiliates')
              .select('*')
              .eq('user_id', session.user.id)
              .eq('status', 'approved')
              .maybeSingle(),
            5000
          );
          
          if (affData) {
            setAffiliateData(affData);
          }
        }
      } catch (err) {
        console.warn('⚠️ Erro ao verificar usuário (timeout?):', err);
      }
    };

    const fetchData = async () => {
      if (isFetchingRef.current) {
        console.log('⏳ fetchData já em execução, pulando...');
        return;
      }
      
      try {
        isFetchingRef.current = true;
        console.log('📦 Iniciando fetchData no Store...');
        
        // Buscar cupom aplicado se existir
        const savedCoupon = localStorage.getItem('applied_coupon');
        if (savedCoupon) {
          try {
            const { data: couponData } = await withTimeout(
              supabase
                .from('affiliate_coupons')
                .select('*')
                .eq('code', savedCoupon.toUpperCase())
                .eq('active', true)
                .maybeSingle(),
              3000
            );
            
            if (couponData) {
              setAffiliateCoupon(couponData);
            }
          } catch (e) {
            console.warn('⚠️ Erro ao buscar cupom:', e);
          }
        }

        console.log('⏱️ Buscando dados principais (banners, produtos, etc)...');
        const results = await Promise.allSettled([
          withTimeout(supabase.from('banners').select('*').eq('active', true).order('created_at', { ascending: true }), 5000),
          withTimeout(supabase.from('products')
            .select('*, tiers:product_tiers(*), media:product_media(*)')
            .eq('active', true)
            .order('created_at', { ascending: false })
            .order('position', { foreignTable: 'product_media', ascending: true }), 5000),
          withTimeout(supabase.from('categories').select('*').order('name'), 5000),
          withTimeout(supabase.from('campaigns').select('*').eq('active', true).order('display_order', { ascending: true }), 5000),
          withTimeout(supabase.from('store_settings').select('*').maybeSingle(), 5000),
          withTimeout(supabase.from('site_content').select('*'), 5000),
          withTimeout(supabase.from('shipping_carriers').select('*').eq('active', true), 5000)
        ]);

        // Só atualizar o estado se a promessa foi cumprida com sucesso
        if (results[0].status === 'fulfilled' && results[0].value.data) {
          setBanners(results[0].value.data);
          localStorage.setItem('cache_banners', JSON.stringify(results[0].value.data));
        }
        
        if (results[1].status === 'fulfilled' && results[1].value.data) {
          setProducts(results[1].value.data);
          localStorage.setItem('cache_products', JSON.stringify(results[1].value.data));
        }

        if (results[2].status === 'fulfilled' && results[2].value.data) {
          setCategories(results[2].value.data);
          localStorage.setItem('cache_categories', JSON.stringify(results[2].value.data));
        }

        if (results[3].status === 'fulfilled' && results[3].value.data) {
          setCampaigns(results[3].value.data);
          localStorage.setItem('cache_campaigns', JSON.stringify(results[3].value.data));
        }

        if (results[4].status === 'fulfilled' && results[4].value.data) {
          setSettings(results[4].value.data);
          localStorage.setItem('cache_settings', JSON.stringify(results[4].value.data));
        }

        if (results[5].status === 'fulfilled' && results[5].value.data) {
          setSiteContent(results[5].value.data);
          localStorage.setItem('cache_site_content', JSON.stringify(results[5].value.data));
        }

        if (results[6].status === 'fulfilled' && results[6].value.data) {
          setCarriers(results[6].value.data);
          console.log('🚚 Carriers Loaded in Store:', results[6].value.data.length);
        }
        
        // Logs para debug
        const prodRes = results[1].status === 'fulfilled' ? results[1].value : { data: [], error: results[1].reason };
        const campRes = results[3].status === 'fulfilled' ? results[3].value : { data: [], error: results[3].reason };
        
        console.log('📦 Products Fetch Result:', { 
          count: prodRes.data?.length, 
          error: prodRes.error,
          status: results[1].status
        });
        
        // Check for affiliate link
        const urlParams = new URLSearchParams(window.location.search);
        const campaignId = urlParams.get('campaign');
        const refCode = urlParams.get('ref');
        const prodId = urlParams.get('product');

        if (refCode) {
          localStorage.setItem('affiliate_code', refCode);
        }

        if (prodId && prodRes.data) {
          const product = prodRes.data.find((p: Product) => p.id === prodId);
          if (product) {
            setSelectedProduct(product);
            setQuantity(1);
          }
        }

        if (campaignId && campRes.data) {
          const campaign = campRes.data.find((c: Campaign) => c.id === campaignId);
          if (campaign) {
            setSelectedCampaign(campaign);
          }
        }
      } catch (err) {
        console.error('❌ Critical Fetch Error:', err);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    // Chamar fetchData IMEDIATAMENTE na montagem
    fetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Store Auth Event:', event);
      setSession(session);
      // Só re-buscar se o evento for relevante e não estivermos buscando
      if ((event === 'SIGNED_IN' || event === 'SIGNED_OUT') && !isFetchingRef.current) {
        fetchData();
      }
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(safetyTimer);
    };
  }, []);


  // Lógica do Carrossel
  useEffect(() => {
    if (banners.length <= 1) return;

    const currentBanner = banners[currentBannerIndex];
    const timer = setTimeout(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, (currentBanner.duration || 5) * 1000);

    return () => clearTimeout(timer);
  }, [currentBannerIndex, banners]);

  const nextBanner = () => setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
  const prevBanner = () => setCurrentBannerIndex((prev) => (prev - 1 + banners.length) % banners.length);

  // Injeção de Pixels de Rastreamento
  useEffect(() => {
    if (settings?.tracking_pixels) {
      settings.tracking_pixels.forEach(pixel => {
        if (pixel.active && pixel.pixel_id) {
          if (settings.debug_mode) {
            console.log(`[DEBUG] Pixel ${pixel.platform} ativado com ID ${pixel.pixel_id}`);
            return;
          }
          const pixelKey = `pixel-${pixel.platform}-${pixel.pixel_id}`;
          if (document.getElementById(pixelKey)) return;

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
              fbq('track', 'PageView');
            `;
            document.head.appendChild(script);
          } else if (pixel.platform === 'google_analytics') {
            const script1 = document.createElement('script');
            script1.id = `${pixelKey}-js`;
            script1.async = true;
            script1.src = `https://www.googletagmanager.com/gtag/js?id=${pixel.pixel_id}`;
            document.head.appendChild(script1);

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
  }, [settings]);

  // Lógica do Carrossel de Mídia do Produto
  useEffect(() => {
    if (!selectedProduct) return;
    
    const allMedia = [
      ...(selectedProduct.image_url ? [{ url: selectedProduct.image_url, type: 'image' }] : []),
      ...(selectedProduct.media || [])
    ];

    if (allMedia.length <= 1) return;

    const currentMedia = allMedia[activeMediaIndex];
    let timeoutId: NodeJS.Timeout;

    if (currentMedia.type === 'image') {
      timeoutId = setTimeout(() => {
        setActiveMediaIndex((prev) => (prev + 1) % allMedia.length);
      }, 5000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [selectedProduct, activeMediaIndex]);

  // Cálculos de Preço
  const calculatePrice = (product: Product, qty: number) => {
    const basePrice = product.discount_price || product.price;
    
    // Encontrar o melhor tier aplicável
    const applicableTier = [...(product.tiers || [])]
      .sort((a, b) => b.quantity - a.quantity)
      .find(t => qty >= t.quantity);
    
    const discount = applicableTier ? applicableTier.discount_percentage : 0;
    const unitPrice = basePrice * (1 - discount / 100);
    const total = unitPrice * qty;

    return {
      unitPrice,
      total,
      discount
    };
  };

  const addToCart = (product: Product, qty: number) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + qty } 
            : item
        );
      }
      return [...prev, { product, quantity: qty }];
    });
    
    // Marcar como lead morno ao adicionar ao carrinho
    leadService.updateStatus('morno');
    
    closeProductModal();
    setShowCart(true);
  };

  const toggleFavorite = (productId: string) => {
    setFavorites(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId) 
        : [...prev, productId]
    );
    if (!favorites.includes(productId)) {
      toast.success('Adicionado aos favoritos!');
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => {
    const { total } = calculatePrice(item.product, item.quantity);
    return acc + total;
  }, 0);

  const discountValue = affiliateCoupon ? (cartTotal * affiliateCoupon.discount_percentage / 100) : 0;
  
  const threshold = Number(settings?.free_shipping_threshold) || 0;
  const isFreeShipping = threshold > 0 && cartTotal >= threshold;
  const shippingCost = isFreeShipping ? 0 : (selectedShippingQuote?.price || 0);
  
  const finalTotal = cartTotal - discountValue + shippingCost;

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {loading && <Loading message="Preparando sua loja..." />}
      {/* Top Bar */}
      <div className="bg-emerald-800 text-white text-[10px] md:text-xs font-medium py-2 px-4 flex justify-between items-center tracking-wide">
        <span className="hidden md:inline">{settings?.top_bar_text || "Envio Brasil | 7 dias devolução | 10x sem juros | WhatsApp (47)99660-9618"}</span>
        <span className="md:hidden">Envio para todo Brasil</span>
        <button 
          onClick={() => navigate('/affiliate-register')}
          className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1"
        >
          <User size={12} />
          Seja um Afiliado
        </button>
      </div>

      {/* Barra de Frete Grátis */}
      {cart.length > 0 && (
        <div className="bg-white border-b border-slate-100 py-2 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider">
                {cartTotal >= (settings?.free_shipping_threshold || 0) && (settings?.free_shipping_threshold || 0) > 0
                  ? "🎉 PARABÉNS! VOCÊ GANHOU FRETE GRÁTIS!" 
                  : (settings?.free_shipping_threshold || 0) > 0 
                    ? `FALTAM R$ ${((settings?.free_shipping_threshold || 0) - cartTotal).toFixed(2)} PARA FRETE GRÁTIS`
                    : "FRETE GRÁTIS EM TODAS AS COMPRAS!"
                }
              </span>
              {(settings?.free_shipping_threshold || 0) > 0 && (
                <span className="text-[10px] font-black text-emerald-600">R$ {(settings?.free_shipping_threshold || 0).toFixed(2)}</span>
              )}
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((cartTotal / (settings?.free_shipping_threshold || 299)) * 100, 100)}%` }}
                className={`h-full transition-all duration-500 ${cartTotal >= (settings?.free_shipping_threshold || 299) ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              />
            </div>
          </div>
        </div>
      )}

      {/* Header da Loja */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <DebugModeIndicator active={settings?.debug_mode} />
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4 md:gap-8">
          {/* Logo & Tagline */}
          <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            {siteContent.find(c => c.key === 'site_logo')?.value ? (
              <img 
                src={siteContent.find(c => c.key === 'site_logo')?.value} 
                alt="Logo" 
                className="h-12 md:h-16 object-contain"
              />
            ) : (
              <div className="flex items-center gap-1 font-black text-2xl md:text-3xl tracking-tighter">
                <Leaf size={28} className="text-emerald-600" />
                <span className="text-emerald-800">
                  {siteContent.find(c => c.key === 'brand_name')?.value?.split(' ')[0] || 'G-Fit'}
                </span>
                <span className="text-cyan-700">
                  {siteContent.find(c => c.key === 'brand_name')?.value?.split(' ').slice(1).join(' ') || 'Life'}
                </span>
              </div>
            )}
            <span className="text-[9px] md:text-[10px] text-slate-500 font-medium hidden md:block uppercase tracking-widest mt-0.5">
              {siteContent.find(c => c.key === 'site_tagline')?.value || 'Saúde, Beleza e Emagrecimento'}
            </span>
          </div>

          {/* Busca Central */}
          <div className="flex-1 max-w-2xl hidden md:flex relative">
            <input 
              type="text" 
              placeholder="O que você está buscando hoje?"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchSuggestions(e.target.value.length > 0);
              }}
              onFocus={() => setShowSearchSuggestions(searchTerm.length > 0)}
              className="w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-full outline-none focus:ring-2 focus:ring-emerald-600 transition-all font-medium placeholder:text-slate-400"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors">
              <Search size={18} />
            </button>

            {/* Sugestões de Busca */}
            <AnimatePresence>
              {showSearchSuggestions && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
                >
                  <div className="p-2">
                    {products
                      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                      .slice(0, 5)
                      .map(product => (
                        <button
                          key={product.id}
                          onClick={() => {
                            handleSelectProduct(product);
                            setShowSearchSuggestions(false);
                            setSearchTerm('');
                          }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-xl transition-colors text-left"
                        >
                          <div className="w-10 h-10 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                            {product.image_url && (
                              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{product.name}</div>
                            <div className="text-xs text-emerald-600 font-bold">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.discount_price || product.price)}
                            </div>
                          </div>
                        </button>
                      ))}
                    {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                      <div className="p-4 text-center text-slate-500 text-sm font-medium">
                        Nenhum produto encontrado para "{searchTerm}"
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-3 md:gap-6">
            <button className="md:hidden p-2 text-slate-600">
              <Search size={24} />
            </button>

            {isAdmin && (
              <button 
                onClick={() => navigate('/dashboard')}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full text-sm font-bold border border-amber-200 hover:bg-amber-100 transition-colors"
              >
                <ShieldCheck size={18} />
                Admin
              </button>
            )}

            {affiliateData && (
              <button 
                onClick={() => navigate('/affiliate-dashboard')}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors"
              >
                <BarChart size={18} />
                Painel Afiliado
              </button>
            )}

            {affiliateData && (
              <button 
                onClick={() => copyAffiliateLink()}
                className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-full text-sm font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/20"
                title="Copiar seu link de afiliado geral"
              >
                <LinkIcon size={18} />
                Link Geral
              </button>
            )}

            {/* Botão Seja um Afiliado */}
            <button 
              onClick={() => navigate('/affiliate-register')}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors"
            >
              <Users size={18} />
              Seja um Afiliado
            </button>

            {/* Botão de Favoritos */}
            <button 
              onClick={() => setShowFavorites(true)}
              className="relative flex items-center gap-2 text-slate-600 hover:text-pink-600 transition-colors"
            >
              <div className="relative w-10 h-10 bg-pink-50 text-pink-600 rounded-full flex items-center justify-center">
                <Heart size={20} fill={favorites.length > 0 ? "currentColor" : "none"} />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md">
                    {favorites.length}
                  </span>
                )}
              </div>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400">Meus Desejos</span>
                <span className="text-sm font-bold text-slate-800">Favoritos</span>
              </div>
            </button>
            
            {session ? (
              <button 
                onClick={() => navigate('/profile')}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden">
                  <User size={20} />
                </div>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Olá Visitante!</span>
                  <span className="text-sm font-bold text-slate-800">Minha Conta</span>
                </div>
              </button>
            ) : (
              <button 
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <User size={20} />
                </div>
                <div className="hidden lg:flex flex-col items-start">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Olá Visitante!</span>
                  <span className="text-sm font-bold text-slate-800">Entrar / Cadastrar</span>
                </div>
              </button>
            )}

            {/* Botão do Carrinho */}
            <button 
              onClick={() => setShowCart(true)}
              className="relative flex items-center gap-2 text-slate-600 hover:text-emerald-600 transition-colors"
            >
              <div className="relative w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
                <ShoppingBag size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-pink-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md">
                    {cart.reduce((acc, item) => acc + item.quantity, 0)}
                  </span>
                )}
              </div>
              <div className="hidden lg:flex flex-col items-start">
                <span className="text-[10px] uppercase font-bold text-slate-400">Minhas Compras</span>
                <span className="text-sm font-black text-slate-800">R$ {cartTotal.toFixed(2)}</span>
              </div>
              {affiliateCoupon && (
                <div className="absolute -top-2 -left-2 bg-emerald-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase shadow-sm animate-bounce">
                  -{affiliateCoupon.discount_percentage}%
                </div>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Categorias (Ícones) */}
      <div className="bg-white border-b border-slate-100 py-4 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 flex gap-8 min-w-max">
          <button 
            onClick={() => {
              setSearchTerm('');
              setSelectedCategoryId(null);
              setSelectedProductId(null);
              scrollToProducts();
              // Limpar URL sem recarregar
              const url = new URL(window.location.href);
              url.searchParams.delete('category');
              url.searchParams.delete('product');
              window.history.pushState({}, '', url);
            }}
            className={`flex flex-col items-center gap-2 group ${(!searchTerm && !selectedCategoryId && !selectedProductId) ? 'text-emerald-600' : 'text-slate-500 hover:text-emerald-600'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${(!searchTerm && !selectedCategoryId && !selectedProductId) ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-200'}`}>
              <Star size={24} className={(!searchTerm && !selectedCategoryId && !selectedProductId) ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider">Todos</span>
          </button>
          
          {categories.map(cat => {
            // Mapeamento simples de ícones caso não venha do banco
            const IconComponent = cat.icon === 'Zap' ? Zap :
                                  cat.icon === 'Leaf' ? Leaf :
                                  cat.icon === 'Droplets' ? Droplets :
                                  cat.icon === 'Activity' ? Activity :
                                  cat.icon === 'Flame' ? Flame :
                                  cat.icon === 'Heart' ? Heart : Star;
            
            const isActive = (searchTerm.toLowerCase() === cat.name.toLowerCase()) || (selectedCategoryId === cat.id);
            
            return (
              <button 
                key={cat.id}
                onClick={() => {
                  if (isActive) {
                    setSearchTerm('');
                    setSelectedCategoryId(null);
                  } else {
                    setSearchTerm('');
                    setSelectedCategoryId(cat.id);
                    setSelectedProductId(null);
                    scrollToProducts();
                  }
                  // Limpar URL de produto se mudar categoria
                  const url = new URL(window.location.href);
                  url.searchParams.delete('product');
                  if (isActive) url.searchParams.delete('category');
                  else url.searchParams.set('category', cat.id);
                  window.history.pushState({}, '', url);
                }}
                className={`flex flex-col items-center gap-2 group ${isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-emerald-600'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all overflow-hidden ${isActive ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-200'}`}>
                  {cat.image_url ? (
                    <img 
                      src={cat.image_url} 
                      alt={cat.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <IconComponent size={24} className={isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'} />
                  )}
                </div>
                <span className="text-xs font-bold uppercase tracking-wider">{cat.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Carrossel de Banners */}
      <section className="relative h-[60vh] md:h-[80vh] bg-slate-900 overflow-hidden">
        <AnimatePresence mode="wait">
          {banners.length > 0 ? (
            <motion.div
              key={banners[currentBannerIndex].id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1 }}
              className="absolute inset-0"
            >
              {banners[currentBannerIndex].type === 'video' ? (
                <video
                  ref={videoRef}
                  src={banners[currentBannerIndex].url}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted={isMuted}
                  playsInline
                />
              ) : (
                <img
                  src={banners[currentBannerIndex].url}
                  alt={banners[currentBannerIndex].title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              )}
              
              {/* Controles de Som do Banner */}
              {banners[currentBannerIndex].type === 'video' && (
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="absolute bottom-8 right-8 p-3 bg-black/30 backdrop-blur-md text-white rounded-full hover:bg-black/50 transition-colors z-20"
                >
                  {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
                </button>
              )}
              
              {/* Título do Banner */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end">
                <div className="max-w-7xl mx-auto px-4 pb-16 w-full">
                  <motion.h2 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="text-white text-4xl md:text-6xl font-black uppercase italic tracking-tighter"
                  >
                    {banners[currentBannerIndex].title}
                  </motion.h2>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <ImageIcon size={48} className="opacity-20" />
            </div>
          )}
        </AnimatePresence>

        {/* Controles do Carrossel */}
        {banners.length > 1 && (
          <>
            <button 
              onClick={prevBanner}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-colors z-30"
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={nextBanner}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 backdrop-blur-md text-white rounded-full hover:bg-white/20 transition-colors z-30"
            >
              <ChevronRight size={32} />
            </button>
            
            {/* Indicadores */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-30">
              {banners.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentBannerIndex(idx)}
                  className={`w-3 h-3 rounded-full transition-all ${idx === currentBannerIndex ? 'bg-white w-8' : 'bg-white/40'}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Benefícios (Destaques) */}
      {campaigns.filter(c => c.is_highlight).length > 0 && (
        <section className="bg-white py-8 border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4">
            <h3 className="text-center text-2xl md:text-3xl font-black italic uppercase tracking-tight text-slate-900 mb-8">
              CONHEÇA E APROVEITE NOSSOS BENEFÍCIOS
            </h3>
            <div className="flex flex-wrap justify-center gap-4">
              {campaigns.filter(c => c.is_highlight).map((campaign) => (
                <motion.div
                  key={campaign.id}
                  whileHover={{ y: -5, scale: 1.02 }}
                  onClick={() => setSelectedCampaign(campaign)}
                  className={`cursor-pointer rounded-xl flex flex-col items-center justify-center text-center w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1rem)] min-h-[120px] shadow-lg transition-all ${
                    campaign.image_url 
                      ? 'bg-transparent shadow-none border-none p-0' 
                      : 'bg-black text-white p-4 border border-slate-800'
                  }`}
                >
                  {campaign.image_url ? (
                    <img 
                      src={campaign.image_url} 
                      alt={campaign.title} 
                      className="w-full h-full object-contain rounded-xl hover:shadow-xl transition-shadow" 
                    />
                  ) : (
                    <>
                      <h4 className="font-black italic uppercase text-lg leading-tight mb-1">
                        {campaign.title}
                      </h4>
                      {campaign.subtitle && (
                        <p className="text-xs font-medium text-emerald-400">
                          {campaign.subtitle}
                        </p>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Campanhas Promocionais (Não-Destaques) */}
      {campaigns.filter(c => !c.is_highlight).length > 0 && (
        <section className="bg-slate-50 py-12 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4">
            <h3 className="text-center text-2xl md:text-3xl font-black italic uppercase tracking-tight text-slate-900 mb-2">
              {settings?.promotions_section_title || 'CAMPANHAS E PROMOÇÕES'}
            </h3>
            {settings?.promotions_section_subtitle && (
              <p className="text-center text-slate-500 mb-8">{settings.promotions_section_subtitle}</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaigns.filter(c => !c.is_highlight).map((campaign) => (
                <motion.div
                  key={campaign.id}
                  whileHover={{ y: -5, scale: 1.02 }}
                  onClick={() => {
                    if (campaign.link_url) {
                      window.location.href = campaign.link_url;
                    } else {
                      setSelectedCampaign(campaign);
                    }
                  }}
                  className="cursor-pointer rounded-[32px] overflow-hidden shadow-lg relative h-[280px] flex items-center"
                  style={{ 
                    backgroundColor: campaign.background_color || '#000000',
                    color: campaign.text_color || '#ffffff'
                  }}
                >
                  {/* Conteúdo Texto */}
                  <div className="w-1/2 p-8 relative z-10 flex flex-col justify-center h-full">
                    {campaign.badge_text && (
                      <div className="inline-block bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider mb-4 w-fit">
                        {campaign.badge_text}
                      </div>
                    )}
                    
                    <h4 className="font-black italic uppercase text-4xl leading-[0.9] mb-4 tracking-tighter">
                      {campaign.title}
                    </h4>
                    
                    {campaign.subtitle && (
                      <p className="text-sm font-medium opacity-90 mb-6 leading-tight">
                        {campaign.subtitle}
                      </p>
                    )}

                    <button className="bg-white text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform w-fit">
                      {campaign.button_text || 'VER AGORA'}
                    </button>
                  </div>

                  {/* Imagem */}
                  <div className="absolute right-0 top-0 w-1/2 h-full">
                    {campaign.image_url ? (
                      <img 
                        src={campaign.image_url} 
                        alt={campaign.title} 
                        className="w-full h-full object-cover object-center" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-black/10">
                        <Megaphone size={48} className="opacity-20" />
                      </div>
                    )}
                    {/* Overlay gradiente para texto legível */}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent pointer-events-none" style={{ background: `linear-gradient(to right, ${campaign.background_color || '#000000'} 10%, transparent 100%)` }}></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Conteúdo da Loja */}
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">
            {settings?.products_section_title || 'Novidades da Estação'}
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto mb-8">
            {settings?.products_section_subtitle || 'Confira as últimas tendências e ofertas exclusivas que preparamos para você.'}
          </p>

          {/* Filtro de Categorias */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            <button
              onClick={() => {
                setSelectedCategory(null);
                setSelectedCategoryId(null);
                setSelectedProductId(null);
                scrollToProducts();
              }}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                (selectedCategory === null && selectedCategoryId === null)
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              Todos
            </button>
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSelectedCategoryId(null);
                  setSelectedProductId(null);
                  scrollToProducts();
                }}
                className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${
                  (selectedCategory === category.id || selectedCategoryId === category.id)
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid de Produtos */}
        <div ref={productsRef} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {(() => {
            const filtered = products.filter(p => {
              // Filtro por Categoria (Link Direto ou Seleção)
              const catId = selectedCategory || selectedCategoryId;
              if (catId) {
                if ((p as any).category_id !== catId) return false;
              }

              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              // Verifica se o termo de busca bate com o nome do produto ou com a categoria
              const matchName = p.name.toLowerCase().includes(term);
              const matchCategory = categories.find(c => c.id === (p as any).category_id)?.name.toLowerCase() === term;
              return matchName || matchCategory;
            });
            
            return filtered.map((product) => (
              <motion.div 
                key={product.id}
                whileHover={{ y: -10 }}
                onClick={() => handleSelectProduct(product)}
                className="group cursor-pointer"
              >
              <div className="aspect-[3/4] bg-slate-100 rounded-3xl mb-4 overflow-hidden relative shadow-sm border border-slate-100">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.name}
                    className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <ImageIcon size={48} />
                  </div>
                )}
                
                {/* Botão de Favorito */}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(product.id);
                  }}
                  className={`absolute top-4 right-4 p-2 rounded-full backdrop-blur-md transition-all z-10 ${favorites.includes(product.id) ? 'bg-pink-500 text-white' : 'bg-white/80 text-slate-400 hover:text-pink-500'}`}
                >
                  <Heart size={18} fill={favorites.includes(product.id) ? "currentColor" : "none"} />
                </button>

                {/* Badge de Desconto se houver tiers */}
                {product.tiers && product.tiers.length > 0 && (
                  <div className="absolute top-4 left-4 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic tracking-tighter shadow-lg">
                    Leve mais, pague menos
                  </div>
                )}

                {/* Badge de Frete Grátis */}
                {(product.discount_price || product.price) >= (settings?.free_shipping_threshold || 299) && (settings?.free_shipping_threshold || 0) > 0 && (
                  <div className={`absolute ${product.tiers && product.tiers.length > 0 ? 'top-12' : 'top-4'} left-4 bg-indigo-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic tracking-tighter shadow-lg flex items-center gap-1`}>
                    <Truck size={12} />
                    Frete Grátis
                  </div>
                )}
              </div>
              <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
              {product.quantity_info && (
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mt-0.5">{product.quantity_info}</span>
              )}
              <div className="mt-1 flex items-baseline gap-2">
                {product.discount_price !== null && product.discount_price !== undefined && product.discount_price > 0 ? (
                  <>
                    <span className="text-emerald-600 font-black">R$ {product.discount_price.toFixed(2)}</span>
                    <span className="text-xs text-slate-400 line-through">R$ {product.price.toFixed(2)}</span>
                  </>
                ) : (
                  <span className="text-slate-900 font-black">R$ {product.price.toFixed(2)}</span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CreditCard size={10} className="text-emerald-500" />
                ou {calculateInstallments(product.discount_price || product.price, product.min_installment_value).count}x de R$ {calculateInstallments(product.discount_price || product.price, product.min_installment_value).value.toFixed(2)}
              </div>

              {affiliateData && (
                <div className="mt-2 p-2 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] font-bold text-indigo-600 uppercase">Sua Comissão</span>
                    <span className="text-xs font-black text-indigo-700">
                      R$ {((product.discount_price || product.price) * (product.affiliate_commission || affiliateData.commission_rate) / 100).toFixed(2)}
                    </span>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      copyAffiliateLink(product.id);
                    }}
                    className="w-full py-1.5 bg-white border border-indigo-200 text-indigo-600 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1.5 hover:bg-indigo-600 hover:text-white transition-all"
                  >
                    <Copy size={12} />
                    Link de Divulgação
                  </button>
                </div>
              )}

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectProduct(product);
                }}
                className="w-full mt-4 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors uppercase text-sm tracking-wider"
              >
                Comprar
              </button>
            </motion.div>
          ));
        })()}
          {(() => {
            const filtered = products.filter(p => {
              if (selectedProductId) return p.id === selectedProductId;
              const catId = selectedCategory || selectedCategoryId;
              if (catId && (p as any).category_id !== catId) return false;
              if (!searchTerm) return true;
              const term = searchTerm.toLowerCase();
              const matchName = p.name.toLowerCase().includes(term);
              const matchCategory = categories.find(c => c.id === (p as any).category_id)?.name.toLowerCase() === term;
              return matchName || matchCategory;
            });
            
            if (filtered.length === 0 && products.length > 0) {
              return (
                <div className="col-span-full text-center py-12 text-slate-500">
                  Nenhum produto encontrado {searchTerm ? `para "${searchTerm}"` : ''}.
                </div>
              );
            }
            return null;
          })()}
        </div>

        {products.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhum produto disponível no momento</h3>
            <p className="text-slate-500">Volte em breve para conferir nossas novidades.</p>
          </div>
        )}
      </main>

      {/* Banner Seja um Afiliado */}
      <section className="bg-slate-900 py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1556761175-5973dc0f32e7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center mix-blend-overlay"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6 italic uppercase tracking-tighter">
              Lucre com a <span className="text-emerald-400">Nossa Marca</span>
            </h2>
            <p className="text-slate-300 text-lg md:text-xl mb-10 leading-relaxed">
              Torne-se um afiliado e ganhe comissões exclusivas por cada venda realizada através do seu link. 
              Tenha sua própria loja virtual, crie cupons de desconto e acompanhe seus ganhos em tempo real.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/affiliate-register')}
                className="bg-emerald-500 text-slate-900 px-8 py-4 rounded-full font-black text-lg uppercase tracking-wider hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20 hover:scale-105"
              >
                Quero ser Afiliado
              </button>
              <button 
                onClick={() => navigate('/login')}
                className="bg-transparent border-2 border-slate-700 text-white px-8 py-4 rounded-full font-bold text-lg uppercase tracking-wider hover:bg-slate-800 transition-all hover:border-slate-600"
              >
                Já sou Afiliado
              </button>
            </div>
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
              <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-xl flex items-center justify-center mb-4">
                  <DollarSign size={24} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Comissões Atrativas</h3>
                <p className="text-slate-400 text-sm">Ganhe porcentagens variadas por produto vendido através do seu link exclusivo.</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700">
                <div className="w-12 h-12 bg-purple-500/20 text-purple-400 rounded-xl flex items-center justify-center mb-4">
                  <Tag size={24} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Cupons Próprios</h3>
                <p className="text-slate-400 text-sm">Crie seus próprios cupons de desconto para atrair mais clientes e aumentar suas vendas.</p>
              </div>
              <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-2xl border border-slate-700">
                <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-xl flex items-center justify-center mb-4">
                  <BarChart size={24} />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Painel Completo</h3>
                <p className="text-slate-400 text-sm">Acompanhe cliques, vendas e comissões em tempo real através de um dashboard exclusivo.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modal de Detalhes do Produto */}
      <AnimatePresence>
        {selectedProduct && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
            onClick={closeProductModal}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full max-w-6xl h-[90vh] rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col md:flex-row"
            >
              <button 
                onClick={closeProductModal}
                className="absolute top-6 left-6 z-20 flex items-center gap-2 px-4 py-2 bg-white/90 backdrop-blur-md text-slate-900 rounded-full hover:bg-white transition-colors shadow-lg font-bold text-sm border border-slate-200"
              >
                <ChevronLeft size={20} />
                Voltar
              </button>

              <div className="absolute top-6 right-6 z-20 flex items-center gap-2">
                <button 
                  onClick={() => toggleFavorite(selectedProduct.id)}
                  className={`p-2 rounded-full backdrop-blur-md transition-all shadow-lg border border-slate-200 ${favorites.includes(selectedProduct.id) ? 'bg-pink-500 text-white' : 'bg-white/90 text-slate-400 hover:text-pink-500'}`}
                >
                  <Heart size={24} fill={favorites.includes(selectedProduct.id) ? "currentColor" : "none"} />
                </button>
                <button 
                  onClick={closeProductModal}
                  className="p-2 bg-white/90 backdrop-blur-md text-slate-900 rounded-full hover:bg-white transition-colors shadow-lg border border-slate-200"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Lado Esquerdo: Galeria de Mídia (Fixo) */}
              <div className="w-full h-[40vh] md:w-1/2 lg:w-5/12 md:h-full bg-slate-50 flex flex-col border-r border-slate-100 relative">
                <div className="relative flex-1 flex items-center justify-center group/gallery overflow-hidden p-4 md:p-8">
                  <AnimatePresence mode="wait">
                    {(() => {
                      const allMedia = [
                        ...(selectedProduct.image_url ? [{ url: selectedProduct.image_url, type: 'image' }] : []),
                        ...(selectedProduct.media || [])
                      ];
                      
                      if (allMedia.length > 0) {
                        const currentMedia = allMedia[activeMediaIndex] || allMedia[0];
                        return (
                          <motion.div
                            key={activeMediaIndex}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full h-full flex items-center justify-center"
                          >
                            {currentMedia.type === 'video' ? (
                              <div className="relative w-full h-full flex items-center justify-center bg-black rounded-[32px] overflow-hidden shadow-2xl">
                                <video 
                                  src={currentMedia.url} 
                                  className="w-[90%] h-[90%] object-contain"
                                  autoPlay
                                  muted={isModalMuted}
                                  playsInline
                                  controls
                                  onEnded={() => setActiveMediaIndex((prev) => (prev + 1) % allMedia.length)}
                                />
                              </div>
                            ) : (
                              <img 
                                src={currentMedia.url} 
                                alt={selectedProduct.name} 
                                className="w-[90%] h-[90%] object-contain rounded-[32px] shadow-2xl bg-white"
                                referrerPolicy="no-referrer"
                              />
                            )}
                          </motion.div>
                        );
                      }
                      
                      return (
                        <div className="w-full h-full flex items-center justify-center text-slate-200">
                          <ImageIcon size={120} />
                        </div>
                      );
                    })()}
                  </AnimatePresence>

                  {/* Setas de Navegação na Galeria */}
                  {(() => {
                    const allMedia = [
                      ...(selectedProduct.image_url ? [{ url: selectedProduct.image_url, type: 'image' }] : []),
                      ...(selectedProduct.media || [])
                    ];
                    if (allMedia.length > 1) {
                      return (
                        <>
                          <button 
                            onClick={() => setActiveMediaIndex((prev) => (prev - 1 + allMedia.length) % allMedia.length)}
                            className="absolute left-6 top-1/2 -translate-y-1/2 p-3 bg-black/40 backdrop-blur-md text-white rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity hover:bg-black/60 z-10"
                          >
                            <ChevronLeft size={24} />
                          </button>
                          <button 
                            onClick={() => setActiveMediaIndex((prev) => (prev + 1) % allMedia.length)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-3 bg-black/40 backdrop-blur-md text-white rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity hover:bg-black/60 z-10"
                          >
                            <ChevronRight size={24} />
                          </button>
                        </>
                      );
                    }
                  })()}
                </div>

                {/* Miniaturas da Galeria */}
                {(() => {
                  const allMedia = [
                    ...(selectedProduct.image_url ? [{ url: selectedProduct.image_url, type: 'image' }] : []),
                    ...(selectedProduct.media || [])
                  ];
                  if (allMedia.length > 1) {
                    return (
                      <div className="p-4 bg-slate-800 border-t border-slate-700 shrink-0">
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide justify-center">
                          {allMedia.map((m, idx) => (
                            <button
                              key={idx}
                              onClick={() => setActiveMediaIndex(idx)}
                              className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${idx === activeMediaIndex ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/20' : 'border-transparent opacity-50 hover:opacity-100'}`}
                            >
                              {m.type === 'video' ? (
                                <div className="w-full h-full relative bg-black">
                                  <video 
                                    src={m.url + "#t=0.1"} 
                                    className="w-full h-full object-contain"
                                    muted
                                    playsInline
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                    <Volume2 size={12} className="text-white" />
                                  </div>
                                </div>
                              ) : (
                                <img src={m.url} className="w-full h-full object-contain p-1 bg-white" referrerPolicy="no-referrer" />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }
                })()}
              </div>

              {/* Lado Direito: Info e Compra (Scroll) */}
              <div className="w-full h-[50vh] md:w-1/2 lg:w-7/12 md:h-full flex flex-col bg-white overflow-y-auto scrollbar-hide">
                <div className="p-8 md:p-12 flex flex-col shrink-0">
                  <div className="pt-8 md:pt-0">
                      <h2 className="text-3xl md:text-5xl font-black text-slate-900 italic uppercase tracking-tighter mb-4 leading-tight">
                        {selectedProduct.name}
                      </h2>

                      {selectedProduct.usage_instructions && (
                        <div className="mb-6 p-4 bg-emerald-50 rounded-2xl border border-emerald-100 shadow-sm">
                          <span className="text-[10px] text-emerald-600 uppercase font-black block mb-2 flex items-center gap-1">
                            <Activity size={12} />
                            Como Tomar
                          </span>
                          <p className="text-sm text-slate-700 font-bold leading-relaxed italic">
                            {selectedProduct.usage_instructions}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-col mb-6">
                        {selectedProduct.discount_price !== null && selectedProduct.discount_price !== undefined && selectedProduct.discount_price > 0 ? (
                          <>
                            <span className="text-xl text-slate-400 line-through tracking-tighter">de R$ {selectedProduct.price.toFixed(2)} por</span>
                            <span className="text-4xl font-black text-pink-600 tracking-tighter">R$ {selectedProduct.discount_price.toFixed(2)}</span>
                            <span className="text-sm font-bold text-emerald-600 mt-1">no PIX (5% de desconto)</span>
                            <span className="text-sm text-slate-500 mt-1">
                              ou em até {calculateInstallments(selectedProduct.discount_price, selectedProduct.min_installment_value).count}x de R$ {calculateInstallments(selectedProduct.discount_price, selectedProduct.min_installment_value).value.toFixed(2)} sem juros
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">R$ {selectedProduct.price.toFixed(2)}</span>
                            <span className="text-sm font-bold text-emerald-600 mt-1">no PIX (5% de desconto)</span>
                            <span className="text-sm text-slate-500 mt-1">
                              ou em até {calculateInstallments(selectedProduct.price, selectedProduct.min_installment_value).count}x de R$ {calculateInstallments(selectedProduct.price, selectedProduct.min_installment_value).value.toFixed(2)} sem juros
                            </span>
                          </>
                        )}
                      </div>

                      {/* Venda Escalonada (Tiers) */}
                      {selectedProduct.tiers && selectedProduct.tiers.length > 0 && (
                        <div className="mb-8">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-4 flex items-center gap-2">
                            <ShieldCheck size={14} />
                            Ofertas Progressivas (Leve mais, pague menos)
                          </h4>
                          <div className="grid grid-cols-1 gap-3">
                            {selectedProduct.tiers.sort((a, b) => a.quantity - b.quantity).map((tier, idx) => {
                              const unitPrice = selectedProduct.price * (1 - tier.discount_percentage / 100);
                              const total = unitPrice * tier.quantity;
                              return (
                                <button 
                                  key={idx}
                                  onClick={() => setQuantity(tier.quantity)}
                                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${quantity === tier.quantity ? 'border-emerald-600 bg-emerald-50 shadow-lg shadow-emerald-100' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                >
                                  <div className="text-left">
                                    <span className="block font-black text-slate-900 uppercase italic tracking-tighter">Leve {tier.quantity} Unidades</span>
                                    <span className="text-xs font-bold text-emerald-600">Economize {tier.discount_percentage}%</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="block font-black text-slate-900">R$ {total.toFixed(2)}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase">R$ {unitPrice.toFixed(2)} / un</span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Calculadora de Frete */}
                      <div className="mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 text-slate-700 font-bold mb-3">
                          <Truck size={20} className="text-emerald-600" />
                          Calcular Frete e Prazo
                        </div>
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="Digite seu CEP" 
                            value={cep}
                            onChange={(e) => setCep(e.target.value)}
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                          <button 
                            onClick={handleCalculateShipping}
                            disabled={calculatingShipping}
                            className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors"
                          >
                            {calculatingShipping ? '...' : 'OK'}
                          </button>
                        </div>
                        <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
                          Não sei meu CEP
                        </a>
                        
                        {/* Resultados do Frete */}
                        {(calculatingShipping || city || shippingQuotes.length > 0) && (
                          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            {calculatingShipping ? (
                              <div className="p-4 bg-slate-100 rounded-xl flex items-center justify-center gap-3">
                                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-sm font-bold text-slate-600">Calculando frete...</span>
                              </div>
                            ) : (
                              <>
                                {city && (
                                  <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center gap-2">
                                    <Package size={16} className="text-emerald-600" />
                                    <span className="text-sm font-bold text-emerald-700">Entrega para: {city}</span>
                                  </div>
                                )}

                                {shippingQuotes.length > 0 ? (
                                  <div className="space-y-2">
                                    {shippingQuotes.map((quote, index) => (
                                      <div key={index} className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-200 text-sm shadow-sm hover:border-emerald-200 transition-all">
                                        <div className="flex flex-col">
                                          <span className="font-bold text-slate-700">{quote.carrier_name}</span>
                                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Prazo: {quote.deadline} dias</span>
                                        </div>
                                        <span className="font-black text-emerald-600 text-base">
                                          {quote.price === 0 ? 'Frete Grátis' : `R$ ${quote.price.toFixed(2)}`}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : city && (
                                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-700 font-bold">
                                    Nenhuma transportadora disponível para este CEP.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-4 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-4 bg-slate-100 p-2 rounded-2xl">
                            <button 
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center font-bold hover:bg-slate-200 transition-colors shadow-sm"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-black text-xl text-slate-900">{quantity}</span>
                            <button 
                              onClick={() => setQuantity(quantity + 1)}
                              className="w-10 h-10 bg-white text-slate-900 rounded-xl flex items-center justify-center font-bold hover:bg-slate-200 transition-colors shadow-sm"
                            >
                              +
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => addToCart(selectedProduct, quantity)}
                            className="flex-1 bg-pink-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-pink-700 transition-colors shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 uppercase tracking-wider"
                          >
                            <ShoppingBag size={24} />
                            Comprar
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => window.open('https://wa.me/5547996609618?text=Olá, gostaria de comprar o produto ' + selectedProduct.name, '_blank')}
                          className="w-full bg-[#25D366] text-white py-3 rounded-2xl font-bold text-sm hover:bg-[#128C7E] transition-colors shadow-lg shadow-[#25D366]/30 flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                          <Phone size={20} />
                          Comprar pelo WhatsApp
                        </button>

                        <button 
                          onClick={() => toggleFavorite(selectedProduct.id)}
                          className={`w-full py-3 rounded-2xl border-2 flex items-center justify-center gap-2 font-bold transition-all uppercase text-sm tracking-wider ${favorites.includes(selectedProduct.id) ? 'border-pink-500 bg-pink-50 text-pink-600' : 'border-slate-100 text-slate-400 hover:border-pink-200 hover:text-pink-500'}`}
                        >
                          <Heart size={20} fill={favorites.includes(selectedProduct.id) ? "currentColor" : "none"} />
                          {favorites.includes(selectedProduct.id) ? 'Remover dos Favoritos' : 'Adicionar aos Favoritos'}
                        </button>
                      </div>

                      {/* Descrição e Benefícios */}
                      <div className="mt-8 border-t border-slate-100 pt-8">
                        <h3 className="font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Star size={18} className="text-amber-400" />
                          Por que escolher?
                        </h3>
                        <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6">
                          <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <Activity size={16} />
                            Informações do Produto
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] text-slate-400 uppercase font-black block mb-1">Conteúdo</span>
                              <span className="text-lg font-black text-slate-900">{selectedProduct.quantity_info || '60 cápsulas'}</span>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
                              <span className="text-[10px] text-slate-400 uppercase font-black block mb-1">Fórmula</span>
                              <span className="text-lg font-black text-slate-900">Premium</span>
                            </div>
                          </div>
                          
                          {selectedProduct.composition && (
                            <div className="mt-4 pt-4 border-t border-emerald-100">
                              <span className="text-[10px] text-slate-400 uppercase font-black block mb-2">Composição</span>
                              <p className="text-sm text-slate-700 font-medium leading-relaxed">
                                {selectedProduct.composition}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="bg-emerald-50 rounded-2xl p-6 mb-6 border border-emerald-100">
                          <ul className="space-y-4">
                            <li className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                              <div className="mt-0.5 bg-emerald-200 p-1.5 rounded-full text-emerald-700 shadow-sm"><ShieldCheck size={14} /></div>
                              <span><strong>Fórmula Exclusiva:</strong> Desenvolvido com tecnologia de ponta para garantir a máxima absorção e eficácia.</span>
                            </li>
                            <li className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                              <div className="mt-0.5 bg-emerald-200 p-1.5 rounded-full text-emerald-700 shadow-sm"><Zap size={14} /></div>
                              <span><strong>Resultados Rápidos:</strong> Sinta a diferença em poucas semanas de uso contínuo e adequado.</span>
                            </li>
                            <li className="flex items-start gap-3 text-slate-700 text-sm font-medium">
                              <div className="mt-0.5 bg-emerald-200 p-1.5 rounded-full text-emerald-700 shadow-sm"><Leaf size={14} /></div>
                              <span><strong>100% Natural:</strong> Ingredientes selecionados rigorosamente, sem aditivos químicos prejudiciais.</span>
                            </li>
                          </ul>
                        </div>

                        <details className="group cursor-pointer bg-slate-50 p-6 rounded-2xl border border-slate-100">
                          <summary className="font-black text-slate-900 uppercase tracking-widest flex items-center justify-between outline-none">
                            Descrição Completa
                            <ChevronRight size={20} className="group-open:rotate-90 transition-transform text-pink-600" />
                          </summary>
                          <div className="pt-6 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap font-medium">
                            {selectedProduct.description || "Descrição detalhada do produto não disponível no momento."}
                          </div>
                        </details>

                        <div className="mt-6">
                          <button 
                            onClick={() => {
                              addToCart(selectedProduct, quantity);
                              toast.success('Produto adicionado ao carrinho!');
                            }}
                            className="w-full bg-gradient-to-r from-pink-600 to-purple-600 text-white py-4 rounded-2xl font-black text-lg hover:from-pink-700 hover:to-purple-700 transition-all shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 uppercase tracking-wider transform hover:scale-[1.02] animate-pulse"
                          >
                            <ShoppingBag size={24} />
                            Quero Garantir o Meu Agora!
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Produtos Relacionados */}
                <div className="bg-slate-50 p-8 md:p-12 border-t border-slate-100 shrink-0 mt-auto">
                  <h3 className="text-xl font-black text-slate-900 italic uppercase tracking-tighter mb-6 flex items-center gap-2">
                    <ShoppingBag size={20} className="text-pink-600" />
                    Aproveite e leve também
                  </h3>
                  <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {products.filter(p => p.id !== selectedProduct.id).slice(0, 4).map(related => (
                      <div key={related.id} className="min-w-[180px] w-[180px] bg-white p-3 rounded-2xl shadow-sm border border-slate-200 group cursor-pointer hover:border-pink-300 hover:shadow-md transition-all flex flex-col" onClick={() => { setSelectedProduct(related); setQuantity(1); }}>
                        <div className="aspect-square bg-slate-50 rounded-xl mb-3 overflow-hidden relative">
                          {related.image_url ? (
                            <img src={related.image_url} alt={related.name} className="w-full h-full object-contain p-2 group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24} /></div>
                          )}
                          {related.discount_price && related.discount_price > 0 && (
                            <div className="absolute top-2 right-2 bg-pink-600 text-white text-[10px] font-black px-2 py-1 rounded-full uppercase">
                              Oferta
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 text-xs line-clamp-2 mb-2 flex-1">{related.name}</h4>
                        <div className="mt-auto">
                          {related.discount_price && related.discount_price > 0 ? (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400 line-through">R$ {related.price.toFixed(2)}</span>
                              <span className="text-sm font-black text-pink-600">R$ {related.discount_price.toFixed(2)}</span>
                            </div>
                          ) : (
                            <span className="text-sm font-black text-slate-900">R$ {related.price.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Favoritos */}
      <AnimatePresence>
        {showFavorites && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex justify-end bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowFavorites(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white">
                <div className="flex items-center gap-3">
                  <Heart size={24} fill="currentColor" />
                  <h2 className="text-xl font-black italic uppercase tracking-tighter">Meus Favoritos</h2>
                </div>
                <button onClick={() => setShowFavorites(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {favorites.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-slate-400">
                    <Heart size={64} className="mb-4 opacity-10" />
                    <p className="font-bold">Sua lista de desejos está vazia</p>
                    <p className="text-sm">Favorite produtos para vê-los aqui!</p>
                  </div>
                ) : (
                  favorites.map(favId => {
                    const product = products.find(p => p.id === favId);
                    if (!product) return null;
                    return (
                      <div key={favId} className="flex gap-4 group cursor-pointer" onClick={() => { setSelectedProduct(product); setShowFavorites(false); }}>
                        <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 flex-shrink-0">
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2" />
                        </div>
                        <div className="flex-1 flex flex-col justify-center">
                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{product.name}</h4>
                          <p className="text-emerald-600 font-black text-sm">R$ {(product.discount_price || product.price).toFixed(2)}</p>
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(favId); }}
                            className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-1 hover:underline"
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button 
                  onClick={() => setShowFavorites(false)}
                  className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all"
                >
                  Continuar Comprando
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal do Carrinho */}
      <AnimatePresence>
        {showCart && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-end md:items-center justify-end md:p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowCart(false)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white w-full md:w-[450px] h-[90vh] md:h-full md:max-h-[800px] md:rounded-[40px] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-pink-600 text-white">
                <div className="flex items-center gap-3">
                  <ShoppingBag size={28} />
                  <h2 className="text-2xl font-black uppercase italic tracking-tighter">Meu Carrinho</h2>
                </div>
                <button onClick={() => setShowCart(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Barra de Progresso Frete Grátis */}
                {cartTotal > 0 && Number(settings?.free_shipping_threshold) > 0 && (
                  <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100 mb-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                        {cartTotal >= Number(settings?.free_shipping_threshold) 
                          ? "🎉 Frete Grátis Liberado!" 
                          : `Faltam R$ ${(Number(settings?.free_shipping_threshold) - cartTotal).toFixed(2)}`}
                      </p>
                      <Truck size={16} className={cartTotal >= Number(settings?.free_shipping_threshold) ? 'text-emerald-600' : 'text-slate-400'} />
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-3 overflow-hidden shadow-inner">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min((cartTotal / Number(settings?.free_shipping_threshold)) * 100, 100)}%` }}
                        className={`h-full rounded-full transition-all duration-700 ${cartTotal >= Number(settings?.free_shipping_threshold) ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-indigo-500'}`}
                      />
                    </div>
                    {cartTotal < Number(settings?.free_shipping_threshold) && (
                      <p className="text-[10px] text-emerald-600 font-bold mt-2 text-center uppercase tracking-widest">
                        Adicione mais R$ {(Number(settings?.free_shipping_threshold) - cartTotal).toFixed(2)} para ganhar frete grátis
                      </p>
                    )}
                  </div>
                )}

                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center py-12">
                    <ShoppingBag size={64} className="mb-4 opacity-20" />
                    <p className="font-bold">Seu carrinho está vazio</p>
                    <button 
                      onClick={() => setShowCart(false)}
                      className="mt-4 text-pink-600 font-bold hover:underline"
                    >
                      Continuar Comprando
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => {
                      const { unitPrice, total } = calculatePrice(item.product, item.quantity);
                      return (
                        <div key={item.product.id} className="flex gap-4 bg-white p-4 rounded-[24px] border border-slate-100 shadow-sm group">
                          <div className="w-20 h-20 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 border border-slate-100">
                            {item.product.image_url ? (
                              <img src={item.product.image_url} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={24} /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-slate-900 truncate text-sm">{item.product.name}</h4>
                              <p className="text-xs text-slate-500">{item.quantity}x R$ {unitPrice.toFixed(2)}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="font-black text-emerald-600">R$ {total.toFixed(2)}</span>
                              <button 
                                onClick={() => removeFromCart(item.product.id)}
                                className="text-slate-400 hover:text-rose-500 text-xs font-bold transition-colors"
                              >
                                Remover
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Produtos Relacionados (Upsell) no Carrinho */}
                {cart.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Aproveite e leve também</h4>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                      {products.filter(p => !cart.find(c => c.product.id === p.id)).slice(0, 3).map(related => (
                        <div key={related.id} className="min-w-[140px] bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col">
                          <div className="aspect-square bg-slate-50 rounded-xl mb-2 overflow-hidden">
                            {related.image_url ? (
                              <img src={related.image_url} alt={related.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={20} /></div>
                            )}
                          </div>
                          <h5 className="font-bold text-slate-900 truncate text-xs mb-1">{related.name}</h5>
                          <span className="text-emerald-600 font-black text-sm mb-2">R$ {(related.discount_price || related.price).toFixed(2)}</span>
                          <button 
                            onClick={() => addToCart(related, 1)}
                            className="mt-auto w-full bg-slate-900 text-white font-bold py-1.5 rounded-lg hover:bg-slate-800 transition-colors uppercase text-[10px] tracking-wider"
                          >
                            Adicionar
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 bg-slate-50 border-t border-slate-100">
                  <div className="flex flex-col mb-6">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-500 font-bold">Subtotal</span>
                      <span className={`font-black text-slate-900 tracking-tighter ${discountValue > 0 ? 'text-xl line-through opacity-50' : 'text-3xl'}`}>
                        R$ {cartTotal.toFixed(2)}
                      </span>
                    </div>

                    {selectedShippingQuote && (
                      <div className="flex items-center justify-between mb-1 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Truck size={14} className="text-emerald-600" />
                          <span className="text-xs font-bold uppercase tracking-wider">Frete ({selectedShippingQuote.name})</span>
                        </div>
                        <span className="text-lg font-black tracking-tighter">
                          {isFreeShipping ? 'GRÁTIS' : `R$ ${selectedShippingQuote.price.toFixed(2)}`}
                        </span>
                      </div>
                    )}
                    
                    {discountValue > 0 && (
                      <div className="flex items-center justify-between mb-2 text-emerald-600">
                        <div className="flex items-center gap-1">
                          <Tag size={14} />
                          <span className="text-sm font-bold uppercase">Cupom {affiliateCoupon.code}</span>
                        </div>
                        <span className="text-2xl font-black tracking-tighter">- R$ {discountValue.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-900 font-black uppercase text-sm">Total</span>
                      <span className="text-4xl font-black text-slate-900 tracking-tighter">R$ {finalTotal.toFixed(2)}</span>
                    </div>

                    <p className="text-right text-xs font-bold text-slate-400 uppercase tracking-widest">
                      ou em até {(() => {
                        const minInstallmentValue = cart.reduce((min, item) => {
                          const productMin = item.product.min_installment_value || 50;
                          return productMin < min ? productMin : min;
                        }, 50);
                        const maxInstallments = 10;
                        let possibleInstallments = Math.floor(finalTotal / minInstallmentValue);
                        if (possibleInstallments > maxInstallments) possibleInstallments = maxInstallments;
                        if (possibleInstallments < 1) possibleInstallments = 1;
                        return possibleInstallments;
                      })()}x de R$ {(finalTotal / (() => {
                        const minInstallmentValue = cart.reduce((min, item) => {
                          const productMin = item.product.min_installment_value || 50;
                          return productMin < min ? productMin : min;
                        }, 50);
                        const maxInstallments = 10;
                        let possibleInstallments = Math.floor(finalTotal / minInstallmentValue);
                        if (possibleInstallments > maxInstallments) possibleInstallments = maxInstallments;
                        if (possibleInstallments < 1) possibleInstallments = 1;
                        return possibleInstallments;
                      })()).toFixed(2)} sem juros
                    </p>
                  </div>
                  <button 
                    onClick={() => navigate('/checkout')}
                    className="w-full bg-emerald-600 text-white py-6 rounded-[32px] font-black text-xl uppercase italic tracking-tighter hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3"
                  >
                    Finalizar Compra
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-4 uppercase font-bold tracking-widest">
                    Pagamento 100% Seguro via Mercado Pago
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between z-[90] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <button 
          onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); setSearchTerm(''); }}
          className={`flex flex-col items-center gap-1 ${!searchTerm ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <Star size={20} fill={!searchTerm ? "currentColor" : "none"} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Início</span>
        </button>
        <button 
          onClick={() => { document.querySelector('input')?.focus(); }}
          className="flex flex-col items-center gap-1 text-slate-400"
        >
          <Search size={20} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Busca</span>
        </button>
        <button 
          onClick={() => setShowFavorites(true)}
          className={`flex flex-col items-center gap-1 ${showFavorites ? 'text-pink-600' : 'text-slate-400'}`}
        >
          <div className="relative">
            <Heart size={20} fill={favorites.length > 0 ? "currentColor" : "none"} />
            {favorites.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                {favorites.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Desejos</span>
        </button>
        <button 
          onClick={() => setShowCart(true)}
          className={`flex flex-col items-center gap-1 ${showCart ? 'text-emerald-600' : 'text-slate-400'}`}
        >
          <div className="relative">
            <ShoppingBag size={20} fill={cart.length > 0 ? "currentColor" : "none"} />
            {cart.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-pink-500 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                {cart.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Sacola</span>
        </button>
      </div>

      {/* Modal de Campanha */}

      {/* Modal de Campanha */}
      <AnimatePresence>
        {selectedCampaign && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedCampaign(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-emerald-600 text-white">
                <div className="flex items-center gap-3">
                  {selectedCampaign.image_url ? (
                    <img src={selectedCampaign.image_url} alt={selectedCampaign.title} className="w-8 h-8 object-contain" />
                  ) : (
                    <Zap size={24} />
                  )}
                  <h3 className="text-xl font-black uppercase italic tracking-tight">
                    {selectedCampaign.title}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-8">
                {selectedCampaign.subtitle && (
                  <p className="text-lg font-bold text-emerald-600 mb-6 text-center">
                    {selectedCampaign.subtitle}
                  </p>
                )}
                <div className="prose prose-slate prose-sm max-w-none">
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedCampaign.rules_text}
                  </p>
                </div>

                {selectedCampaign.coupon_code && (
                  <div className="mt-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                    <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mb-3">Use este cupom no checkout:</p>
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-white border-2 border-dashed border-emerald-300 px-8 py-3 rounded-xl text-2xl font-black text-emerald-700 tracking-widest">
                        {selectedCampaign.coupon_code}
                      </div>
                      <button 
                        onClick={() => {
                          applyCoupon(selectedCampaign.coupon_code!);
                          setSelectedCampaign(null);
                        }}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 text-white rounded-full font-bold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-emerald-200"
                      >
                        <Zap size={18} />
                        Aplicar Agora
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 pt-6 border-t border-slate-100 flex justify-center gap-4">
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="bg-slate-100 text-slate-700 px-8 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors uppercase tracking-wider text-sm"
                  >
                    Fechar
                  </button>
                  {selectedCampaign.link_url && (
                    <button
                      onClick={() => {
                        window.location.href = selectedCampaign.link_url!;
                      }}
                      className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors uppercase tracking-wider text-sm"
                    >
                      Aproveitar
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            
            {/* Institucional */}
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Institucional</h4>
              <ul className="space-y-4">
                {settings?.institutional_links?.map((link, idx) => (
                  <li key={idx}>
                    <button 
                      onClick={() => {
                        if (link.content) {
                          setSelectedInstitutionalLink({ label: link.label, content: link.content });
                        } else if (link.url) {
                          window.location.href = link.url;
                        }
                      }}
                      className="text-slate-600 hover:text-emerald-600 transition-colors text-sm text-left"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
                {!settings?.institutional_links?.length && (
                  <>
                    <li><a href="#" className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Sobre nós</a></li>
                    <li><a href="#" className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Política de Frete</a></li>
                  </>
                )}
                
                {settings?.affiliate_terms && (
                  <li>
                    <button 
                      onClick={() => setSelectedInstitutionalLink({ label: 'Termos de Afiliados', content: settings.affiliate_terms })}
                      className="text-slate-600 hover:text-emerald-600 transition-colors text-sm text-left"
                    >
                      Termos e condições de afiliados
                    </button>
                  </li>
                )}
              </ul>
              <div className="flex gap-4 mt-6 flex-wrap">
                {settings?.social_links?.filter(l => l.active).map((link, idx) => {
                  const Icon = link.platform === 'Instagram' ? Instagram :
                               link.platform === 'Facebook' ? Facebook :
                               link.platform === 'Twitter' ? Twitter :
                               link.platform === 'Youtube' ? Youtube :
                               link.platform === 'Linkedin' ? Linkedin :
                               Megaphone; // Fallback
                  
                  return (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm hover:shadow-md">
                      <Icon size={20} />
                    </a>
                  );
                })}
                
                {/* Fallback para legado */}
                {(!settings?.social_links || settings.social_links.length === 0) && (
                  <>
                    {settings?.instagram && (
                      <a href={settings.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform">
                        <Instagram size={20} />
                      </a>
                    )}
                    {settings?.facebook && (
                      <a href={settings.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white hover:scale-110 transition-transform">
                        <Facebook size={20} />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Categorias */}
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Categorias</h4>
              <ul className="space-y-4">
                <li>
                  <button 
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedCategoryId(null);
                      setSelectedProductId(null);
                      scrollToProducts();
                    }}
                    className="text-slate-600 hover:text-emerald-600 transition-colors text-sm text-left"
                  >
                    Todos os Produtos
                  </button>
                </li>
                {categories.map(cat => (
                  <li key={cat.id}>
                    <button 
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSelectedCategoryId(null);
                        setSelectedProductId(null);
                        scrollToProducts();
                      }}
                      className="text-slate-600 hover:text-emerald-600 transition-colors text-sm text-left"
                    >
                      {cat.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sua Conta */}
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Sua Conta</h4>
              <ul className="space-y-4">
                <li><button onClick={() => navigate('/login')} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Minha conta / Cadastro</button></li>
                <li><button onClick={() => navigate('/profile')} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Minhas compras</button></li>
                <li><button onClick={() => setShowCart(true)} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Meu carrinho</button></li>
                <li><button onClick={() => navigate('/profile')} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Meus produtos favoritos</button></li>
                <li><button onClick={() => navigate('/affiliates')} className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors text-sm uppercase tracking-widest">Seja um Afiliado</button></li>
              </ul>

              <h4 className="font-bold text-slate-900 mb-6 mt-8 uppercase tracking-wider text-sm">Precisa de Ajuda?</h4>
              <ul className="space-y-4">
                <li><button onClick={() => window.open(`https://wa.me/${settings?.whatsapp?.replace(/\D/g, '')}`, '_blank')} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Fale Conosco via WhatsApp</button></li>
                <li><a href={`mailto:${settings?.email}`} className="text-slate-600 hover:text-emerald-600 transition-colors text-sm">Enviar E-mail</a></li>
              </ul>
            </div>

            {/* Atendimento */}
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Atendimento</h4>
              <div className="space-y-4 text-sm text-slate-600">
                <p className="font-bold text-slate-900">HORÁRIO DE ATENDIMENTO:</p>
                <p className="italic">{settings?.business_hours || "Segunda a Sexta - 8h ás 18h"}</p>
                
                <p className="font-bold text-slate-900 mt-6">CONTATO:</p>
                {settings?.whatsapp && <p>{settings.whatsapp} - Whatsapp</p>}
                {settings?.phone && <p>{settings.phone} - Fixo</p>}
                {settings?.email && <p>{settings.email}</p>}

                {settings?.address && (
                  <>
                    <p className="font-bold text-slate-900 mt-6">ENDEREÇO:</p>
                    <p>{settings.address}</p>
                    {settings.cep && <p>CEP: {settings.cep}</p>}
                  </>
                )}
                
                {settings?.business_hours_details && (
                  <div className="mt-4 text-xs whitespace-pre-wrap">
                    {settings.business_hours_details}
                  </div>
                )}
              </div>
            </div>

            {/* Formas de Pagamento e Segurança */}
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Formas de Pagamento</h4>
              <div className="grid grid-cols-2 gap-2 mb-8">
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <QrCode size={16} /> PIX
                </div>
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <CreditCard size={16} /> Cartão
                </div>
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <Barcode size={16} /> Boleto
                </div>
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <Landmark size={16} /> Transferência
                </div>
              </div>

              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Formas de Envio</h4>
              <div className="grid grid-cols-1 gap-2 mb-8">
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <Truck size={16} /> Correios
                </div>
                <div className="h-10 px-3 bg-slate-50 rounded border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 uppercase">
                  <Package size={16} /> Transportadora
                </div>
              </div>

              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-wider text-sm">Segurança</h4>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-center border border-slate-200 rounded-lg p-2">
                  <div className="flex items-center gap-1 text-amber-400">
                    <Star size={16} fill="currentColor" />
                    <span className="font-bold text-slate-900">5.0</span>
                  </div>
                  <span className="text-[10px] text-slate-500">Avaliações</span>
                </div>
                <div className="flex items-center gap-2 border border-slate-200 rounded-lg p-2">
                  <ShieldCheck size={24} className="text-emerald-600" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-900">Google</span>
                    <span className="text-[10px] text-slate-500">Safe browsing</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-slate-200 bg-slate-50 py-4">
          <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-500">
            {settings?.company_name || "MAGNIFIQUE 4LIFE"} ® - Todos os direitos reservados {settings?.cnpj && `- CNPJ ${settings.cnpj}`}
            <DebugModeIndicator active={settings?.debug_mode} />
          </div>
        </div>
      </footer>

      {/* Modal de Link Institucional */}
      {selectedInstitutionalLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-900">{selectedInstitutionalLink.label}</h3>
              <button 
                onClick={() => setSelectedInstitutionalLink(null)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-500" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="prose prose-slate max-w-none whitespace-pre-wrap text-slate-600">
                {selectedInstitutionalLink.content}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setSelectedInstitutionalLink(null)}
                className="px-6 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {/* Chat Inteligente */}
    </div>
  );
}

