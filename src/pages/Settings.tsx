import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/utils';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { Save, Plus, Trash2, Image as ImageIcon, Settings as SettingsIcon, Sparkles, Link as LinkIcon, CreditCard, Clock, FileText, ArrowLeft, Truck, Zap, Check, Info, MessageSquare } from 'lucide-react';
import { Loading } from '../components/Loading';
import { GoogleGenAI } from "@google/genai";

import { ConfirmationModal } from '../components/ConfirmationModal';

interface StoreSettings {
  id: string;
  company_name: string;
  cnpj: string;
  address: string;
  cep: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string; // Mantendo para compatibilidade
  facebook: string; // Mantendo para compatibilidade
  social_links: { platform: string; url: string; active: boolean }[]; // Novo campo
  business_hours: string;
  business_hours_details: string;
  payment_methods: { name: string; type: string; active: boolean; details?: string }[];
  shipping_methods: { name: string; price: number; deadline: string; active: boolean }[];
  free_shipping_threshold?: number;
  institutional_links: { label: string; url: string; content: string }[];
  affiliate_terms: string;
  top_bar_text: string;
  promotions_section_title?: string;
  promotions_section_subtitle?: string;
  products_section_title?: string;
  products_section_subtitle?: string;
  tracking_pixels: { platform: string; pixel_id: string; active: boolean }[];
  debug_mode: boolean;
  n8n_webhook_url?: string;
  origin_zip_code?: string;
  ai_chat_rules?: string;
  ai_chat_triggers?: string;
  ai_auto_learning?: boolean;
  ai_chat_memory?: string;
  nfe_provider?: string;
  nfe_token?: string;
  nfe_company_id?: string;
  chat_webhook_url?: string;
  affiliate_chat_webhook_url?: string;
  chat_response_source?: 'site' | 'webhook';
}

