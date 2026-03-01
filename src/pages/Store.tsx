import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, ShieldCheck, User, ChevronLeft, ChevronRight, 
  Volume2, VolumeX, Image as ImageIcon, X, Search, Menu, 
  Heart, Truck, CreditCard, Phone, Instagram, Facebook,
  Star, Zap, Leaf, Droplets, Activity, Flame, Megaphone
} from 'lucide-react';

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
  tiers: ProductTier[];
  media: ProductMedia[];
}

export default function Store() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isModalMuted, setIsModalMuted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // Carrinho
  const [cart, setCart] = useState<{ product: Product, quantity: number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  
  // Detalhes do Produto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (data?.role === 'admin') {
          setIsAdmin(true);
        }
      }
    };
    
    const fetchData = async () => {
      const [bannerRes, prodRes, catRes, campRes] = await Promise.all([
        supabase.from('banners').select('*').eq('active', true).order('created_at', { ascending: true }),
        supabase.from('products')
          .select('*, tiers:product_tiers(*), media:product_media(*)')
          .eq('active', true)
          .order('created_at', { ascending: false })
          .order('position', { foreignTable: 'product_media', ascending: true }),
        supabase.from('categories').select('*').order('name'),
        supabase.from('campaigns').select('*').eq('active', true).order('display_order', { ascending: true })
      ]);
      
      setBanners(bannerRes.data || []);
      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
      setCampaigns(campRes.data || []);
      
      // Check for affiliate link
      const urlParams = new URLSearchParams(window.location.search);
      const campaignId = urlParams.get('campaign');
      if (campaignId && campRes.data) {
        const campaign = campRes.data.find((c: Campaign) => c.id === campaignId);
        if (campaign) {
          setSelectedCampaign(campaign);
        }
      }
    };

    checkUser();
    fetchData();
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
    setSelectedProduct(null);
    setShowCart(true);
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((acc, item) => {
    const { total } = calculatePrice(item.product, item.quantity);
    return acc + total;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Bar */}
      <div className="bg-emerald-800 text-white text-[10px] md:text-xs font-medium py-2 px-4 text-center tracking-wide">
        Envio Brasil | 7 dias devolução | 10x sem juros | WhatsApp (47)99660-9618
      </div>

      {/* Header da Loja */}
      <header className="bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between gap-4 md:gap-8">
          {/* Logo & Tagline */}
          <div className="flex flex-col cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="flex items-center gap-1 font-black text-2xl md:text-3xl tracking-tighter">
              <Leaf size={28} className="text-emerald-600" />
              <span className="text-emerald-800">G-Fit</span>
              <span className="text-cyan-700">Life</span>
            </div>
            <span className="text-[9px] md:text-[10px] text-slate-500 font-medium hidden md:block uppercase tracking-widest mt-0.5">
              Saúde, Beleza e Emagrecimento
            </span>
          </div>

          {/* Busca Central */}
          <div className="flex-1 max-w-2xl hidden md:flex relative">
            <input 
              type="text" 
              placeholder="O que você está buscando hoje?"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-full outline-none focus:ring-2 focus:ring-emerald-600 transition-all font-medium placeholder:text-slate-400"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors">
              <Search size={18} />
            </button>
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
            </button>
          </div>
        </div>
      </header>

      {/* Categorias (Ícones) */}
      <div className="bg-white border-b border-slate-100 py-4 overflow-x-auto scrollbar-hide">
        <div className="max-w-7xl mx-auto px-4 flex gap-8 min-w-max">
          <button 
            onClick={() => setSearchTerm('')}
            className={`flex flex-col items-center gap-2 group ${!searchTerm ? 'text-emerald-600' : 'text-slate-500 hover:text-emerald-600'}`}
          >
            <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${!searchTerm ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-200'}`}>
              <Star size={24} className={!searchTerm ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'} />
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
            
            const isActive = searchTerm.toLowerCase() === cat.name.toLowerCase();
            
            return (
              <button 
                key={cat.id}
                onClick={() => setSearchTerm(isActive ? '' : cat.name)}
                className={`flex flex-col items-center gap-2 group ${isActive ? 'text-emerald-600' : 'text-slate-500 hover:text-emerald-600'}`}
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-slate-50 border border-slate-100 group-hover:bg-emerald-50 group-hover:border-emerald-200'}`}>
                  <IconComponent size={24} className={isActive ? 'text-emerald-600' : 'text-slate-400 group-hover:text-emerald-600'} />
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
                  className="cursor-pointer bg-black text-white rounded-xl p-4 flex flex-col items-center justify-center text-center w-full sm:w-[calc(50%-1rem)] md:w-[calc(33.333%-1rem)] lg:w-[calc(20%-1rem)] min-h-[120px] shadow-lg border border-slate-800"
                >
                  {campaign.image_url && (
                    <img src={campaign.image_url} alt={campaign.title} className="w-8 h-8 object-contain mb-2" />
                  )}
                  <h4 className="font-black italic uppercase text-lg leading-tight mb-1">
                    {campaign.title}
                  </h4>
                  {campaign.subtitle && (
                    <p className="text-xs font-medium text-emerald-400">
                      {campaign.subtitle}
                    </p>
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
            <h3 className="text-center text-2xl md:text-3xl font-black italic uppercase tracking-tight text-slate-900 mb-8">
              CAMPANHAS E PROMOÇÕES
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.filter(c => !c.is_highlight).map((campaign) => (
                <motion.div
                  key={campaign.id}
                  whileHover={{ y: -5, scale: 1.02 }}
                  onClick={() => setSelectedCampaign(campaign)}
                  className="cursor-pointer bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-100 group"
                >
                  {campaign.image_url ? (
                    <div className="aspect-video w-full overflow-hidden">
                      <img 
                        src={campaign.image_url} 
                        alt={campaign.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <Megaphone size={48} />
                    </div>
                  )}
                  <div className="p-6 text-center">
                    <h4 className="font-black italic uppercase text-xl text-slate-900 mb-2">
                      {campaign.title}
                    </h4>
                    {campaign.subtitle && (
                      <p className="text-sm text-slate-600">
                        {campaign.subtitle}
                      </p>
                    )}
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
            Novidades da Estação
          </h1>
          <p className="text-slate-500 text-lg max-w-2xl mx-auto">
            Confira as últimas tendências e ofertas exclusivas que preparamos para você.
          </p>
        </div>

        {/* Grid de Produtos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {products.filter(p => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            // Verifica se o termo de busca bate com o nome do produto ou com a categoria
            const matchName = p.name.toLowerCase().includes(term);
            const matchCategory = categories.find(c => c.id === (p as any).category_id)?.name.toLowerCase() === term;
            return matchName || matchCategory;
          }).map((product) => (
            <motion.div 
              key={product.id}
              whileHover={{ y: -10 }}
              onClick={() => { setSelectedProduct(product); setQuantity(1); }}
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
                
                {/* Badge de Desconto se houver tiers */}
                {product.tiers && product.tiers.length > 0 && (
                  <div className="absolute top-4 left-4 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic tracking-tighter shadow-lg">
                    Leve mais, pague menos
                  </div>
                )}
              </div>
              <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
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
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProduct(product);
                  setQuantity(1);
                }}
                className="w-full mt-4 bg-emerald-600 text-white font-bold py-2 rounded-lg hover:bg-emerald-700 transition-colors uppercase text-sm tracking-wider"
              >
                Comprar
              </button>
            </motion.div>
          ))}
          {products.filter(p => {
            if (!searchTerm) return true;
            const term = searchTerm.toLowerCase();
            const matchName = p.name.toLowerCase().includes(term);
            const matchCategory = categories.find(c => c.id === (p as any).category_id)?.name.toLowerCase() === term;
            return matchName || matchCategory;
          }).length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500">
              Nenhum produto encontrado para "{searchTerm}".
            </div>
          )}
        </div>

        {products.length === 0 && (
          <div className="text-center py-20">
            <ShoppingBag className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhum produto disponível no momento</h3>
            <p className="text-slate-500">Volte em breve para conferir nossas novidades.</p>
          </div>
        )}
      </main>

      {/* Promoções da Semana */}
      <section className="max-w-7xl mx-auto px-4 py-12 mb-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-black text-slate-900 mb-2 italic uppercase tracking-tighter">
            Promoções da Semana
          </h2>
          <div className="w-24 h-1 bg-pink-500 mx-auto rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Banner 1 */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-pink-600 to-pink-400 aspect-[21/9] md:aspect-[16/9] lg:aspect-[21/9] flex items-center shadow-lg group cursor-pointer">
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors z-10"></div>
            <div className="relative z-20 p-8 md:p-12 w-2/3">
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-widest rounded-full mb-4">
                Oferta Exclusiva
              </span>
              <h3 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">
                Até 33% <br/> OFF
              </h3>
              <p className="text-white/90 font-medium mb-6 text-sm md:text-base">
                Em toda linha de suplementos e vitaminas.
              </p>
              <button className="bg-white text-pink-600 font-black px-6 py-3 rounded-full hover:bg-pink-50 transition-colors uppercase text-sm tracking-wider shadow-lg">
                Ver Agora
              </button>
            </div>
            {/* Imagem decorativa (placeholder) */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[url('https://images.unsplash.com/photo-1593095948071-474c5cc2989d?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-50 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"></div>
          </div>

          {/* Banner 2 */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-400 aspect-[21/9] md:aspect-[16/9] lg:aspect-[21/9] flex items-center shadow-lg group cursor-pointer">
            <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors z-10"></div>
            <div className="relative z-20 p-8 md:p-12 w-2/3">
              <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold uppercase tracking-widest rounded-full mb-4">
                Lançamento
              </span>
              <h3 className="text-3xl md:text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-2">
                Novos <br/> Combos
              </h3>
              <p className="text-white/90 font-medium mb-6 text-sm md:text-base">
                Potencialize seus resultados com nossos kits.
              </p>
              <button className="bg-white text-emerald-600 font-black px-6 py-3 rounded-full hover:bg-emerald-50 transition-colors uppercase text-sm tracking-wider shadow-lg">
                Aproveite Já
              </button>
            </div>
            {/* Imagem decorativa (placeholder) */}
            <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-[url('https://images.unsplash.com/photo-1579722820308-d74e571900a9?q=80&w=800&auto=format&fit=crop')] bg-cover bg-center opacity-50 mix-blend-overlay group-hover:scale-105 transition-transform duration-700"></div>
          </div>
        </div>
      </section>

      {/* Modal de Detalhes do Produto */}
      <AnimatePresence>
        {selectedProduct && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden relative flex flex-col md:flex-row"
            >
              <button 
                onClick={() => { setSelectedProduct(null); setActiveMediaIndex(0); }}
                className="absolute top-6 left-6 z-10 flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-md text-slate-900 rounded-full hover:bg-white transition-colors shadow-lg font-bold text-sm"
              >
                <ChevronLeft size={20} />
                Voltar
              </button>

              <button 
                onClick={() => { setSelectedProduct(null); setActiveMediaIndex(0); }}
                className="absolute top-6 right-6 z-10 p-2 bg-white/80 backdrop-blur-md text-slate-900 rounded-full hover:bg-white transition-colors shadow-lg"
              >
                <X size={24} />
              </button>

              <div className="flex flex-col w-full h-full overflow-y-auto">
                <div className="flex flex-col md:flex-row w-full">
                  {/* Lado Esquerdo: Galeria de Mídia */}
                  <div className="md:w-1/2 bg-slate-50 flex flex-col border-r border-slate-100">
                    <div className="relative flex items-center justify-center min-h-[400px] md:min-h-[500px] group/gallery overflow-hidden p-8">
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
                                      className="max-w-full max-h-full w-auto h-auto object-contain"
                                      autoPlay
                                      muted={isModalMuted}
                                      loop
                                      playsInline
                                      controls
                                    />
                                  </div>
                                ) : (
                                  <img 
                                    src={currentMedia.url} 
                                    alt={selectedProduct.name} 
                                    className="max-w-full max-h-full object-contain rounded-[32px] shadow-2xl"
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
                                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/20 backdrop-blur-md text-white rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity hover:bg-black/40"
                              >
                                <ChevronLeft size={24} />
                              </button>
                              <button 
                                onClick={() => setActiveMediaIndex((prev) => (prev + 1) % allMedia.length)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/20 backdrop-blur-md text-white rounded-full opacity-0 group-hover/gallery:opacity-100 transition-opacity hover:bg-black/40"
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
                          <div className="p-4 bg-slate-800 border-t border-slate-700">
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
                                    <img src={m.url} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>

                  {/* Lado Direito: Info e Compra */}
                  <div className="md:w-1/2 p-8 md:p-12 flex flex-col bg-white">
                    <div className="pt-12 md:pt-0">
                      <h2 className="text-3xl md:text-5xl font-black text-slate-900 italic uppercase tracking-tighter mb-4 leading-tight">
                        {selectedProduct.name}
                      </h2>
                      
                      <div className="flex flex-col mb-6">
                        {selectedProduct.discount_price !== null && selectedProduct.discount_price !== undefined && selectedProduct.discount_price > 0 ? (
                          <>
                            <span className="text-xl text-slate-400 line-through tracking-tighter">de R$ {selectedProduct.price.toFixed(2)} por</span>
                            <span className="text-4xl font-black text-pink-600 tracking-tighter">R$ {selectedProduct.discount_price.toFixed(2)}</span>
                            <span className="text-sm font-bold text-emerald-600 mt-1">no PIX (5% de desconto)</span>
                            <span className="text-sm text-slate-500 mt-1">ou em até 10x de R$ {(selectedProduct.discount_price / 10).toFixed(2)} sem juros</span>
                          </>
                        ) : (
                          <>
                            <span className="text-4xl font-black text-slate-900 tracking-tighter">R$ {selectedProduct.price.toFixed(2)}</span>
                            <span className="text-sm font-bold text-emerald-600 mt-1">no PIX (5% de desconto)</span>
                            <span className="text-sm text-slate-500 mt-1">ou em até 10x de R$ {(selectedProduct.price / 10).toFixed(2)} sem juros</span>
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
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                          />
                          <button className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold hover:bg-slate-700 transition-colors">
                            OK
                          </button>
                        </div>
                        <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline mt-2 inline-block">
                          Não sei meu CEP
                        </a>
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
                      </div>

                      {/* Descrição e Benefícios */}
                      <div className="mt-8 border-t border-slate-100 pt-8">
                        <h3 className="font-black text-slate-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Star size={18} className="text-amber-400" />
                          Por que escolher?
                        </h3>
                        <ul className="space-y-3 mb-6">
                          <li className="flex items-start gap-3 text-slate-600 text-sm">
                            <div className="mt-1 bg-emerald-100 p-1 rounded-full text-emerald-600"><ShieldCheck size={12} /></div>
                            Fórmula exclusiva e testada
                          </li>
                          <li className="flex items-start gap-3 text-slate-600 text-sm">
                            <div className="mt-1 bg-emerald-100 p-1 rounded-full text-emerald-600"><ShieldCheck size={12} /></div>
                            Resultados visíveis em poucas semanas
                          </li>
                          <li className="flex items-start gap-3 text-slate-600 text-sm">
                            <div className="mt-1 bg-emerald-100 p-1 rounded-full text-emerald-600"><ShieldCheck size={12} /></div>
                            Ingredientes 100% naturais
                          </li>
                        </ul>

                        <details className="group cursor-pointer">
                          <summary className="font-black text-slate-900 uppercase tracking-widest flex items-center justify-between outline-none">
                            Descrição Completa
                            <ChevronRight size={20} className="group-open:rotate-90 transition-transform" />
                          </summary>
                          <div className="pt-4 text-slate-600 leading-relaxed text-sm whitespace-pre-wrap">
                            {selectedProduct.description || "Descrição detalhada do produto não disponível no momento."}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Produtos Relacionados */}
                <div className="bg-slate-50 p-8 md:p-12 border-t border-slate-100">
                  <h3 className="text-2xl font-black text-slate-900 italic uppercase tracking-tighter mb-8">
                    Quem comprou, levou também
                  </h3>
                  <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-hide">
                    {products.filter(p => p.id !== selectedProduct.id).slice(0, 4).map(related => (
                      <div key={related.id} className="min-w-[200px] md:min-w-[250px] bg-white p-4 rounded-3xl shadow-sm border border-slate-100 group cursor-pointer" onClick={() => { setSelectedProduct(related); setQuantity(1); }}>
                        <div className="aspect-square bg-slate-50 rounded-2xl mb-4 overflow-hidden relative">
                          {related.image_url ? (
                            <img src={related.image_url} alt={related.name} className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={32} /></div>
                          )}
                        </div>
                        <h4 className="font-bold text-slate-900 truncate text-sm mb-2">{related.name}</h4>
                        <div className="flex items-baseline gap-2">
                          {related.discount_price ? (
                            <>
                              <span className="text-emerald-600 font-black">R$ {related.discount_price.toFixed(2)}</span>
                              <span className="text-[10px] text-slate-400 line-through">R$ {related.price.toFixed(2)}</span>
                            </>
                          ) : (
                            <span className="text-slate-900 font-black">R$ {related.price.toFixed(2)}</span>
                          )}
                        </div>
                        <button className="w-full mt-3 bg-emerald-600 text-white font-bold py-2 rounded-xl hover:bg-emerald-700 transition-colors uppercase text-[10px] tracking-wider">
                          Comprar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal do Carrinho */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-[110] flex items-end md:items-center justify-end md:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
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
                {cartTotal > 0 && cartTotal < 299 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4">
                    <p className="text-sm font-bold text-emerald-800 mb-2 text-center">
                      Faltam apenas <span className="font-black">R$ {(299 - cartTotal).toFixed(2)}</span> para <span className="font-black uppercase">Frete Grátis</span>!
                    </p>
                    <div className="w-full bg-emerald-200 rounded-full h-2.5">
                      <div className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(cartTotal / 299) * 100}%` }}></div>
                    </div>
                  </div>
                )}
                {cartTotal >= 299 && (
                  <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-4 text-center">
                    <p className="text-sm font-black text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-2">
                      <Truck size={18} /> Parabéns! Você ganhou Frete Grátis!
                    </p>
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
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-slate-500 font-bold">Subtotal</span>
                    <span className="text-3xl font-black text-slate-900 tracking-tighter">R$ {cartTotal.toFixed(2)}</span>
                  </div>
                  <button className="w-full bg-emerald-600 text-white py-6 rounded-[32px] font-black text-xl uppercase italic tracking-tighter hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-3">
                    Finalizar Compra
                  </button>
                  <p className="text-center text-[10px] text-slate-400 mt-4 uppercase font-bold tracking-widest">
                    Pagamento 100% Seguro via Mercado Pago
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Campanha */}
      <AnimatePresence>
        {selectedCampaign && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

