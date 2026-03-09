import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, 
  Megaphone, Plus, Edit2, Trash2, Save, X, Upload, Link as LinkIcon, Copy, Check, Tag, ArrowLeft
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { ConfirmationModal } from '../components/ConfirmationModal';

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

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({});
  const [uploading, setUploading] = useState(false);
  const [linkType, setLinkType] = useState<'custom' | 'category' | 'product'>('custom');
  const [selectedLinkId, setSelectedLinkId] = useState('');
  const [sectionSettings, setSectionSettings] = useState({ title: '', subtitle: '' });
  const [savingSettings, setSavingSettings] = useState(false);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'pereira.itapema@gmail.com') {
        toast.error('Acesso negado.');
        navigate('/');
        return;
      }
      fetchCampaigns();
      fetchOptions();
      fetchSettings();
    };
    checkAdmin();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase.from('store_settings').select('promotions_section_title, promotions_section_subtitle').maybeSingle();
      if (data) {
        setSectionSettings({
          title: data.promotions_section_title || 'PROMOÇÕES DA SEMANA',
          subtitle: data.promotions_section_subtitle || 'Aproveite nossas ofertas exclusivas'
        });
      }
    } catch (error) {
      console.error('Error fetching settings', error);
    }
  };

  const saveSectionSettings = async () => {
    setSavingSettings(true);
    try {
      // First get the ID
      const { data: existing } = await supabase.from('store_settings').select('id').maybeSingle();
      
      if (existing) {
        const { error } = await supabase.from('store_settings').update({
          promotions_section_title: sectionSettings.title,
          promotions_section_subtitle: sectionSettings.subtitle
        }).eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create if not exists
        const { error } = await supabase.from('store_settings').insert([{
          promotions_section_title: sectionSettings.title,
          promotions_section_subtitle: sectionSettings.subtitle,
          payment_methods: [],
          institutional_links: []
        }]);
        if (error) throw error;
      }
      toast.success('Título da seção atualizado!');
    } catch (error: any) {
      toast.error('Erro ao salvar título: ' + error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchOptions = async () => {
    try {
      const { data: cats } = await supabase.from('categories').select('id, name');
      const { data: prods } = await supabase.from('products').select('id, name');
      setCategories(cats || []);
      setProducts(prods || []);
    } catch (error) {
      console.error('Error fetching options', error);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar campanhas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCampaignLink = (campaign: Campaign) => {
    if (!campaign.coupon_code) {
      toast.error('Esta campanha não possui um cupom configurado.');
      return;
    }
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/?coupon=${campaign.coupon_code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(campaign.id);
    toast.success('Link com cupom copiado!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    let finalLink = currentCampaign.link_url;
    if (linkType === 'category') {
      finalLink = `/category/${selectedLinkId}`;
    } else if (linkType === 'product') {
      finalLink = `/product/${selectedLinkId}`;
    }

    try {
      if (currentCampaign.id) {
        const { error } = await supabase
          .from('campaigns')
          .update({
            title: currentCampaign.title,
            subtitle: currentCampaign.subtitle,
            image_url: currentCampaign.image_url,
            rules_text: currentCampaign.rules_text,
            link_url: finalLink,
            is_highlight: currentCampaign.is_highlight ?? false,
            active: currentCampaign.active,
            display_order: currentCampaign.display_order,
            badge_text: currentCampaign.badge_text,
            button_text: currentCampaign.button_text,
            background_color: currentCampaign.background_color,
            text_color: currentCampaign.text_color,
            discount_value: currentCampaign.discount_value,
            discount_type: currentCampaign.discount_type,
            trigger_type: currentCampaign.trigger_type,
            trigger_value: currentCampaign.trigger_value,
            coupon_code: currentCampaign.coupon_code,
          })
          .eq('id', currentCampaign.id);
        
        if (error) {
          // Fallback se colunas novas não existirem
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            const { error: retryError } = await supabase
              .from('campaigns')
              .update({
                title: currentCampaign.title,
                subtitle: currentCampaign.subtitle,
                image_url: currentCampaign.image_url,
                rules_text: currentCampaign.rules_text,
                link_url: finalLink,
                is_highlight: currentCampaign.is_highlight ?? false,
                active: currentCampaign.active,
                display_order: currentCampaign.display_order
              })
              .eq('id', currentCampaign.id);
            if (retryError) throw retryError;
            toast.success('Campanha salva (execute o SQL no Admin > Configurações para habilitar cores)');
          } else {
            throw error;
          }
        } else {
          toast.success('Campanha atualizada!');
        }
      } else {
        const { error } = await supabase
          .from('campaigns')
          .insert([{
            title: currentCampaign.title,
            subtitle: currentCampaign.subtitle,
            image_url: currentCampaign.image_url,
            rules_text: currentCampaign.rules_text,
            link_url: finalLink,
            is_highlight: currentCampaign.is_highlight ?? false,
            active: currentCampaign.active ?? true,
            display_order: currentCampaign.display_order ?? 0,
            badge_text: currentCampaign.badge_text,
            button_text: currentCampaign.button_text,
            background_color: currentCampaign.background_color,
            text_color: currentCampaign.text_color,
            discount_value: currentCampaign.discount_value,
            discount_type: currentCampaign.discount_type,
            trigger_type: currentCampaign.trigger_type,
            trigger_value: currentCampaign.trigger_value,
            coupon_code: currentCampaign.coupon_code,
          }]);
          
        if (error) {
          // Fallback se colunas novas não existirem
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            const { error: retryError } = await supabase
              .from('campaigns')
              .insert([{
                title: currentCampaign.title,
                subtitle: currentCampaign.subtitle,
                image_url: currentCampaign.image_url,
                rules_text: currentCampaign.rules_text,
                link_url: finalLink,
                is_highlight: currentCampaign.is_highlight ?? false,
                active: currentCampaign.active ?? true,
                display_order: currentCampaign.display_order ?? 0
              }]);
            if (retryError) throw retryError;
            toast.success('Campanha criada (execute o SQL no Admin > Configurações para habilitar cores)');
          } else {
            throw error;
          }
        } else {
          toast.success('Campanha criada!');
        }
      }

      setIsEditing(false);
      setCurrentCampaign({});
      fetchCampaigns();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Campanha',
      message: 'Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.',
      variant: 'danger',
      onConfirm: async () => {
        setLoading(true);
        try {
          const { error } = await supabase.from('campaigns').delete().eq('id', id);
          if (error) throw error;
          toast.success('Campanha excluída!');
          fetchCampaigns();
        } catch (error: any) {
          toast.error('Erro ao excluir: ' + error.message);
          setLoading(false);
        }
      }
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `campaigns/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath);

      setCurrentCampaign({ ...currentCampaign, image_url: publicUrl });
      toast.success('Imagem carregada!');
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading && !isEditing) return <Loading message="Carregando campanhas..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 text-emerald-600 font-bold text-xl">
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => navigate('/')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ShoppingBag size={20} /> Visualizar Loja
          </button>
          <button onClick={() => navigate('/banners')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ImageIcon size={20} /> Banners
          </button>
          <button onClick={() => navigate('/campaigns')} className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium">
            <Megaphone size={20} /> Campanhas
          </button>
          <button onClick={() => navigate('/products')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Package size={20} /> Produtos
          </button>
          <button onClick={() => navigate('/profile')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Settings size={20} /> Configurações
          </button>
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 text-rose-600 hover:bg-rose-50 rounded-xl font-medium transition-colors">
            <LogOut size={20} /> Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-slate-500 hover:text-emerald-600 mb-2 transition-colors font-medium"
              >
                <ArrowLeft size={18} />
                Voltar ao Painel
              </button>
              <h1 className="text-3xl font-bold text-slate-900">Campanhas e Benefícios</h1>
              <p className="text-slate-500 mt-1">Gerencie os cards de benefícios exibidos após o banner principal.</p>
            </div>
            <button
              onClick={() => {
                setCurrentCampaign({ active: true, display_order: 0 });
                setIsEditing(true);
              }}
              className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              Nova Campanha
            </button>
          </div>

          {/* Section Settings Editor */}
          {!isEditing && (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Edit2 size={18} className="text-emerald-600" />
                Editar Título da Seção na Loja
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Título (Ex: PROMOÇÕES DA SEMANA)</label>
                  <input
                    type="text"
                    value={sectionSettings.title}
                    onChange={(e) => setSectionSettings({ ...sectionSettings, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo (Opcional)</label>
                  <input
                    type="text"
                    value={sectionSettings.subtitle}
                    onChange={(e) => setSectionSettings({ ...sectionSettings, subtitle: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button
                    onClick={saveSectionSettings}
                    disabled={savingSettings}
                    className="px-4 py-2 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {savingSettings ? <Loading message="" /> : <Save size={18} />}
                    Salvar Títulos
                  </button>
                </div>
              </div>
            </div>
          )}

          {isEditing ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900">
                  {currentCampaign.id ? 'Editar Campanha' : 'Nova Campanha'}
                </h2>
                <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Título (Ex: FRETE GRÁTIS)</label>
                    <input
                      type="text"
                      value={currentCampaign.title || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, title: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Subtítulo (Ex: nas compras acima de R$ 299)</label>
                    <input
                      type="text"
                      value={currentCampaign.subtitle || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, subtitle: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Texto da Badge (Ex: OFERTA EXCLUSIVA)</label>
                    <input
                      type="text"
                      value={currentCampaign.badge_text || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, badge_text: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Texto do Botão (Ex: VER AGORA)</label>
                    <input
                      type="text"
                      value={currentCampaign.button_text || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, button_text: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      placeholder="Padrão: VER AGORA"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cor de Fundo (Hex)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={currentCampaign.background_color || '#000000'}
                        onChange={e => setCurrentCampaign({...currentCampaign, background_color: e.target.value})}
                        className="h-10 w-10 rounded-lg cursor-pointer border-none"
                      />
                      <input
                        type="text"
                        value={currentCampaign.background_color || ''}
                        onChange={e => setCurrentCampaign({...currentCampaign, background_color: e.target.value})}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        placeholder="#000000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Cor do Texto (Hex)</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={currentCampaign.text_color || '#ffffff'}
                        onChange={e => setCurrentCampaign({...currentCampaign, text_color: e.target.value})}
                        className="h-10 w-10 rounded-lg cursor-pointer border-none"
                      />
                      <input
                        type="text"
                        value={currentCampaign.text_color || ''}
                        onChange={e => setCurrentCampaign({...currentCampaign, text_color: e.target.value})}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        placeholder="#ffffff"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <Tag size={18} className="text-emerald-600" />
                      Configurações de Desconto e Regras
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Gatilho</label>
                        <select
                          value={currentCampaign.trigger_type || 'automatic'}
                          onChange={e => setCurrentCampaign({...currentCampaign, trigger_type: e.target.value as any})}
                          className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="automatic">Automático (Sempre)</option>
                          <option value="coupon">Cupom de Desconto</option>
                          <option value="min_value">Valor Mínimo no Carrinho</option>
                          <option value="first_purchase">Primeira Compra</option>
                        </select>
                      </div>

                      {currentCampaign.trigger_type === 'coupon' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Código do Cupom</label>
                          <input
                            type="text"
                            value={currentCampaign.coupon_code || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, coupon_code: e.target.value.toUpperCase()})}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="EX: BEMVINDO10"
                          />
                        </div>
                      )}

                      {currentCampaign.trigger_type === 'min_value' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Mínimo (R$)</label>
                          <input
                            type="number"
                            value={currentCampaign.trigger_value || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, trigger_value: parseFloat(e.target.value)})}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="299.00"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Valor Desconto</label>
                          <input
                            type="number"
                            value={currentCampaign.discount_value || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, discount_value: parseFloat(e.target.value)})}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                          <select
                            value={currentCampaign.discount_type || 'percentage'}
                            onChange={e => setCurrentCampaign({...currentCampaign, discount_type: e.target.value as any})}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="percentage">%</option>
                            <option value="fixed">R$</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sugestões de Regras Populares (25 Modelos):</p>
                        <button 
                          type="button"
                          onClick={() => {
                            toast.success('Lógica: Automático (Aplica a todos), Cupom (Requer código), Valor Mínimo (Ativa após atingir valor).', { duration: 5000 });
                          }}
                          className="text-[10px] text-indigo-600 font-bold hover:underline"
                        >
                          Ver Explicação das Lógicas
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-100 scrollbar-hide">
                        {[
                          { name: 'FRETE GRÁTIS', trigger: 'min_value', value: 299, type: 'percentage', code: '', rules: 'Frete grátis para compras acima de R$ 299. Válido para todo o Brasil.' },
                          { name: 'PRIMEIRA COMPRA', trigger: 'first_purchase', value: 10, type: 'percentage', code: 'PRIMEIRA10', rules: 'Ganhe 10% de desconto na sua primeira compra na loja!' },
                          { name: 'DESCONTO PIX', trigger: 'automatic', value: 5, type: 'percentage', code: '', rules: '5% de desconto automático para pagamentos via PIX.' },
                          { name: 'CUPOM BEMVINDO', trigger: 'coupon', value: 15, type: 'percentage', code: 'BEMVINDO15', rules: 'Use o cupom BEMVINDO15 e ganhe 15% de desconto agora!' },
                          { name: 'OFERTA RELÂMPAGO', trigger: 'automatic', value: 20, type: 'percentage', code: '', rules: 'Oferta por tempo limitado! 20% de desconto em todo o site.' },
                          { name: 'COMPRE 2 LEVE 3', trigger: 'automatic', value: 33, type: 'percentage', code: '', rules: 'Na compra de 3 itens, o de menor valor sai de graça (equivale a ~33% OFF).' },
                          { name: 'PROGRESSIVO 10%', trigger: 'min_value', value: 10, type: 'percentage', code: '', rules: 'Ganhe 10% de desconto em compras acima de R$ 150.' },
                          { name: 'PROGRESSIVO 20%', trigger: 'min_value', value: 20, type: 'percentage', code: '', rules: 'Ganhe 20% de desconto em compras acima de R$ 300.' },
                          { name: 'ANIVERSÁRIO', trigger: 'coupon', value: 25, type: 'percentage', code: 'PARABENS25', rules: 'Parabéns! Use seu cupom de aniversário e ganhe 25% OFF.' },
                          { name: 'INDIQUE AMIGO', trigger: 'coupon', value: 15, type: 'percentage', code: 'AMIGO15', rules: 'Indique um amigo e ambos ganham 15% de desconto.' },
                          { name: 'LIQUIDA INVERNO', trigger: 'automatic', value: 40, type: 'percentage', code: '', rules: 'Liquidação de Inverno! Até 40% de desconto em itens selecionados.' },
                          { name: 'BLACK FRIDAY', trigger: 'automatic', value: 50, type: 'percentage', code: '', rules: 'Black Friday Antecipada! Metade do preço em toda a loja.' },
                          { name: 'COMBO SAÚDE', trigger: 'min_value', value: 15, type: 'percentage', code: '', rules: 'Leve 3 ou mais itens de saúde e ganhe 15% de desconto total.' },
                          { name: 'FRETE FIXO 9,90', trigger: 'min_value', value: 9.90, type: 'fixed', code: '', rules: 'Frete fixo de apenas R$ 9,90 para compras acima de R$ 100.' },
                          { name: 'BRINDE ESPECIAL', trigger: 'min_value', value: 0, type: 'percentage', code: '', rules: 'Ganhe um brinde exclusivo em compras acima de R$ 500.' },
                          { name: 'ASSINANTES VIP', trigger: 'coupon', value: 20, type: 'percentage', code: 'VIP20', rules: 'Desconto exclusivo para assinantes da nossa newsletter.' },
                          { name: 'DIA DO CONSUMIDOR', trigger: 'automatic', value: 15, type: 'percentage', code: '', rules: 'Semana do Consumidor: 15% OFF em todo o catálogo.' },
                          { name: 'DIA DAS MÃES', trigger: 'coupon', value: 20, type: 'percentage', code: 'MAE20', rules: 'Presenteie sua mãe com 20% de desconto usando o cupom MAE20.' },
                          { name: 'DIA DOS PAIS', trigger: 'automatic', value: 10, type: 'percentage', code: '', rules: 'Especial Dia dos Pais: 10% de desconto automático.' },
                          { name: 'NATAL MÁGICO', trigger: 'min_value', value: 15, type: 'percentage', code: '', rules: 'Natal Antecipado: 15% OFF para compras acima de R$ 200.' },
                          { name: 'QUEIMA ESTOQUE', trigger: 'automatic', value: 60, type: 'percentage', code: '', rules: 'Últimas unidades! Queima de estoque com até 60% OFF.' },
                          { name: 'CLIENTE ANTIGO', trigger: 'coupon', value: 30, type: 'percentage', code: 'VOLTEI30', rules: 'Sentimos sua falta! Use VOLTEI30 e ganhe 30% na sua volta.' },
                          { name: 'CASHBACK 10%', trigger: 'automatic', value: 10, type: 'percentage', code: '', rules: 'Ganhe 10% de cashback para usar na sua próxima compra.' },
                          { name: 'ATACADO 20%', trigger: 'min_value', value: 20, type: 'percentage', code: '', rules: 'Compras acima de 10 unidades ganham 20% de desconto automático.' },
                          { name: 'LANÇAMENTO', trigger: 'coupon', value: 5, type: 'percentage', code: 'NOVO05', rules: 'Conheça nossos lançamentos com 5% de desconto extra.' }
                        ].map((sug, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setCurrentCampaign({
                              ...currentCampaign,
                              title: sug.name,
                              trigger_type: sug.trigger as any,
                              discount_value: sug.value,
                              discount_type: sug.type as any,
                              trigger_value: sug.trigger === 'min_value' ? (sug.name.includes('FRETE') ? 299 : 150) : undefined,
                              coupon_code: sug.code || undefined,
                              rules_text: sug.rules,
                              badge_text: sug.name,
                              button_text: 'APROVEITAR AGORA',
                              background_color: '#059669',
                              text_color: '#ffffff'
                            })}
                            className="text-[9px] bg-white border border-slate-200 px-2 py-1.5 rounded-lg hover:border-emerald-500 hover:text-emerald-600 transition-all font-bold text-slate-600 text-left leading-tight"
                          >
                            {sug.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Regras / Texto do Popup</label>
                    <textarea
                      value={currentCampaign.rules_text || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, rules_text: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 h-32"
                      placeholder="Descreva as regras da campanha que aparecerão quando o cliente clicar no card..."
                      required
                    />
                  </div>
                  
                  <div className="md:col-span-2 space-y-4">
                    <label className="block text-sm font-medium text-slate-700">Link de Direcionamento</label>
                    <div className="flex flex-col md:flex-row gap-4">
                      <div className="w-full md:w-1/3">
                        <select
                          value={linkType}
                          onChange={(e) => {
                            setLinkType(e.target.value as any);
                            setSelectedLinkId('');
                            if (e.target.value === 'custom') {
                              setCurrentCampaign({...currentCampaign, link_url: ''});
                            }
                          }}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="custom">Link Personalizado / Externo</option>
                          <option value="category">Categoria</option>
                          <option value="product">Produto</option>
                        </select>
                      </div>

                      <div className="w-full md:w-2/3">
                        {linkType === 'custom' && (
                          <input
                            type="text"
                            value={currentCampaign.link_url || ''}
                            onChange={e => setCurrentCampaign({...currentCampaign, link_url: e.target.value})}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="Ex: https://google.com ou /minha-pagina"
                          />
                        )}

                        {linkType === 'category' && (
                          <select
                            value={selectedLinkId}
                            onChange={(e) => setSelectedLinkId(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">Selecione uma categoria...</option>
                            {categories.map(cat => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        )}

                        {linkType === 'product' && (
                          <select
                            value={selectedLinkId}
                            onChange={(e) => setSelectedLinkId(e.target.value)}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">Selecione um produto...</option>
                            {products.map(prod => (
                              <option key={prod.id} value={prod.id}>{prod.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="md:col-span-2 flex items-center gap-4 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCampaign.is_highlight ?? false}
                        onChange={e => setCurrentCampaign({...currentCampaign, is_highlight: e.target.checked})}
                        className="w-5 h-5 text-emerald-600 rounded border-emerald-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-bold text-emerald-900">
                        É Card de Benefício / Destaque Fixo?
                      </span>
                    </label>
                    <p className="text-xs text-emerald-700 ml-4">
                      Se marcado, será exibido como um card preto de destaque logo abaixo do banner (ex: Frete Grátis, Cupom). A imagem não é obrigatória.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Imagem / Ícone (Opcional)</label>
                    <div className="flex items-center gap-4">
                      {currentCampaign.image_url && (
                        <img src={currentCampaign.image_url} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                      )}
                      <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl cursor-pointer hover:bg-slate-200 transition-colors">
                        <Upload size={20} />
                        <span>{uploading ? 'Enviando...' : 'Escolher Imagem'}</span>
                        <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentCampaign.active ?? true}
                        onChange={e => setCurrentCampaign({...currentCampaign, active: e.target.checked})}
                        className="w-5 h-5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                      />
                      <span className="text-sm font-medium text-slate-700">Campanha Ativa</span>
                    </label>
                    
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-slate-700">Ordem:</label>
                      <input
                        type="number"
                        value={currentCampaign.display_order || 0}
                        onChange={e => setCurrentCampaign({...currentCampaign, display_order: parseInt(e.target.value)})}
                        className="w-20 px-3 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploading}
                    className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors flex items-center gap-2"
                  >
                    <Save size={20} />
                    Salvar Campanha
                  </button>
                </div>
              </form>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.map((campaign) => (
                <motion.div
                  key={campaign.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`rounded-2xl shadow-sm border ${campaign.active ? 'border-slate-200' : 'border-rose-200 opacity-75'} overflow-hidden flex flex-col bg-white`}
                >
                  {/* Preview Header / Actions */}
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2 py-1 rounded-md ${campaign.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {campaign.active ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        Ordem: {campaign.display_order}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {campaign.coupon_code && (
                        <button
                          onClick={() => copyCampaignLink(campaign)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Copiar Link com Cupom"
                        >
                          {copiedId === campaign.id ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setCurrentCampaign(campaign);
                          if (campaign.link_url?.startsWith('/category/')) {
                            setLinkType('category');
                            setSelectedLinkId(campaign.link_url.replace('/category/', ''));
                          } else if (campaign.link_url?.startsWith('/product/')) {
                            setLinkType('product');
                            setSelectedLinkId(campaign.link_url.replace('/product/', ''));
                          } else {
                            setLinkType('custom');
                            setSelectedLinkId('');
                          }
                          setIsEditing(true);
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(campaign.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Card Preview */}
                  <div className="p-4">
                    <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Visualização na Loja:</p>
                    
                    {campaign.is_highlight ? (
                      // Estilo Benefício (Highlight)
                      <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                        {campaign.image_url ? (
                          <img src={campaign.image_url} alt={campaign.title} className="w-12 h-12 object-contain" />
                        ) : (
                          <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-600">
                            <Megaphone size={24} />
                          </div>
                        )}
                        <div>
                          <h4 className="font-bold text-slate-900">{campaign.title}</h4>
                          <p className="text-xs text-emerald-600 font-medium">{campaign.subtitle}</p>
                          {campaign.coupon_code && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md font-bold mt-1 inline-block">
                              Cupom: {campaign.coupon_code}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Estilo Promoção (Photo 2)
                      <div 
                        className="rounded-2xl overflow-hidden shadow-sm relative h-[160px] flex items-center"
                        style={{ 
                          backgroundColor: campaign.background_color || '#000000',
                          color: campaign.text_color || '#ffffff'
                        }}
                      >
                        <div className="w-1/2 p-4 relative z-10 flex flex-col justify-center h-full">
                          {campaign.badge_text && (
                            <div className="inline-block bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider mb-2 w-fit">
                              {campaign.badge_text}
                            </div>
                          )}
                          <h4 className="font-black italic uppercase text-lg leading-[0.9] mb-2 tracking-tighter">
                            {campaign.title}
                          </h4>
                          {campaign.coupon_code && (
                            <div className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-md w-fit mb-2">
                              CUPOM: {campaign.coupon_code}
                            </div>
                          )}
                          {campaign.subtitle && (
                            <p className="text-[10px] font-medium opacity-90 mb-3 leading-tight line-clamp-2">
                              {campaign.subtitle}
                            </p>
                          )}
                          <div className="bg-white text-black px-3 py-1 rounded-full font-black text-[8px] uppercase tracking-widest w-fit">
                            {campaign.button_text || 'VER AGORA'}
                          </div>
                        </div>
                        <div className="absolute right-0 top-0 w-1/2 h-full">
                          {campaign.image_url ? (
                            <img 
                              src={campaign.image_url} 
                              alt={campaign.title} 
                              className="w-full h-full object-cover object-center" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-black/10">
                              <ImageIcon size={24} className="opacity-20" />
                            </div>
                          )}
                          <div className="absolute inset-0 pointer-events-none" style={{ background: `linear-gradient(to right, ${campaign.background_color || '#000000'} 10%, transparent 100%)` }}></div>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}

              {campaigns.length === 0 && (
                <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                  <Megaphone className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">Nenhuma campanha cadastrada</h3>
                  <p className="text-slate-500">Crie sua primeira campanha para exibir na loja.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </div>
  );
}