export default function Settings() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general, institutional, payments, shipping, hours, footer, marketing, visual
  const [siteContent, setSiteContent] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.location.href = '/login';
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.role !== 'admin' && session.user.email !== 'pereira.itapema@gmail.com') {
        toast.error('Acesso negado.');
        window.location.href = '/';
        return;
      }
      fetchSettings();
      fetchSiteContent();
    };
    checkAdmin();
  }, []);

  const fetchSiteContent = async () => {
    try {
      setLoadingContent(true);
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('key');
      if (error) throw error;
      setSiteContent(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar conteúdo do site:', error);
    } finally {
      setLoadingContent(false);
    }
  };

  const updateSiteContent = async (key: string, value: string) => {
    try {
      const { data: existing } = await supabase
        .from('site_content')
        .select('id')
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        const { error: updateError } = await supabase.from('site_content').update({ value }).eq('key', key);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('site_content').insert([{ key, value }]);
        if (insertError) throw insertError;
      }
      await fetchSiteContent();
      toast.success('Conteúdo atualizado!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  const deleteSiteContent = async (key: string) => {
    try {
      const { error } = await supabase
        .from('site_content')
        .delete()
        .eq('key', key);
      if (error) throw error;
      fetchSiteContent();
      toast.success('Conteúdo removido!');
    } catch (error: any) {
      toast.error('Erro ao remover: ' + error.message);
    }
  };

  const handleSiteImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      // Converter para PNG se não for
      let fileToUpload = file;
      if (!file.type.includes('png')) {
        const canvas = document.createElement('canvas');
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = objectUrl;
        });
        
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (blob) {
          fileToUpload = new File([blob], `${key}.png`, { type: 'image/png' });
        }
        URL.revokeObjectURL(objectUrl);
      }

      const fileName = `site/${key}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, fileToUpload, { contentType: 'image/png', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      // Adiciona timestamp para forçar atualização e evitar cache
      const urlWithTimestamp = `${publicUrl}?t=${new Date().getTime()}`;
      console.log('Upload bem-sucedido. URL:', urlWithTimestamp);

      await updateSiteContent(key, urlWithTimestamp);
    } catch (error: any) {
      console.error('Erro no upload:', error);
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

    const fetchSettings = async () => {
    try {
      console.log('Buscando configurações da loja...');
      // Buscamos todas as linhas e ordenamos pelo ID para garantir consistência
      const { data, error } = await withTimeout(
        supabase
          .from('store_settings')
          .select('*')
          .order('id', { ascending: true }),
        15000
      );

      if (error) {
        console.error('Erro ao buscar configurações:', error);
        throw error;
      }

      console.log('Dados recebidos do banco:', data);

      let settingsData;
      if (data && data.length > 0) {
        // Sempre usamos a primeira linha (a mais antiga se houver múltiplas)
        settingsData = data[0];
        if (data.length > 1) {
          console.warn(`Atenção: ${data.length} linhas encontradas em store_settings. Usando a primeira (ID: ${settingsData.id}).`);
        }
      } else {
        console.log('Nenhuma configuração encontrada. Criando padrão...');
        const { data: newData, error: insertError } = await supabase
          .from('store_settings')
          .insert([{
            company_name: 'Minha Loja',
            promotions_section_title: 'PROMOÇÕES DA SEMANA',
            promotions_section_subtitle: 'Aproveite nossas ofertas exclusivas',
            payment_methods: [],
            institutional_links: [],
            shipping_methods: [
              { name: 'Correios (PAC)', price: 25.90, deadline: '7 a 10 dias úteis', active: true },
              { name: 'Correios (SEDEX)', price: 45.90, deadline: '2 a 4 dias úteis', active: true }
            ]
          }])
          .select();

        if (insertError) throw insertError;
        settingsData = newData[0];
      }

      // Migração automática de legado para novo formato
      let socialLinks = settingsData.social_links || [];
      if (socialLinks.length === 0) {
        if (settingsData.instagram) socialLinks.push({ platform: 'Instagram', url: settingsData.instagram, active: true });
        if (settingsData.facebook) socialLinks.push({ platform: 'Facebook', url: settingsData.facebook, active: true });
      }

      // Buscar regras da IA da tabela ai_settings (vendas)
      const { data: aiSettingsData } = await supabase
        .from('ai_settings')
        .select('rules, memory')
        .eq('agent_type', 'vendas')
        .maybeSingle();

      // Inicialização explícita de TODOS os campos para evitar null/undefined
      setSettings({
        id: settingsData.id,
        company_name: settingsData.company_name || '',
        cnpj: settingsData.cnpj || '',
        address: settingsData.address || '',
        cep: settingsData.cep || '',
        phone: settingsData.phone || '',
        whatsapp: settingsData.whatsapp || '',
        email: settingsData.email || '',
        instagram: settingsData.instagram || '',
        facebook: settingsData.facebook || '',
        social_links: socialLinks,
        business_hours: settingsData.business_hours || '',
        business_hours_details: settingsData.business_hours_details || '',
        payment_methods: settingsData.payment_methods || [],
        shipping_methods: settingsData.shipping_methods || [
          { name: 'Correios (PAC)', price: 25.90, deadline: '7 a 10 dias úteis', active: true },
          { name: 'Correios (SEDEX)', price: 45.90, deadline: '2 a 4 dias úteis', active: true }
        ],
        free_shipping_threshold: settingsData.free_shipping_threshold !== undefined ? settingsData.free_shipping_threshold : 299.00,
        institutional_links: settingsData.institutional_links || [],
        affiliate_terms: settingsData.affiliate_terms || '',
        top_bar_text: settingsData.top_bar_text || '',
        promotions_section_title: settingsData.promotions_section_title || 'CAMPANHAS E PROMOÇÕES',
        promotions_section_subtitle: settingsData.promotions_section_subtitle || 'Aproveite nossas ofertas exclusivas',
        products_section_title: settingsData.products_section_title || 'Novidades da Estação',
        products_section_subtitle: settingsData.products_section_subtitle || 'Confira as últimas tendências e ofertas exclusivas que preparamos para você.',
        tracking_pixels: settingsData.tracking_pixels || [],
        debug_mode: !!settingsData.debug_mode,
        n8n_webhook_url: settingsData.n8n_webhook_url || '',
        origin_zip_code: settingsData.origin_zip_code || '',
        ai_chat_rules: aiSettingsData?.rules || settingsData.ai_chat_rules || '',
        ai_chat_triggers: settingsData.ai_chat_triggers || '',
        ai_auto_learning: !!settingsData.ai_auto_learning,
        ai_chat_memory: aiSettingsData?.memory || settingsData.ai_chat_memory || '',
        nfe_provider: settingsData.nfe_provider || 'manual',
        nfe_token: settingsData.nfe_token || '',
        nfe_company_id: settingsData.nfe_company_id || '',
        chat_webhook_url: settingsData.chat_webhook_url || '',
        affiliate_chat_webhook_url: settingsData.affiliate_chat_webhook_url || '',
        chat_response_source: settingsData.chat_response_source || 'site'
      });
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof StoreSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [field]: value });
    }
  };

  const handleSave = async (showToast = true) => {
    if (!settings) return;
    setSaving(true);
    try {
      const allowedFields = [
        'company_name', 'cnpj', 'address', 'cep', 'phone', 'whatsapp', 'email',
        'instagram', 'facebook', 'social_links', 'business_hours', 'business_hours_details',
        'payment_methods', 'shipping_methods', 'free_shipping_threshold', 'institutional_links',
        'affiliate_terms', 'top_bar_text', 'promotions_section_title', 'promotions_section_subtitle',
        'products_section_title', 'products_section_subtitle', 'tracking_pixels', 'debug_mode',
        'n8n_webhook_url', 'origin_zip_code', 'ai_chat_rules', 'ai_chat_triggers',
        'ai_auto_learning', 'ai_chat_memory', 'nfe_provider', 'nfe_token', 'nfe_company_id',
        'chat_webhook_url', 'affiliate_chat_webhook_url', 'chat_response_source'
      ];

      let payload: any = {};
      allowedFields.forEach(field => {
        if (field in settings) {
          let value = (settings as any)[field];
          
          // Sanitização: Garantir que campos de texto nunca sejam null
          const textFieldTypes = [
            'company_name', 'cnpj', 'address', 'cep', 'phone', 'whatsapp', 'email',
            'instagram', 'facebook', 'business_hours', 'business_hours_details',
            'affiliate_terms', 'top_bar_text', 'promotions_section_title', 'promotions_section_subtitle',
            'products_section_title', 'products_section_subtitle', 'n8n_webhook_url', 'origin_zip_code',
            'ai_chat_rules', 'ai_chat_triggers', 'ai_chat_memory', 'nfe_token', 'nfe_company_id',
            'chat_webhook_url', 'affiliate_chat_webhook_url', 'chat_response_source'
          ];
          
          if (textFieldTypes.includes(field) && (value === null || value === undefined)) {
            value = '';
          }
          
          payload[field] = value;
        }
      });

      console.log('Salvando configurações:', payload);

      let { error } = await supabase
        .from('store_settings')
        .update(payload)
        .eq('id', settings.id);

      // Se der erro de coluna não encontrada, tentamos remover os campos problemáticos e salvar de novo
      if (error && (error.message?.includes('column') || error.message?.includes('does not exist'))) {
        console.warn('Detectado erro de coluna no banco. Tentando salvamento simplificado...');
        
        // Remove campos que costumam dar erro se o banco estiver desatualizado
        const problematicFields = ['nfe_provider', 'nfe_token', 'nfe_company_id', 'chat_response_source'];
        problematicFields.forEach(f => delete payload[f]);
        
        const retry = await supabase
          .from('store_settings')
          .update(payload)
          .eq('id', settings.id);
        
        error = retry.error;
      }

      if (error) throw error;

      // Sincronizar com a tabela ai_settings (vendas)
      try {
        await supabase
          .from('ai_settings')
          .upsert({
            agent_type: 'vendas',
            rules: settings.ai_chat_rules || '',
            memory: settings.ai_chat_memory || ''
          }, { onConflict: 'agent_type' });
      } catch (aiError) {
        console.warn('⚠️ Erro ao sincronizar ai_settings (pode ser que a tabela não exista):', aiError);
      }

      if (showToast) {
        toast.success('Configurações salvas e aplicadas na loja!');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ... (renderização)

  // Novo CRUD de Redes Sociais
  const addSocialLink = () => {
    if (!settings) return;
    const newLinks = [...settings.social_links, { platform: '', url: '', active: true }];
    handleChange('social_links', newLinks);
  };

  const removeSocialLink = (index: number) => {
    if (!settings) return;
    const newLinks = settings.social_links.filter((_, i) => i !== index);
    handleChange('social_links', newLinks);
  };

  const updateSocialLink = (index: number, field: string, value: any) => {
    if (!settings) return;
    const newLinks = [...settings.social_links];
    newLinks[index] = { ...newLinks[index], [field]: value };
    handleChange('social_links', newLinks);
  };

  const addPixel = () => {
    if (!settings) return;
    const newPixels = [...(settings.tracking_pixels || []), { platform: '', pixel_id: '', active: true }];
    handleChange('tracking_pixels', newPixels);
  };

  const removePixel = (index: number) => {
    if (!settings) return;
    const newPixels = settings.tracking_pixels.filter((_, i) => i !== index);
    handleChange('tracking_pixels', newPixels);
  };

  const updatePixel = (index: number, field: string, value: any) => {
    if (!settings) return;
    const newPixels = [...settings.tracking_pixels];
    newPixels[index] = { ...newPixels[index], [field]: value };
    handleChange('tracking_pixels', newPixels);
  };

  // ... (dentro do JSX, aba 'footer' ou 'general')
  // Substituir inputs antigos por:
  /*
  <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-4">
    <h3 className="text-lg font-bold text-slate-900 mb-4">Redes Sociais</h3>
    <div className="space-y-3">
      {settings.social_links.map((link, index) => (
        <div key={index} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
           <select 
             value={link.platform}
             onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
             className="p-2 border border-slate-300 rounded-lg bg-white"
           >
             <option value="">Selecione...</option>
             <option value="Instagram">Instagram</option>
             <option value="Facebook">Facebook</option>
             <option value="TikTok">TikTok</option>
             <option value="Twitter">Twitter</option>
             <option value="Youtube">Youtube</option>
             <option value="Linkedin">Linkedin</option>
             <option value="Pinterest">Pinterest</option>
             <option value="Outro">Outro</option>
           </select>
           <input
             type="text"
             placeholder="URL do Perfil"
             value={link.url}
             onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
             className="flex-1 p-2 border border-slate-300 rounded-lg"
           />
           <button
             onClick={() => removeSocialLink(index)}
             className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg"
           >
             <Trash2 size={20} />
           </button>
        </div>
      ))}
      <button
        onClick={addSocialLink}
        className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
      >
        <Plus size={20} /> Adicionar Rede Social
      </button>
    </div>
  </div>
  */

  const generateAiText = async (field: keyof StoreSettings) => {
    if (!aiPrompt) {
      toast.error('Digite um prompt para a IA');
      return;
    }
    setGeneratingAi(true);
    try {
      const { data: keys } = await supabase.from('api_keys').select('key_value').eq('service', 'gemini').eq('active', true).maybeSingle();
      if (!keys || !keys.key_value) {
        toast.error('Configure uma chave API do Gemini ativa em Produtos > Configurar APIs');
        return;
      }
      const ai = new GoogleGenAI({ apiKey: keys.key_value });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Escreva um texto profissional para a seção "${field}" de uma loja virtual, sobre: ${aiPrompt}. O texto deve ser formatado em HTML simples se necessário.`,
      });
      const text = response.text || '';
      handleChange(field, text);
      toast.success('Texto gerado!');
      setAiPrompt('');
    } catch (error) {
      toast.error('Erro na IA');
    } finally {
      setGeneratingAi(false);
    }
  };

  // Estado para edição de link (CRUD estilo Card/Modal)
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [tempLink, setTempLink] = useState({ label: '', url: '', content: '' });

  const startEditLink = (index: number) => {
    setEditingLinkIndex(index);
    setTempLink({ ...settings!.institutional_links[index] });
  };

  const cancelEditLink = () => {
    setEditingLinkIndex(null);
    setTempLink({ label: '', url: '', content: '' });
  };

  const saveLink = () => {
    if (!settings) return;
    const newLinks = [...settings.institutional_links];
    if (editingLinkIndex !== null && editingLinkIndex >= 0) {
      newLinks[editingLinkIndex] = tempLink;
    } else {
      newLinks.push(tempLink);
    }
    handleChange('institutional_links', newLinks);
    setEditingLinkIndex(null);
    setTempLink({ label: '', url: '', content: '' });
  };

  const removeLink = (index: number) => {
    if (!settings) return;
    setConfirmModal({
      isOpen: true,
      title: 'Remover Link Institucional',
      message: 'Tem certeza que deseja remover este link? Esta ação não pode ser desfeita.',
      onConfirm: () => {
        const newLinks = settings.institutional_links.filter((_, i) => i !== index);
        handleChange('institutional_links', newLinks);
        toast.success('Link removido!');
      }
    });
  };

  const generateAiTextForLink = async () => {
    if (!aiPrompt) {
      toast.error('Digite um prompt para a IA');
      return;
    }
    setGeneratingAi(true);
    try {
      const { data: keys } = await supabase.from('api_keys').select('key_value').eq('service', 'gemini').eq('active', true).maybeSingle();
      if (!keys || !keys.key_value) {
        toast.error('Configure uma chave API do Gemini ativa em Produtos > Configurar APIs');
        return;
      }
      const ai = new GoogleGenAI({ apiKey: keys.key_value });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Escreva um texto curto e profissional para uma seção institucional de site sobre: ${aiPrompt}. O texto deve ser em HTML simples (pode usar <p>, <strong>, <br>).`,
      });
      const text = response.text || '';
      setTempLink(prev => ({ ...prev, content: text }));
      toast.success('Texto gerado!');
      setAiPrompt('');
    } catch (error) {
      toast.error('Erro na IA');
    } finally {
      setGeneratingAi(false);
    }
  };

  if (loading) return <Loading message="Carregando configurações..." />;
  
  if (!settings) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-3xl p-12 shadow-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Zap size={40} className="text-red-600" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Erro ao Carregar Configurações</h2>
          <p className="text-slate-600 mb-8 text-lg">
            Não conseguimos carregar as configurações da loja. Isso geralmente acontece quando o banco de dados não está sincronizado.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Tentar Novamente
            </button>
            <button
              onClick={() => window.location.href = '/admin/dashboard'}
              className="bg-slate-100 text-slate-600 px-10 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft size={20} />
              Voltar ao Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.href = '/admin/dashboard'}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600"
            title="Voltar para Dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-indigo-600" />
            Configurações da Loja
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loading message="" /> : <Save size={20} />}
            Salvar Alterações
          </button>
        </div>
      </div>
      
      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'general', label: 'Geral', icon: SettingsIcon },
          { id: 'marketing', label: 'Marketing & Pixels', icon: Sparkles },
          { id: 'footer', label: 'Rodapé & Links', icon: LinkIcon },
          { id: 'institutional', label: 'Termos & Conteúdo', icon: FileText },
          { id: 'payments', label: 'Pagamentos', icon: CreditCard },
          { id: 'shipping', label: 'Frete', icon: Truck },
          { id: 'billing', label: 'Faturamento (NFe)', icon: FileText },
          { id: 'automation', label: 'Webhook n8n (Global)', icon: Zap },
          { id: 'hours', label: 'Horários', icon: Clock },
          { id: 'visual', label: 'Conteúdo Visual', icon: ImageIcon },
          { id: 'ai_chat', label: 'Chat Inteligente', icon: Sparkles },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-indigo-600 text-white' 
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {activeTab === 'automation' && (
          <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Zap size={28} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Integração n8n (Global)</h2>
                  <p className="text-slate-500">Configure um webhook único que receberá TODOS os eventos da sua loja.</p>
                </div>
              </div>
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loading message="" /> : <Save size={18} />}
                Salvar Automação
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Webhook URL Principal (n8n)</label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={settings.n8n_webhook_url || ''}
                      onChange={e => handleChange('n8n_webhook_url', e.target.value)}
                      placeholder="https://seu-n8n.com/webhook/..."
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                       <Zap size={18} className={settings.n8n_webhook_url ? "text-emerald-500" : "text-slate-300"} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Este webhook recebe eventos de: <strong>Novo Lead, Carrinho Abandonado, Novo Pedido, Pedido Pago e Pedido Enviado.</strong>
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Webhook de Chat de Vendas (n8n)</label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={settings.chat_webhook_url || ''}
                      onChange={e => handleChange('chat_webhook_url', e.target.value)}
                      placeholder="https://seu-dominio.com/webhook/chatbot"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                       <MessageSquare size={18} className={settings.chat_webhook_url ? "text-indigo-500" : "text-slate-300"} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Este webhook recebe mensagens de <strong>Clientes e Visitantes</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Webhook de Chat de Afiliados (n8n)</label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={settings.affiliate_chat_webhook_url || ''}
                      onChange={e => handleChange('affiliate_chat_webhook_url', e.target.value)}
                      placeholder="https://seu-dominio.com/webhook/affiliate-chatbot"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none transition-all font-mono text-sm"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                       <Zap size={18} className={settings.affiliate_chat_webhook_url ? "text-orange-500" : "text-slate-300"} />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                    Este webhook recebe mensagens de <strong>Afiliados Logados</strong>.
                  </p>
                </div>

                <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                      <MessageSquare size={20} />
                      Quem responde o Chat?
                    </h4>
                    {settings.chat_webhook_url && (
                      <button
                        onClick={async () => {
                          try {
                            const response = await fetch(settings.chat_webhook_url.trim(), {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                event: 'test_connection',
                                mensagem: 'Teste de conexão do site',
                                lead_id: 'test_admin',
                                email: 'admin@teste.com'
                              })
                            });
                            if (response.ok) {
                              toast.success('Webhook de Chat respondeu com sucesso!');
                            } else {
                              toast.error(`Erro no Webhook: ${response.status} ${response.statusText}`);
                            }
                          } catch (e) {
                            toast.error('Erro ao conectar com o Webhook. Verifique a URL e se o n8n está ativo.');
                          }
                        }}
                        className="text-xs bg-white text-indigo-600 px-3 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors font-bold"
                      >
                        Testar Webhook
                      </button>
                    )}
                  </div>
                  <div className="flex gap-4">
                    <button
                      onClick={() => handleChange('chat_response_source', 'site')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${
                        settings.chat_response_source === 'site' || !settings.chat_response_source
                          ? 'border-indigo-600 bg-white text-indigo-600 shadow-lg shadow-indigo-100'
                          : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Próprio Site</div>
                      <div className="text-[10px] opacity-70">IA interna responde</div>
                    </button>
                    <button
                      onClick={() => handleChange('chat_response_source', 'webhook')}
                      className={`flex-1 p-4 rounded-2xl border-2 transition-all text-center ${
                        settings.chat_response_source === 'webhook'
                          ? 'border-emerald-600 bg-white text-emerald-600 shadow-lg shadow-emerald-100'
                          : 'border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-sm mb-1">Webhook OpenClaw</div>
                      <div className="text-[10px] opacity-70">n8n/OpenClaw responde</div>
                    </button>
                  </div>
                  <p className="text-[10px] text-indigo-600/60 mt-4 leading-relaxed italic">
                    * Se selecionado Webhook, o site enviará a pergunta para o n8n e aguardará a resposta via API.
                  </p>
                </div>

                <div className="bg-slate-900 p-8 rounded-3xl text-white">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Info size={20} className="text-emerald-400" />
                    Guia de Integração n8n
                  </h3>
                  
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-3">1. Como identificar o evento</h4>
                      <p className="text-xs text-slate-400 mb-2">O site envia um JSON. Use o campo <code className="text-emerald-400">event</code> para filtrar no n8n:</p>
                      <ul className="grid grid-cols-2 gap-2 text-[10px]">
                        <li className="bg-slate-800 p-2 rounded-lg border border-slate-700"><b className="text-white">cart_abandoned</b>: Carrinho</li>
                        <li className="bg-slate-800 p-2 rounded-lg border border-slate-700"><b className="text-white">order_paid</b>: Pagamento (Agradecer)</li>
                        <li className="bg-slate-800 p-2 rounded-lg border border-slate-700"><b className="text-white">chat_message</b>: Pergunta no Chat</li>
                        <li className="bg-slate-800 p-2 rounded-lg border border-slate-700"><b className="text-white">lead:created</b>: Novo Lead</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-3">2. Tabelas que o n8n deve consultar</h4>
                      <div className="space-y-2">
                        <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-[10px]">
                          <b className="text-emerald-400">leads</b>: Para pegar o WhatsApp e Status do cliente.
                        </div>
                        <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-[10px]">
                          <b className="text-emerald-400">orders</b>: Para detalhes da compra e valores.
                        </div>
                        <div className="bg-slate-800 p-2 rounded-lg border border-slate-700 text-[10px]">
                          <b className="text-emerald-400">chat_messages</b>: Onde o n8n deve <b className="text-white">ESCREVER</b> a resposta.
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-3">3. Como responder no Chat do Site</h4>
                      <p className="text-xs text-slate-400 mb-3">O n8n deve fazer um POST para esta URL:</p>
                      <div className="bg-slate-800 p-4 rounded-xl font-mono text-[10px] text-emerald-400 overflow-x-auto border border-slate-700">
                        {`URL: https://<seu-projeto>.supabase.co/rest/v1/chat_messages
Header: apikey: <sua-key>
Body: {
  "sender_id": null,
  "receiver_id": "{{ lead_id_recebido }}",
  "message": "Sua resposta aqui",
  "is_human": false,
  "is_read": true
}`}
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-800">
                      <h4 className="text-xs font-black text-slate-500 uppercase mb-3">3. Fluxo OpenClaw (Isolado)</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        O site <b>não</b> fala diretamente com o OpenClaw. O site avisa o n8n sobre o evento, e o n8n decide se envia via WhatsApp (OpenClaw) ou E-mail. 
                        <br/><br/>
                        Se o lead for <b>quente/morno</b> e tiver WhatsApp, o n8n dispara a mensagem pelo OpenClaw. Se não, envia e-mail.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
                  <h4 className="font-bold text-indigo-900 mb-4 flex items-center gap-2">
                    <Sparkles size={20} />
                    Lógica de Leads (Quente/Morna)
                  </h4>
                  <p className="text-sm text-indigo-700 leading-relaxed mb-4">
                    O sistema identifica automaticamente a temperatura do lead com base no comportamento.
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-indigo-100">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-xs font-bold text-slate-700">Lead Quente: Carrinho Iniciado</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-indigo-100">
                      <div className="w-2 h-2 bg-orange-500 rounded-full" />
                      <span className="text-xs font-bold text-slate-700">Lead Morna: Visitou 3+ produtos</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Eventos Disponíveis</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'lead:created',
                      'cart_abandoned',
                      'new_order',
                      'order_paid',
                      'order_shipped'
                    ].map(event => (
                      <div key={event} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg text-[10px] font-bold text-slate-600 border border-slate-100">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        {event}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
        {activeTab === 'ai_chat' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="text-indigo-600" />
                Configurações do Chat Inteligente (IA)
              </h2>
              <button
                onClick={async () => {
                  await handleSave(false);
                  toast.success('Memória da IA salva com sucesso!', {
                    icon: '🧠',
                    duration: 4000,
                    style: {
                      borderRadius: '10px',
                      background: '#333',
                      color: '#fff',
                    },
                  });
                }}
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <Loading message="" /> : <Save size={18} />}
                Salvar Memória
              </button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Mensagem de Notificação (Gatilho)</label>
                <p className="text-xs text-slate-500 mb-2">Esta mensagem aparecerá como um balão para chamar a atenção do usuário após alguns segundos.</p>
                <input
                  type="text"
                  value={settings.ai_chat_triggers || ''}
                  onChange={(e) => handleChange('ai_chat_triggers', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Olá! Tenho uma oferta especial para você hoje. Vamos conversar?"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Regras de Vendas e Comportamento da IA</label>
                <p className="text-xs text-slate-500 mb-2">Defina como a IA deve se comportar, quais gatilhos mentais usar e como converter vendas. A IA já conhece todos os produtos ativos (nome, preço, estoque, composição e descrição).</p>
                <textarea
                  value={settings.ai_chat_rules || ''}
                  onChange={(e) => handleChange('ai_chat_rules', e.target.value)}
                  className="w-full h-64 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="Ex: 1. Use gatilhos mentais de escassez..."
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Memória Persistente da IA</label>
                <p className="text-xs text-slate-500 mb-2">Informações que a IA deve sempre lembrar sobre a loja, promoções fixas ou preferências de atendimento.</p>
                <textarea
                  value={settings.ai_chat_memory || ''}
                  onChange={(e) => handleChange('ai_chat_memory', e.target.value)}
                  className="w-full h-48 p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                  placeholder="Ex: A loja oferece 10% de desconto na primeira compra com o cupom BEMVINDO..."
                />
              </div>

              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div>
                  <h3 className="font-bold text-indigo-900">Auto Conhecimento (IA Aprendiz)</h3>
                  <p className="text-xs text-indigo-700">Se ativado, a IA pesquisará na internet quando não souber algo sobre a composição dos produtos e salvará automaticamente na memória.</p>
                </div>
                <button
                  onClick={() => handleChange('ai_auto_learning', !settings.ai_auto_learning)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    settings.ai_auto_learning ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.ai_auto_learning ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>
        )}

        {activeTab === 'general' && (
          <>
            {/* Card de Chaves de API - Adicionado para facilitar acesso */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Configuração de APIs</h2>
                    <p className="text-xs text-slate-500">Gerencie as chaves do Gemini e outros serviços</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/admin/products')}
                  className="flex items-center gap-2 text-indigo-600 font-bold text-xs hover:underline"
                >
                  Ir para Gestão de APIs
                  <ArrowLeft size={14} className="rotate-180" />
                </button>
              </div>
              
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 items-start">
                <Info className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-amber-800 font-medium leading-relaxed">
                    As chaves de API do Gemini são essenciais para o funcionamento do Chat Inteligente. 
                    Se o agente parar de responder (como no erro 400), verifique se suas chaves ainda são válidas.
                  </p>
                  <button 
                    onClick={() => navigate('/admin/products')}
                    className="mt-2 text-[10px] font-black text-amber-900 underline uppercase tracking-widest"
                  >
                    Configurar agora em Produtos &gt; APIs
                  </button>
                </div>
              </div>
            </section>

            {/* Informações da Empresa */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Informações da Empresa</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa</label>
                  <input
                    type="text"
                    value={settings.company_name || ''}
                    onChange={(e) => handleChange('company_name', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={settings.cnpj || ''}
                    onChange={(e) => handleChange('cnpj', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Texto da Barra Superior</label>
                  <input
                    type="text"
                    value={settings.top_bar_text || ''}
                    onChange={(e) => handleChange('top_bar_text', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: Envio Brasil | 7 dias devolução | 10x sem juros"
                  />
                </div>
                
                <div className="md:col-span-2 pt-4 border-t border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Seção de Campanhas (Banners)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título da Seção</label>
                      <input
                        type="text"
                        value={settings.promotions_section_title || ''}
                        onChange={(e) => handleChange('promotions_section_title', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: CAMPANHAS E PROMOÇÕES"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo (Opcional)</label>
                      <input
                        type="text"
                        value={settings.promotions_section_subtitle || ''}
                        onChange={(e) => handleChange('promotions_section_subtitle', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Aproveite nossas ofertas exclusivas"
                      />
                    </div>
                  </div>
                </div>

                <div className="md:col-span-2 pt-4 border-t border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Seção de Produtos (Vitrine)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Título da Seção</label>
                      <input
                        type="text"
                        value={settings.products_section_title || ''}
                        onChange={(e) => handleChange('products_section_title', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Novidades da Estação"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Subtítulo (Opcional)</label>
                      <input
                        type="text"
                        value={settings.products_section_subtitle || ''}
                        onChange={(e) => handleChange('products_section_subtitle', e.target.value)}
                        className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        placeholder="Ex: Confira as últimas tendências..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}

        {activeTab === 'footer' && (
          <>
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Contato e Redes Sociais (Rodapé)</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Telefone Fixo</label>
                  <input
                    type="text"
                    value={settings.phone || ''}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={settings.whatsapp || ''}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={settings.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={settings.address || ''}
                    onChange={(e) => handleChange('address', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEP da Loja (Para cálculo de frete)</label>
                  <input
                    type="text"
                    value={settings.origin_zip_code || ''}
                    onChange={(e) => handleChange('origin_zip_code', e.target.value)}
                    className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="Ex: 01001-000"
                  />
                </div>
                <div className="md:col-span-2 pt-4 border-t border-slate-100 mt-4">
                  <h3 className="text-lg font-bold text-slate-900 mb-4">Redes Sociais</h3>
                  <div className="space-y-3">
                    {settings.social_links.map((link, index) => (
                      <div key={index} className="flex gap-3 items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <select 
                          value={link.platform}
                          onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                          className="p-2 border border-slate-300 rounded-lg bg-white"
                        >
                          <option value="">Selecione...</option>
                          <option value="Instagram">Instagram</option>
                          <option value="Facebook">Facebook</option>
                          <option value="TikTok">TikTok</option>
                          <option value="Twitter">Twitter</option>
                          <option value="Youtube">Youtube</option>
                          <option value="Linkedin">Linkedin</option>
                          <option value="Pinterest">Pinterest</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Outro">Outro</option>
                        </select>
                        <input
                          type="text"
                          placeholder="URL do Perfil"
                          value={link.url}
                          onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                          className="flex-1 p-2 border border-slate-300 rounded-lg"
                        />
                        <button
                          onClick={() => removeSocialLink(index)}
                          className="p-2 text-rose-600 hover:bg-rose-100 rounded-lg"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addSocialLink}
                      className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
                    >
                      <Plus size={20} /> Adicionar Rede Social
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Links Institucionais (Rodapé)</h2>
              
              {/* Lista de Links (Cards) */}
              <div className="space-y-4">
                {settings.institutional_links.map((link, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors">
                    <div>
                      <h3 className="font-bold text-slate-900">{link.label || '(Sem título)'}</h3>
                      <p className="text-sm text-slate-500">{link.url || '(Sem URL)'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditLink(index)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <SettingsIcon size={20} />
                      </button>
                      <button
                        onClick={() => removeLink(index)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}

                {settings.institutional_links.length === 0 && (
                  <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                    Nenhum link cadastrado.
                  </div>
                )}

                <button
                  onClick={() => {
                    setEditingLinkIndex(-1); // -1 indica novo item
                    setTempLink({ label: '', url: '', content: '' });
                  }}
                  className="w-full flex items-center justify-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-3 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 transition-all"
                >
                  <Plus size={20} /> Adicionar Novo Link
                </button>
              </div>

              {/* Modal / Card de Edição */}
              {editingLinkIndex !== null && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  >
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                      <h3 className="text-xl font-bold text-slate-900">
                        {editingLinkIndex === -1 ? 'Novo Link Institucional' : 'Editar Link'}
                      </h3>
                      <button onClick={cancelEditLink} className="text-slate-400 hover:text-slate-600">
                        <Trash2 size={24} className="rotate-45" /> {/* Usando Trash rotacionado como X improvisado ou importar X */}
                      </button>
                    </div>
                    
                    <div className="p-6 space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Link</label>
                          <input
                            type="text"
                            value={tempLink.label}
                            onChange={(e) => setTempLink({ ...tempLink, label: e.target.value })}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: Sobre Nós"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">URL (Opcional)</label>
                          <input
                            type="text"
                            value={tempLink.url}
                            onChange={(e) => setTempLink({ ...tempLink, url: e.target.value })}
                            className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                            placeholder="Ex: /sobre"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-slate-700">Conteúdo do Popup (HTML/Texto)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Prompt para IA..."
                              value={aiPrompt}
                              onChange={(e) => setAiPrompt(e.target.value)}
                              className="w-48 p-1 px-2 border border-slate-300 rounded-lg text-xs"
                            />
                            <button
                              onClick={generateAiTextForLink}
                              disabled={generatingAi}
                              className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-purple-700 disabled:opacity-50"
                            >
                              <Sparkles size={14} />
                              IA
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={tempLink.content}
                          onChange={(e) => setTempLink({ ...tempLink, content: e.target.value })}
                          rows={8}
                          className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                          placeholder="<p>Escreva aqui o conteúdo que aparecerá ao clicar no link...</p>"
                        />
                        <p className="text-xs text-slate-500 mt-2">
                          Dica: Se preencher o conteúdo, o link abrirá um popup. Se deixar vazio e preencher a URL, navegará para a página.
                        </p>
                      </div>
                    </div>

                    <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50 rounded-b-2xl">
                      <button
                        onClick={cancelEditLink}
                        className="px-6 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={saveLink}
                        className="px-6 py-2 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-xl transition-colors flex items-center gap-2"
                      >
                        <Save size={18} />
                        {editingLinkIndex === -1 ? 'Adicionar Link' : 'Salvar Alterações'}
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </section>
          </>
        )}

        {activeTab === 'billing' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <section className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="mb-6">
                <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                  <FileText className="text-indigo-600" />
                  Faturamento e Nota Fiscal
                </h2>
                <p className="text-slate-500">Configure a emissão de Notas Fiscais Eletrônicas (NFe).</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Provedor de NFe</label>
                  <select
                    value={settings.nfe_provider || 'manual'}
                    onChange={(e) => handleChange('nfe_provider', e.target.value)}
                    className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium"
                  >
                    <option value="manual">Emissão Manual (Gera arquivo de dados)</option>
                    <option value="focusnfe">Focus NFe</option>
                    <option value="webmania">WebManiaBR</option>
                    <option value="bling">Bling ERP</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    A opção "Manual" gera um arquivo com os dados do pedido para você preencher a NF no site da SEFAZ ou outro sistema.
                  </p>
                </div>

                {settings.nfe_provider !== 'manual' && (
                  <>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Token de Acesso (API Key)</label>
                      <input
                        type="password"
                        value={settings.nfe_token || ''}
                        onChange={(e) => handleChange('nfe_token', e.target.value)}
                        className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                        placeholder="Insira o token fornecido pelo sistema de NFe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">ID da Empresa / CNPJ</label>
                      <input
                        type="text"
                        value={settings.nfe_company_id || ''}
                        onChange={(e) => handleChange('nfe_company_id', e.target.value)}
                        className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 bg-slate-50"
                        placeholder="ID da empresa no sistema ou CNPJ"
                      />
                    </div>
                  </>
                )}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'marketing' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Pixels de Rastreamento</h2>
                  <p className="text-slate-500">Configure seus pixels do Facebook, Google e outros para remarketing.</p>
                </div>
                <button 
                  onClick={addPixel}
                  className="flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl font-bold hover:bg-indigo-100 transition-colors"
                >
                  <Plus size={20} /> Adicionar Pixel
                </button>
              </div>
              <div className="flex items-center gap-2 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <input 
                  type="checkbox" 
                  id="debug_mode"
                  checked={settings.debug_mode}
                  onChange={(e) => handleChange('debug_mode', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="debug_mode" className="font-bold text-slate-700 cursor-pointer">Modo de Teste (Debug)</label>
                <p className="text-sm text-slate-500 ml-2 italic">- Loga eventos no console em vez de enviar para as plataformas.</p>
              </div>

              <div className="space-y-4">
                {settings.tracking_pixels?.map((pixel, index) => (
                  <div key={index} className="flex flex-col md:flex-row gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100 relative group">
                    <button 
                      onClick={() => removePixel(index)}
                      className="absolute -top-2 -right-2 p-2 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                    <div className="flex-1">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Plataforma</label>
                      <select 
                        value={pixel.platform}
                        onChange={e => updatePixel(index, 'platform', e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                        <option value="">Selecione...</option>
                        <option value="facebook">Facebook Pixel</option>
                        <option value="google_analytics">Google Analytics</option>
                        <option value="google_ads">Google Ads</option>
                        <option value="tiktok">TikTok Pixel</option>
                        <option value="other">Outro</option>
                      </select>
                    </div>
                    <div className="flex-[2]">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">ID do Pixel / Script</label>
                      <input 
                        type="text"
                        value={pixel.pixel_id}
                        onChange={e => updatePixel(index, 'pixel_id', e.target.value)}
                        placeholder="Ex: 1234567890"
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <button 
                        onClick={() => updatePixel(index, 'active', !pixel.active)}
                        className={`px-4 py-3 rounded-xl font-bold transition-all ${pixel.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}
                      >
                        {pixel.active ? 'Ativo' : 'Inativo'}
                      </button>
                    </div>
                  </div>
                ))}
                {(!settings.tracking_pixels || settings.tracking_pixels.length === 0) && (
                  <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <Sparkles size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-500 italic">Nenhum pixel configurado ainda.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Zap size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Automação n8n</h2>
                  <p className="text-slate-500">Recuperação de Carrinho Abandonado e Notificações.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Webhook URL (n8n)</label>
                  <input 
                    type="url"
                    value={settings.n8n_webhook_url || ''}
                    onChange={e => handleChange('n8n_webhook_url', e.target.value)}
                    placeholder="https://seu-n8n.com/webhook/..."
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-mono text-sm"
                  />
                  <p className="text-xs text-slate-400 mt-2">
                    Este webhook será disparado sempre que um carrinho for abandonado ou um pedido for iniciado.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'institutional' && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <FileText className="text-indigo-600" />
                Páginas Institucionais (Termos, Privacidade, etc.)
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Crie e edite as páginas de Termos de Uso, Política de Privacidade e outras informações legais que aparecem no rodapé.
              </p>
              
              <div className="space-y-4">
                {settings.institutional_links.map((link, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200 hover:border-indigo-200 transition-colors">
                    <div>
                      <h3 className="font-bold text-slate-900">{link.label || '(Sem título)'}</h3>
                      <p className="text-sm text-slate-500">{link.url || '(Sem URL)'}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditLink(index)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar Conteúdo"
                      >
                        <SettingsIcon size={20} />
                      </button>
                      <button
                        onClick={() => removeLink(index)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => {
                    setEditingLinkIndex(-1);
                    setTempLink({ label: '', url: '', content: '' });
                  }}
                  className="w-full flex items-center justify-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-3 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 transition-all"
                >
                  <Plus size={20} /> Adicionar Nova Página Legal
                </button>
              </div>
            </section>

            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Sparkles className="text-purple-600" />
                Termos e Condições de Afiliados
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Este texto aparece na página de cadastro de novos afiliados.
              </p>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Digite um prompt para gerar os termos com IA..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 p-3 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                />
                <button
                  onClick={() => generateAiText('affiliate_terms')}
                  disabled={generatingAi}
                  className="px-6 py-2 bg-purple-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-100"
                >
                  <Sparkles size={18} />
                  {generatingAi ? 'Gerando...' : 'Gerar com IA'}
                </button>
              </div>
              <textarea
                value={settings.affiliate_terms || ''}
                onChange={(e) => handleChange('affiliate_terms', e.target.value)}
                rows={12}
                className="w-full p-4 border border-slate-300 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-mono text-sm bg-slate-50"
                placeholder="Cole ou gere aqui os termos e condições para seus afiliados..."
              />
            </section>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-6">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Formas de Pagamento (Exibição)</h2>
              <p className="text-xs text-slate-500 mb-4">Estas opções são exibidas no rodapé e em outras áreas da loja para informar os clientes sobre os métodos aceitos.</p>
              <div className="space-y-4">
              {settings.payment_methods.map((method, index) => (
                <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <input
                      type="text"
                      placeholder="Nome (Ex: Nubank)"
                      value={method.name}
                      onChange={(e) => {
                        const newMethods = [...settings.payment_methods];
                        newMethods[index].name = e.target.value;
                        handleChange('payment_methods', newMethods);
                      }}
                      className="p-2 border border-slate-300 rounded-lg"
                    />
                    <select
                      value={method.type}
                      onChange={(e) => {
                        const newMethods = [...settings.payment_methods];
                        newMethods[index].type = e.target.value;
                        handleChange('payment_methods', newMethods);
                      }}
                      className="p-2 border border-slate-300 rounded-lg"
                    >
                      <option value="pix">PIX</option>
                      <option value="card">Cartão de Crédito</option>
                      <option value="boleto">Boleto</option>
                      <option value="bank">Transferência Bancária</option>
                    </select>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={method.active}
                        onChange={(e) => {
                          const newMethods = [...settings.payment_methods];
                          newMethods[index].active = e.target.checked;
                          handleChange('payment_methods', newMethods);
                        }}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                      <span className="text-sm font-medium">Ativo</span>
                    </label>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                      {method.type === 'pix' ? 'Chave PIX' : 
                       method.type === 'bank' ? 'Dados Bancários (Banco, Ag, Conta)' : 
                       method.type === 'boleto' ? 'Instruções do Boleto' : 'Informações Adicionais'}
                    </label>
                    <input
                      type="text"
                      value={method.details || ''}
                      onChange={(e) => {
                        const newMethods = [...settings.payment_methods];
                        newMethods[index].details = e.target.value;
                        handleChange('payment_methods', newMethods);
                      }}
                      placeholder="Ex: sua@chavepix.com ou Banco X, Ag 0001, CC 12345-6"
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                  <button
                    onClick={() => {
                      const newMethods = settings.payment_methods.filter((_, i) => i !== index);
                      handleChange('payment_methods', newMethods);
                    }}
                    className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
              <button
                onClick={() => handleChange('payment_methods', [...settings.payment_methods, { name: '', type: 'pix', active: true }])}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={20} /> Adicionar Forma de Pagamento
              </button>
            </div>
            </section>
          </div>
        )}

        {activeTab === 'shipping' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-900">Métodos de Entrega</h2>
              <p className="text-xs text-slate-500">Configure as opções de frete disponíveis na loja.</p>
            </div>

            <div className="mb-8 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <label className="block text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                <Truck size={18} />
                Valor Mínimo para Frete Grátis (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={settings.free_shipping_threshold || ''}
                onChange={(e) => handleChange('free_shipping_threshold', parseFloat(e.target.value))}
                className="w-full p-3 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white text-emerald-900 font-bold"
                placeholder="Ex: 299.00"
              />
              <p className="text-xs text-emerald-600 mt-2">
                Pedidos acima deste valor terão frete grátis automaticamente. Deixe em branco ou 0 para desativar.
              </p>
            </div>
            
            <div className="space-y-4">
              {settings.shipping_methods.map((method, index) => (
                <div key={index} className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nome do Método</label>
                      <input
                        type="text"
                        value={method.name}
                        onChange={(e) => {
                          const newMethods = [...settings.shipping_methods];
                          newMethods[index].name = e.target.value;
                          handleChange('shipping_methods', newMethods);
                        }}
                        placeholder="Ex: Correios (PAC)"
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Preço (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={method.price}
                        onChange={(e) => {
                          const newMethods = [...settings.shipping_methods];
                          newMethods[index].price = parseFloat(e.target.value);
                          handleChange('shipping_methods', newMethods);
                        }}
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Prazo Estimado</label>
                      <input
                        type="text"
                        value={method.deadline}
                        onChange={(e) => {
                          const newMethods = [...settings.shipping_methods];
                          newMethods[index].deadline = e.target.value;
                          handleChange('shipping_methods', newMethods);
                        }}
                        placeholder="Ex: 7 a 10 dias úteis"
                        className="w-full p-2 border border-slate-300 rounded-lg bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={method.active}
                        onChange={(e) => {
                          const newMethods = [...settings.shipping_methods];
                          newMethods[index].active = e.target.checked;
                          handleChange('shipping_methods', newMethods);
                        }}
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                      <span className="text-sm font-medium">Ativo</span>
                    </label>
                    <button
                      onClick={() => {
                        const newMethods = settings.shipping_methods.filter((_, i) => i !== index);
                        handleChange('shipping_methods', newMethods);
                      }}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => handleChange('shipping_methods', [...settings.shipping_methods, { name: '', price: 0, deadline: '', active: true }])}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2 rounded-lg transition-colors"
              >
                <Plus size={20} /> Adicionar Opção de Frete
              </button>
            </div>
          </section>
        )}

        {activeTab === 'hours' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Horário de Atendimento</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resumo (Ex: Segunda a Sexta - 8h ás 18h)</label>
                <input
                  type="text"
                  value={settings.business_hours || ''}
                  onChange={(e) => handleChange('business_hours', e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Detalhes Completos (Site 24h e Estabelecimento)</label>
                <textarea
                  value={settings.business_hours_details || ''}
                  onChange={(e) => handleChange('business_hours_details', e.target.value)}
                  rows={5}
                  className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  placeholder="Descreva os horários detalhados..."
                />
              </div>
            </div>
          </section>
        )}

        {activeTab === 'visual' && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Conteúdo Visual e Identidade</h2>
            <p className="text-sm text-slate-500 mb-8">Gerencie logotipos, ícones e textos fixos do site.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Logo Principal */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">Logo Principal (SVG ou PNG)</label>
                <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                  {siteContent.find(c => c.key === 'site_logo')?.value ? (
                    <>
                      <img 
                        src={siteContent.find(c => c.key === 'site_logo')?.value} 
                        alt="Logo" 
                        className="max-h-32 object-contain p-4"
                        key={siteContent.find(c => c.key === 'site_logo')?.value}
                      />
                      <button 
                        onClick={() => deleteSiteContent('site_logo')}
                        className="absolute top-2 right-2 p-2 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="text-slate-300" size={48} />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold text-sm">Alterar Logo</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleSiteImageUpload(e, 'site_logo')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Favicon */}
              <div className="space-y-4">
                <label className="block text-sm font-bold text-slate-700 uppercase tracking-widest">Favicon (Ícone da Aba)</label>
                <div className="w-24 h-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden group">
                  {siteContent.find(c => c.key === 'site_favicon')?.value ? (
                    <>
                      <img 
                        src={siteContent.find(c => c.key === 'site_favicon')?.value} 
                        alt="Favicon" 
                        className="w-12 h-12 object-contain"
                        key={siteContent.find(c => c.key === 'site_favicon')?.value}
                      />
                      <button 
                        onClick={() => deleteSiteContent('site_favicon')}
                        className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <ImageIcon className="text-slate-300" size={24} />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white font-bold text-[10px]">Alterar</span>
                  </div>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleSiteImageUpload(e, 'site_favicon')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {/* Textos Fixos */}
              <div className="md:col-span-2 space-y-6 pt-6 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Marca (Texto)</label>
                    <input
                      type="text"
                      defaultValue={siteContent.find(c => c.key === 'brand_name')?.value || 'G-Fit Life'}
                      onBlur={(e) => updateSiteContent('brand_name', e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Slogan / Tagline</label>
                    <input
                      type="text"
                      defaultValue={siteContent.find(c => c.key === 'site_tagline')?.value || 'Saúde, Beleza e Emagrecimento'}
                      onBlur={(e) => updateSiteContent('site_tagline', e.target.value)}
                      className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
      />
    </div>
  );
}
