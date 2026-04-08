import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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
  nfe_provider?: string;
  nfe_token?: string;
  nfe_company_id?: string;
  chat_webhook_url?: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // general, institutional, payments, shipping, hours, footer, marketing, visual
  const [siteContent, setSiteContent] = useState<any[]>([]);
  const [loadingContent, setLoadingContent] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
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
      const { data, error } = await supabase
        .from('store_settings')
        .select('*');

      if (error) {
        console.error('Erro ao buscar configurações:', error);
        if (error.message.includes('column') || error.message.includes('does not exist') || error.code === '42P01' || error.code === 'PGRST204') {
          setShowSqlModal(true);
          toast.error('Erro de banco de dados detectado. Por favor, execute o script de reparo.');
          return;
        }
        throw error;
      }

      console.log('Dados recebidos do banco:', data);

      let settingsData;
      if (data && data.length > 0) {
        settingsData = data[0];
        if (data.length > 1) {
          console.warn('Atenção: Múltiplas linhas encontradas em store_settings. Usando a primeira.');
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
            institutional_links: []
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

      setSettings({
        ...settingsData,
        payment_methods: settingsData.payment_methods || [],
        shipping_methods: settingsData.shipping_methods || [
          { name: 'Correios (PAC)', price: 25.90, deadline: '7 a 10 dias úteis', active: true },
          { name: 'Correios (SEDEX)', price: 45.90, deadline: '2 a 4 dias úteis', active: true }
        ],
        free_shipping_threshold: settingsData.free_shipping_threshold !== undefined ? settingsData.free_shipping_threshold : 299.00,
        institutional_links: settingsData.institutional_links || [],
        social_links: socialLinks,
        promotions_section_title: settingsData.promotions_section_title || 'CAMPANHAS E PROMOÇÕES',
        promotions_section_subtitle: settingsData.promotions_section_subtitle || 'Aproveite nossas ofertas exclusivas',
        products_section_title: settingsData.products_section_title || 'Novidades da Estação',
        products_section_subtitle: settingsData.products_section_subtitle || 'Confira as últimas tendências e ofertas exclusivas que preparamos para você.',
        tracking_pixels: settingsData.tracking_pixels || [],
        debug_mode: settingsData.debug_mode || false,
        n8n_webhook_url: settingsData.n8n_webhook_url || '',
        origin_zip_code: settingsData.origin_zip_code || '',
        ai_chat_rules: settingsData.ai_chat_rules || '',
        ai_chat_triggers: settingsData.ai_chat_triggers || '',
        ai_auto_learning: settingsData.ai_auto_learning || false,
        nfe_provider: settingsData.nfe_provider || 'manual',
        nfe_token: settingsData.nfe_token || '',
        nfe_company_id: settingsData.nfe_company_id || '',
        chat_webhook_url: settingsData.chat_webhook_url || ''
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
      const payload = {
        company_name: settings.company_name,
        cnpj: settings.cnpj,
        address: settings.address,
        cep: settings.cep,
        phone: settings.phone,
        whatsapp: settings.whatsapp,
        email: settings.email,
        instagram: settings.instagram,
        facebook: settings.facebook,
        social_links: settings.social_links,
        business_hours: settings.business_hours,
        business_hours_details: settings.business_hours_details,
        payment_methods: settings.payment_methods,
        shipping_methods: settings.shipping_methods,
        free_shipping_threshold: settings.free_shipping_threshold,
        institutional_links: settings.institutional_links,
        affiliate_terms: settings.affiliate_terms,
        top_bar_text: settings.top_bar_text,
        promotions_section_title: settings.promotions_section_title,
        promotions_section_subtitle: settings.promotions_section_subtitle,
        products_section_title: settings.products_section_title,
        products_section_subtitle: settings.products_section_subtitle,
        tracking_pixels: settings.tracking_pixels,
        debug_mode: settings.debug_mode,
        n8n_webhook_url: settings.n8n_webhook_url,
        origin_zip_code: settings.origin_zip_code,
        ai_chat_rules: settings.ai_chat_rules,
        ai_chat_triggers: settings.ai_chat_triggers,
        ai_auto_learning: settings.ai_auto_learning,
        nfe_provider: settings.nfe_provider,
        nfe_token: settings.nfe_token,
        nfe_company_id: settings.nfe_company_id,
        chat_webhook_url: settings.chat_webhook_url
      };

      console.log('Salvando configurações:', payload);

      const { error } = await supabase
        .from('store_settings')
        .update(payload)
        .eq('id', settings.id);

      if (error) throw error;
      if (showToast) {
        toast.success('Configurações salvas e aplicadas na loja!');
      }
    } catch (error: any) {
      console.error('Error saving settings:', error);
      if (error.message?.includes('column') || error.message?.includes('does not exist') || error.code === 'PGRST204') {
        setShowSqlModal(true);
        toast.error('Erro de banco de dados: Colunas faltando. Use o botão "Reparar Banco" que apareceu no topo.');
      } else {
        toast.error('Erro ao salvar: ' + error.message);
      }
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
  
  // Se não tem settings mas tem erro de tabela, mostra o SQL
  if (!settings && showSql) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
          <h2 className="text-2xl font-bold text-rose-700 mb-4">Banco de Dados Incompleto</h2>
          <p className="text-rose-600 mb-6">
            As tabelas necessárias para as configurações da loja não foram encontradas.
            Por favor, execute o comando SQL abaixo no Editor SQL do Supabase.
          </p>
          <div className="bg-slate-900 rounded-xl p-4 text-left overflow-x-auto mb-6">
            <pre id="sql-code-main" className="text-emerald-400 text-xs font-mono">
{`-- Execute este SQL no Editor SQL do Supabase para corrigir os erros

-- 0. Adicionar colunas de Frete, Social e IA (Novo)
do $$
begin
    -- Colunas para store_settings
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'social_links') then
        alter table public.store_settings add column social_links jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'shipping_methods') then
        alter table public.store_settings add column shipping_methods jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'free_shipping_threshold') then
        alter table public.store_settings add column free_shipping_threshold numeric(10,2) default 299.00;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_rules') then
        alter table public.store_settings add column ai_chat_rules text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_triggers') then
        alter table public.store_settings add column ai_chat_triggers text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_auto_learning') then
        alter table public.store_settings add column ai_auto_learning boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'n8n_webhook_url') then
        alter table public.store_settings add column n8n_webhook_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'origin_zip_code') then
        alter table public.store_settings add column origin_zip_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'debug_mode') then
        alter table public.store_settings add column debug_mode boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'tracking_pixels') then
        alter table public.store_settings add column tracking_pixels jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_provider') then
        alter table public.store_settings add column nfe_provider text default 'manual';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_token') then
        alter table public.store_settings add column nfe_token text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_company_id') then
        alter table public.store_settings add column nfe_company_id text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_title') then
        alter table public.store_settings add column promotions_section_title text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_subtitle') then
        alter table public.store_settings add column promotions_section_subtitle text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_title') then
        alter table public.store_settings add column products_section_title text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_subtitle') then
        alter table public.store_settings add column products_section_subtitle text;
    end if;
end $$;

-- 0.1 Adicionar colunas na tabela orders (Novo)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'tracking_code') then
        alter table public.orders add column tracking_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'shipping_label_url') then
        alter table public.orders add column shipping_label_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'shipping_method') then
        alter table public.orders add column shipping_method text;
    end if;
end $$;

-- 0.2 Criar tabela de carrinhos abandonados (Novo)
create table if not exists public.abandoned_carts (
  id uuid default gen_random_uuid() primary key,
  customer_email text,
  customer_name text,
  customer_phone text,
  cart_items jsonb default '[]'::jsonb,
  total numeric(10,2),
  status text default 'abandoned',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para abandoned_carts
alter table public.abandoned_carts enable row level security;
drop policy if exists "Enable read for authenticated users" on public.abandoned_carts;
create policy "Enable read for authenticated users" on public.abandoned_carts for select using (auth.role() = 'authenticated');
drop policy if exists "Enable insert/update for all" on public.abandoned_carts;
create policy "Enable insert/update for all" on public.abandoned_carts for insert with check (true);
drop policy if exists "Enable update for all" on public.abandoned_carts;
create policy "Enable update for all" on public.abandoned_carts for update using (true);

-- 1. Atualizar tabela de categorias (Novo)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'icon') then
        alter table public.categories add column icon text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'image_url') then
        alter table public.categories add column image_url text;
    end if;
end $$;

-- 2. Criar tabela de configurações da loja se não existir
create table if not exists public.store_settings (
  id uuid default gen_random_uuid() primary key,
  company_name text,
  cnpj text,
  address text,
  cep text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  facebook text,
  business_hours text,
  business_hours_details text,
  payment_methods jsonb default '[]'::jsonb,
  shipping_methods jsonb default '[]'::jsonb,
  institutional_links jsonb default '[]'::jsonb,
  affiliate_terms text,
  top_bar_text text,
  promotions_section_title text,
  promotions_section_subtitle text,
  products_section_title text,
  products_section_subtitle text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Adicionar colunas faltantes na tabela campaigns
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'text_color') then
        alter table public.campaigns add column text_color text default '#ffffff';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'background_color') then
        alter table public.campaigns add column background_color text default '#000000';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'badge_text') then
        alter table public.campaigns add column badge_text text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'button_text') then
        alter table public.campaigns add column button_text text;
    end if;
end $$;

-- 3. Adicionar colunas faltantes na tabela categories (ícone e imagem)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'icon') then
        alter table public.categories add column icon text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'image_url') then
        alter table public.categories add column image_url text;
    end if;
end $$;

-- 4. Adicionar colunas faltantes na tabela store_settings (se já existir)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_title') then
        alter table public.store_settings add column promotions_section_title text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_subtitle') then
        alter table public.store_settings add column promotions_section_subtitle text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_title') then
        alter table public.store_settings add column products_section_title text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_subtitle') then
        alter table public.store_settings add column products_section_subtitle text;
    end if;
end $$;

-- 5. Habilitar RLS e Políticas para store_settings
alter table public.store_settings enable row level security;

drop policy if exists "Enable read access for all users" on public.store_settings;
create policy "Enable read access for all users" on public.store_settings for select using (true);

drop policy if exists "Enable insert for authenticated users only" on public.store_settings;
create policy "Enable insert for authenticated users only" on public.store_settings for insert with check (auth.role() = 'authenticated');

drop policy if exists "Enable update for authenticated users only" on public.store_settings;
create policy "Enable update for authenticated users only" on public.store_settings for update using (auth.role() = 'authenticated');

-- 6. Inserir configuração inicial se não existir
insert into public.store_settings (
    company_name, 
    promotions_section_title, 
    promotions_section_subtitle, 
    products_section_title,
    products_section_subtitle,
    payment_methods, 
    shipping_methods,
    institutional_links
)
select 
    'Minha Loja', 
    'CAMPANHAS E PROMOÇÕES', 
    'Aproveite nossas ofertas exclusivas', 
    'Novidades da Estação',
    'Confira as últimas tendências e ofertas exclusivas que preparamos para você.',
    '[]'::jsonb, 
    '[]'::jsonb,
    '[]'::jsonb
where not exists (select 1 from public.store_settings);

-- 7. Adicionar colunas para PIX de afiliados e Chat IA
do $$
begin
    -- Afiliados
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_name') then
        alter table public.affiliates add column pix_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_cpf') then
        alter table public.affiliates add column pix_cpf text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_bank') then
        alter table public.affiliates add column pix_bank text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_account') then
        alter table public.affiliates add column pix_account text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_agency') then
        alter table public.affiliates add column pix_agency text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'total_paid') then
        alter table public.affiliates add column total_paid numeric(10,2) default 0;
    end if;

    -- Pagamentos de Afiliados
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_name') then
        alter table public.affiliate_payments add column pix_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_cpf') then
        alter table public.affiliate_payments add column pix_cpf text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_bank') then
        alter table public.affiliate_payments add column pix_bank text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_account') then
        alter table public.affiliate_payments add column pix_account text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_agency') then
        alter table public.affiliate_payments add column pix_agency text;
    end if;

    -- Configurações da Loja (IA)
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_rules') then
        alter table public.store_settings add column ai_chat_rules text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_triggers') then
        alter table public.store_settings add column ai_chat_triggers text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_auto_learning') then
        alter table public.store_settings add column ai_auto_learning boolean default false;
    end if;
end $$;

-- 8. Tabela de Automações (n8n-like)
create table if not exists public.automations (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    trigger_type text not null,
    action_type text not null,
    config jsonb default '{}'::jsonb,
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.automations enable row level security;

drop policy if exists "Enable read access for all users" on public.automations;
create policy "Enable read access for all users" on public.automations for select using (true);

drop policy if exists "Enable insert for authenticated users only" on public.automations;
create policy "Enable insert for authenticated users only" on public.automations for insert with check (auth.role() = 'authenticated');

drop policy if exists "Enable update for authenticated users only" on public.automations;
create policy "Enable update for authenticated users only" on public.automations for update using (auth.role() = 'authenticated');

drop policy if exists "Enable delete for authenticated users only" on public.automations;
create policy "Enable delete for authenticated users only" on public.automations for delete using (auth.role() = 'authenticated');

-- 9. Tabela de Base de Conhecimento da IA (Novo)
create table if not exists public.ai_knowledge_base (
    id uuid default gen_random_uuid() primary key,
    topic text unique not null,
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_knowledge_base enable row level security;

drop policy if exists "Conhecimento público" on public.ai_knowledge_base;
create policy "Conhecimento público" on public.ai_knowledge_base for select using (true);

drop policy if exists "Qualquer um pode inserir conhecimento" on public.ai_knowledge_base;
create policy "Qualquer um pode inserir conhecimento" on public.ai_knowledge_base for insert with check (true);

drop policy if exists "Qualquer um pode atualizar conhecimento" on public.ai_knowledge_base;
create policy "Qualquer um pode atualizar conhecimento" on public.ai_knowledge_base for update using (true);`}
            </pre>
          </div>
          <button
            onClick={() => {
              const codeElement = document.getElementById('sql-code-main');
              if (codeElement) {
                navigator.clipboard.writeText(codeElement.innerText);
                toast.success('SQL copiado para a área de transferência!');
              }
            }}
            className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors"
          >
            Copiar SQL
          </button>
          <button
            onClick={() => window.location.reload()}
            className="ml-4 bg-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-300 transition-colors"
          >
            Já executei, recarregar página
          </button>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <div className="bg-red-50 border border-red-200 rounded-3xl p-12 shadow-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Zap size={40} className="text-red-600 animate-pulse" />
          </div>
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Erro de Banco de Dados</h2>
          <p className="text-slate-600 mb-8 text-lg">
            Não conseguimos carregar as configurações. Isso acontece quando o banco de dados precisa ser atualizado para suportar novas funções (NFe, IA, Frete).
          </p>
          
          <div className="bg-slate-900 rounded-2xl p-6 text-left mb-8 shadow-inner">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Script de Reparo Necessário</span>
              <button 
                onClick={() => {
                  const code = document.getElementById('repair-sql-error')?.innerText;
                  if (code) {
                    navigator.clipboard.writeText(code);
                    toast.success('SQL copiado! Cole no Editor SQL do Supabase.');
                  }
                }}
                className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg text-xs font-bold hover:bg-emerald-500/20 transition-colors"
              >
                Copiar SQL
              </button>
            </div>
            <pre id="repair-sql-error" className="text-emerald-400 text-[10px] font-mono overflow-x-auto max-h-64 leading-relaxed">
{`-- COPIE E EXECUTE NO EDITOR SQL DO SUPABASE

-- 1. Garantir que a tabela existe
create table if not exists public.store_settings (
    id uuid default gen_random_uuid() primary key,
    company_name text,
    cnpj text,
    address text,
    cep text,
    phone text,
    whatsapp text,
    email text,
    instagram text,
    facebook text,
    business_hours text,
    business_hours_details text,
    payment_methods jsonb default '[]'::jsonb,
    institutional_links jsonb default '[]'::jsonb,
    affiliate_terms text,
    top_bar_text text,
    promotions_section_title text,
    promotions_section_subtitle text,
    products_section_title text,
    products_section_subtitle text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Adicionar colunas faltantes (NFe, IA, Frete, Social)
do $$
begin
    -- Social e Frete
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'social_links') then
        alter table public.store_settings add column social_links jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'shipping_methods') then
        alter table public.store_settings add column shipping_methods jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'free_shipping_threshold') then
        alter table public.store_settings add column free_shipping_threshold numeric(10,2) default 299.00;
    end if;

    -- IA e Automação
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_rules') then
        alter table public.store_settings add column ai_chat_rules text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_triggers') then
        alter table public.store_settings add column ai_chat_triggers text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_auto_learning') then
        alter table public.store_settings add column ai_auto_learning boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'n8n_webhook_url') then
        alter table public.store_settings add column n8n_webhook_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'origin_zip_code') then
        alter table public.store_settings add column origin_zip_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'debug_mode') then
        alter table public.store_settings add column debug_mode boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'tracking_pixels') then
        alter table public.store_settings add column tracking_pixels jsonb default '[]'::jsonb;
    end if;

    -- Nota Fiscal (NFe)
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_provider') then
        alter table public.store_settings add column nfe_provider text default 'manual';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_token') then
        alter table public.store_settings add column nfe_token text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_company_id') then
        alter table public.store_settings add column nfe_company_id text;
    end if;
end $$;

-- 3. Garantir uma linha de dados
insert into public.store_settings (company_name)
select 'Minha Loja'
where not exists (select 1 from public.store_settings);

-- 4. Segurança (RLS)
alter table public.store_settings enable row level security;
drop policy if exists "Public read settings" on public.store_settings;
create policy "Public read settings" on public.store_settings for select using (true);
drop policy if exists "Auth update settings" on public.store_settings;
create policy "Auth update settings" on public.store_settings for update using (auth.role() = 'authenticated');
drop policy if exists "Auth insert settings" on public.store_settings;
create policy "Auth insert settings" on public.store_settings for insert with check (auth.role() = 'authenticated');
`}
            </pre>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-10 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Já executei o SQL, recarregar
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
          {showSqlModal && (
            <button
              onClick={() => {
                setShowSql(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="bg-red-100 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-200 transition-colors text-sm flex items-center gap-2 animate-pulse"
            >
              <Zap size={18} />
              Reparar Banco de Dados
            </button>
          )}
          <button
            onClick={() => setShowSql(!showSql)}
            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl font-bold hover:bg-slate-200 transition-colors text-sm"
          >
            {showSql ? 'Ocultar SQL' : 'Ver SQL de Instalação'}
          </button>
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
      
      {showSql && (
        <div className="mb-8 bg-slate-900 rounded-xl p-4 overflow-hidden">
          <div className="flex justify-between items-center mb-2">
            <span className="text-slate-400 text-xs font-bold uppercase">SQL de Instalação / Correção</span>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(document.getElementById('sql-code')?.innerText || '');
                toast.success('Copiado!');
              }}
              className="text-emerald-400 text-xs hover:underline"
            >
              Copiar
            </button>
          </div>
          <pre id="sql-code" className="text-emerald-400 text-xs font-mono overflow-x-auto max-h-60">
{`-- Execute este SQL no Editor SQL do Supabase para corrigir os erros

-- 0. Adicionar colunas de Frete, Social e IA (Novo)
do $$
begin
    -- Colunas para store_settings
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'social_links') then
        alter table public.store_settings add column social_links jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'shipping_methods') then
        alter table public.store_settings add column shipping_methods jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'free_shipping_threshold') then
        alter table public.store_settings add column free_shipping_threshold numeric(10,2) default 299.00;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_rules') then
        alter table public.store_settings add column ai_chat_rules text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_triggers') then
        alter table public.store_settings add column ai_chat_triggers text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_auto_learning') then
        alter table public.store_settings add column ai_auto_learning boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'n8n_webhook_url') then
        alter table public.store_settings add column n8n_webhook_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'origin_zip_code') then
        alter table public.store_settings add column origin_zip_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'debug_mode') then
        alter table public.store_settings add column debug_mode boolean default false;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'tracking_pixels') then
        alter table public.store_settings add column tracking_pixels jsonb default '[]'::jsonb;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_provider') then
        alter table public.store_settings add column nfe_provider text default 'manual';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_token') then
        alter table public.store_settings add column nfe_token text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_company_id') then
        alter table public.store_settings add column nfe_company_id text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_title') then
        alter table public.store_settings add column promotions_section_title text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_subtitle') then
        alter table public.store_settings add column promotions_section_subtitle text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_title') then
        alter table public.store_settings add column products_section_title text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_subtitle') then
        alter table public.store_settings add column products_section_subtitle text;
    end if;
end $$;

-- 0.1 Adicionar colunas na tabela orders (Novo)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'tracking_code') then
        alter table public.orders add column tracking_code text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'shipping_label_url') then
        alter table public.orders add column shipping_label_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'shipping_method') then
        alter table public.orders add column shipping_method text;
    end if;
end $$;

-- 0.2 Criar tabela de carrinhos abandonados (Novo)
create table if not exists public.abandoned_carts (
  id uuid default gen_random_uuid() primary key,
  customer_email text,
  customer_name text,
  customer_phone text,
  cart_items jsonb default '[]'::jsonb,
  total numeric(10,2),
  status text default 'abandoned',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Habilitar RLS para abandoned_carts
alter table public.abandoned_carts enable row level security;
drop policy if exists "Enable read for authenticated users" on public.abandoned_carts;
create policy "Enable read for authenticated users" on public.abandoned_carts for select using (auth.role() = 'authenticated');
drop policy if exists "Enable insert/update for all" on public.abandoned_carts;
create policy "Enable insert/update for all" on public.abandoned_carts for insert with check (true);
drop policy if exists "Enable update for all" on public.abandoned_carts;
create policy "Enable update for all" on public.abandoned_carts for update using (true);

-- 1. Atualizar tabela de categorias (Novo)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'icon') then
        alter table public.categories add column icon text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'image_url') then
        alter table public.categories add column image_url text;
    end if;
end $$;

-- 2. Criar tabela de configurações da loja se não existir
create table if not exists public.store_settings (
  id uuid default gen_random_uuid() primary key,
  company_name text,
  cnpj text,
  address text,
  cep text,
  phone text,
  whatsapp text,
  email text,
  instagram text,
  facebook text,
  business_hours text,
  business_hours_details text,
  payment_methods jsonb default '[]'::jsonb,
  shipping_methods jsonb default '[]'::jsonb,
  institutional_links jsonb default '[]'::jsonb,
  affiliate_terms text,
  top_bar_text text,
  promotions_section_title text,
  promotions_section_subtitle text,
  products_section_title text,
  products_section_subtitle text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Adicionar colunas faltantes na tabela campaigns
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'text_color') then
        alter table public.campaigns add column text_color text default '#ffffff';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'background_color') then
        alter table public.campaigns add column background_color text default '#000000';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'badge_text') then
        alter table public.campaigns add column badge_text text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'campaigns' and column_name = 'button_text') then
        alter table public.campaigns add column button_text text;
    end if;
end $$;

-- 3. Adicionar colunas faltantes na tabela categories (ícone e imagem)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'icon') then
        alter table public.categories add column icon text;
    end if;
    
    if not exists (select 1 from information_schema.columns where table_name = 'categories' and column_name = 'image_url') then
        alter table public.categories add column image_url text;
    end if;
end $$;

-- 4. Adicionar colunas faltantes na tabela store_settings (se já existir)
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_title') then
        alter table public.store_settings add column promotions_section_title text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'promotions_section_subtitle') then
        alter table public.store_settings add column promotions_section_subtitle text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_title') then
        alter table public.store_settings add column products_section_title text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'products_section_subtitle') then
        alter table public.store_settings add column products_section_subtitle text;
    end if;
end $$;

-- 5. Habilitar RLS e Políticas para store_settings
alter table public.store_settings enable row level security;

drop policy if exists "Enable read access for all users" on public.store_settings;
create policy "Enable read access for all users" on public.store_settings for select using (true);

drop policy if exists "Enable insert for authenticated users only" on public.store_settings;
create policy "Enable insert for authenticated users only" on public.store_settings for insert with check (auth.role() = 'authenticated');

drop policy if exists "Enable update for authenticated users only" on public.store_settings;
create policy "Enable update for authenticated users only" on public.store_settings for update using (auth.role() = 'authenticated');

-- 6. Inserir configuração inicial se não existir
insert into public.store_settings (
    company_name, 
    promotions_section_title, 
    promotions_section_subtitle, 
    products_section_title,
    products_section_subtitle,
    payment_methods, 
    shipping_methods,
    institutional_links
)
select 
    'Minha Loja', 
    'CAMPANHAS E PROMOÇÕES', 
    'Aproveite nossas ofertas exclusivas', 
    'Novidades da Estação',
    'Confira as últimas tendências e ofertas exclusivas que preparamos para você.',
    '[]'::jsonb, 
    '[]'::jsonb,
    '[]'::jsonb
where not exists (select 1 from public.store_settings);

-- 7. Adicionar colunas para PIX de afiliados e Chat IA
do $$
begin
    -- Afiliados
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_name') then
        alter table public.affiliates add column pix_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_cpf') then
        alter table public.affiliates add column pix_cpf text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_bank') then
        alter table public.affiliates add column pix_bank text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_account') then
        alter table public.affiliates add column pix_account text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'pix_agency') then
        alter table public.affiliates add column pix_agency text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'total_paid') then
        alter table public.affiliates add column total_paid numeric(10,2) default 0;
    end if;

    -- Pagamentos de Afiliados
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_name') then
        alter table public.affiliate_payments add column pix_name text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_cpf') then
        alter table public.affiliate_payments add column pix_cpf text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_bank') then
        alter table public.affiliate_payments add column pix_bank text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_account') then
        alter table public.affiliate_payments add column pix_account text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'affiliate_payments' and column_name = 'pix_agency') then
        alter table public.affiliate_payments add column pix_agency text;
    end if;

    -- Configurações da Loja (IA)
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_rules') then
        alter table public.store_settings add column ai_chat_rules text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_chat_triggers') then
        alter table public.store_settings add column ai_chat_triggers text;
    end if;

    -- Configurações de NFe
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_provider') then
        alter table public.store_settings add column nfe_provider text default 'manual';
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_token') then
        alter table public.store_settings add column nfe_token text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'nfe_company_id') then
        alter table public.store_settings add column nfe_company_id text;
    end if;

    -- Webhooks de Automação
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'n8n_webhook_url') then
        alter table public.store_settings add column n8n_webhook_url text;
    end if;
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'chat_webhook_url') then
        alter table public.store_settings add column chat_webhook_url text;
    end if;
end $$;

-- 8. Tabela de Automações (n8n-like)
create table if not exists public.automations (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    trigger_type text not null,
    action_type text not null,
    config jsonb default '{}'::jsonb,
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.automations enable row level security;

drop policy if exists "Enable read access for all users" on public.automations;
create policy "Enable read access for all users" on public.automations for select using (true);

drop policy if exists "Enable insert for authenticated users only" on public.automations;
create policy "Enable insert for authenticated users only" on public.automations for insert with check (auth.role() = 'authenticated');

drop policy if exists "Enable update for authenticated users only" on public.automations;
create policy "Enable update for authenticated users only" on public.automations for update using (auth.role() = 'authenticated');

drop policy if exists "Enable delete for authenticated users only" on public.automations;
create policy "Enable delete for authenticated users only" on public.automations for delete using (auth.role() = 'authenticated');`}
          </pre>
        </div>
      )}

      <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
        {[
          { id: 'general', label: 'Geral', icon: SettingsIcon },
          { id: 'marketing', label: 'Marketing & Pixels', icon: Sparkles },
          { id: 'footer', label: 'Rodapé & Links', icon: LinkIcon },
          { id: 'institutional', label: 'Termos & Conteúdo', icon: FileText },
          { id: 'payments', label: 'Pagamentos', icon: CreditCard },
          { id: 'shipping', label: 'Frete', icon: Truck },
          { id: 'billing', label: 'Faturamento (NFe)', icon: FileText },
          { id: 'automation', label: 'Automação', icon: Zap },
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
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Automação & Webhooks</h2>
                  <p className="text-slate-500">Conecte sua loja ao n8n, Zapier ou Make.</p>
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
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Webhook de Chat (n8n)</label>
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
                    Se configurado, as mensagens do chat serão enviadas para este webhook com o campo <strong>{`{"mensagem": "..."}`}</strong>.
                  </p>
                </div>

                <div className="p-6 bg-slate-900 rounded-3xl text-white">
                  <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                    <Info size={16} className="text-emerald-400" />
                    Como responder via n8n?
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    Para enviar uma mensagem de volta ao chat do cliente, seu n8n deve fazer um POST para a API do Supabase na tabela <strong>leads_chat</strong>.
                  </p>
                  <div className="bg-slate-800 p-4 rounded-xl font-mono text-[10px] text-emerald-400 overflow-x-auto">
                    {`POST https://<sua-url>.supabase.co/rest/v1/leads_chat
Header: apikey: <sua-key>
Body: {
  "sender_id": null,
  "receiver_id": "{{ lead_id }}",
  "message": "Sua resposta aqui",
  "is_human": false
}`}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <h3 className="font-bold text-indigo-900 mb-2">Dica de Integração</h3>
                  <p className="text-sm text-indigo-700 leading-relaxed">
                    Ao receber um evento de <strong>carrinho_abandonado</strong>, você pode usar o n8n para enviar um WhatsApp automático para o cliente usando a API da Evolution ou WPPConnect.
                  </p>
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
          <>
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-6">
              <h2 className="text-xl font-bold text-slate-900 mb-4">Termos e Condições de Afiliados</h2>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Digite um prompt para gerar os termos com IA..."
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={() => generateAiText('affiliate_terms')}
                  disabled={generatingAi}
                  className="px-3 py-1 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-purple-700 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {generatingAi ? 'Gerando...' : 'Gerar IA'}
                </button>
              </div>
              <textarea
                value={settings.affiliate_terms || ''}
                onChange={(e) => handleChange('affiliate_terms', e.target.value)}
                rows={10}
                className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"
                placeholder="Cole ou gere aqui os termos e condições..."
              />
            </section>
          </>
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
