import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit, 
  Edit2,
  Trash2, 
  Tag, 
  FolderPlus, 
  Image as ImageIcon,
  ArrowLeft,
  X,
  Save,
  Upload,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { GoogleGenAI } from "@google/genai";

interface Category {
  id: string;
  name: string;
  icon?: string;
}

interface ProductTier {
  id?: string;
  product_id?: string;
  quantity: number;
  discount_percentage: number;
}

interface ProductMedia {
  id?: string;
  product_id?: string;
  url: string;
  type: 'image' | 'video';
  position: number;
}

interface Product {
  id: string;
  name: string;
  description: string;
  composition: string;
  price: number;
  cost_price: number | null;
  discount_price: number | null;
  affiliate_commission: number;
  image_url: string;
  category_id: string | null;
  stock: number;
  active: boolean;
  category?: Category;
  tiers?: ProductTier[];
  media?: ProductMedia[];
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modais
  const [showProductModal, setShowProductModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  
  // Form de Produto
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    composition: '',
    price: '',
    cost_price: '',
    discount_price: '',
    affiliate_commission: '0',
    category_id: '',
    stock: '0',
    image_url: '',
    active: true
  });

  const [productTiers, setProductTiers] = useState<ProductTier[]>([]);
  const [productMedia, setProductMedia] = useState<ProductMedia[]>([]);
  
  // AI Generation
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  
  // Form de Categoria
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showAPIModal, setShowAPIModal] = useState(false);
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({ id: '', name: '', service: 'gemini', key_value: '', active: true });
  const [isEditingKey, setIsEditingKey] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    fetchAPIKeys();
  }, []);

  const fetchAPIKeys = async () => {
    try {
      const { data, error } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setApiKeys(data || []);
    } catch (err) {
      console.error('Erro ao carregar chaves:', err);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products')
          .select('*, category:categories(*), tiers:product_tiers(*), media:product_media(*)')
          .order('created_at', { ascending: false })
          .order('position', { foreignTable: 'product_media', ascending: true }),
        supabase.from('categories').select('*').order('name')
      ]);

      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;

      setProducts(prodRes.data || []);
      setCategories(catRes.data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validação
    const newErrors: Record<string, boolean> = {};
    if (!productForm.name.trim()) newErrors.name = true;
    if (!productForm.price || isNaN(parseFloat(productForm.price))) newErrors.price = true;
    if (!productForm.image_url.trim()) newErrors.image_url = true;
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor, preencha os campos obrigatórios destacados em vermelho.');
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const payload = {
        name: productForm.name,
        description: productForm.description,
        composition: productForm.composition,
        price: parseFloat(productForm.price),
        cost_price: productForm.cost_price ? parseFloat(productForm.cost_price) : null,
        discount_price: productForm.discount_price ? parseFloat(productForm.discount_price) : null,
        affiliate_commission: parseFloat(productForm.affiliate_commission),
        category_id: productForm.category_id || null,
        stock: parseInt(productForm.stock),
        image_url: productForm.image_url,
        active: productForm.active
      };

      let productId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('products').insert([payload]).select();
        if (error) throw error;
        if (!data || data.length === 0) throw new Error('Erro ao obter ID do produto criado.');
        productId = data[0].id;
      }

      // Salvar Tiers (Venda Escalonada)
      if (productId) {
        // Primeiro remove os antigos
        await Promise.all([
          supabase.from('product_tiers').delete().eq('product_id', productId),
          supabase.from('product_media').delete().eq('product_id', productId)
        ]);
        
        // Depois insere os novos tiers
        if (productTiers.length > 0) {
          const tiersToInsert = productTiers.map(t => ({
            product_id: productId,
            quantity: t.quantity,
            discount_percentage: t.discount_percentage
          }));
          const { error: tierError } = await supabase.from('product_tiers').insert(tiersToInsert);
          if (tierError) throw tierError;
        }

        // Depois insere a mídia
        if (productMedia.length > 0) {
          const mediaToInsert = productMedia.map((m, idx) => ({
            product_id: productId,
            url: m.url,
            type: m.type,
            position: idx
          }));
          const { error: mediaError } = await supabase.from('product_media').insert(mediaToInsert);
          if (mediaError) throw mediaError;
        }
      }

      toast.success(editingProduct ? 'Produto atualizado!' : 'Produto criado!');
      setShowProductModal(false);
      resetProductForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar produto: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const generateAIDescription = async () => {
    if (!productForm.composition && !productForm.image_url) {
      toast.error('Adicione uma foto ou composição para a IA analisar.');
      return;
    }

    setIsGeneratingAI(true);
    try {
      // Tentar buscar chave do Supabase primeiro
      const { data: dbKeys, error: dbError } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('service', 'gemini')
        .eq('active', true)
        .limit(1);

      let apiKey = dbKeys?.[0]?.key_value || process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey === '') {
        toast.error('Chave da API Gemini não encontrada. Configure no menu de APIs ou nos Secrets.');
        setIsGeneratingAI(false);
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const parts: any[] = [
        { text: `Você é um redator publicitário sênior especializado em e-commerce de alta performance. 
        Sua tarefa é criar uma descrição de produto PROFISSIONAL, OBJETIVA e DIRETA para o produto "${productForm.name}".
        
        REGRAS ABSOLUTAS:
        1. SEM ENROLAÇÃO: Vá direto ao ponto. O cliente já está na página do produto.
        2. FOCO EM BENEFÍCIOS: Explique para que serve e quais as vantagens reais.
        3. ESTRUTURA:
           - Título curto e impactante.
           - Parágrafo único explicando o que é o produto (máximo 2 frases).
           - Lista de 3 a 5 benefícios principais em bullet points (curtos).
           - Uma frase final de fechamento/chamada para ação.
        4. TOM: Profissional, autoritário e confiável.
        5. TAMANHO: Máximo de 150 palavras.
        
        Contexto Técnico (Composição/Detalhes):
        ${productForm.composition || 'Não informada'}
        
        Gere apenas o texto final da descrição, sem introduções, sem "Aqui está sua descrição" ou comentários.` }
      ];

      // Se tiver imagem principal, enviar para análise
      if (productForm.image_url) {
        try {
          const response = await fetch(productForm.image_url);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve) => {
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
          });
          const base64Data = await base64Promise;
          
          parts.push({
            inlineData: {
              data: base64Data,
              mimeType: blob.type
            }
          });
        } catch (imgErr) {
          console.warn('Erro ao processar imagem para IA:', imgErr);
        }
      }

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: { parts }
      });

      const text = result.text;
      if (text) {
        setProductForm(prev => ({ ...prev, description: text.trim() }));
        toast.success('Descrição gerada com sucesso!');
      }
    } catch (error: any) {
      console.error('Erro IA:', error);
      toast.error('Erro ao gerar descrição: ' + error.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    setSaving(true);
    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({ name: newCategoryName, icon: newCategoryIcon })
          .eq('id', editingCategory.id);
        if (error) throw error;
        toast.success('Categoria atualizada!');
      } else {
        const { error } = await supabase.from('categories').insert([{ name: newCategoryName, icon: newCategoryIcon }]);
        if (error) throw error;
        toast.success('Categoria criada!');
      }
      
      setNewCategoryName('');
      setNewCategoryIcon('');
      setEditingCategory(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao salvar categoria: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Excluir categoria? Produtos vinculados serão movidos para "Geral".')) return;
    
    setSaving(true);
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
      toast.success('Categoria removida');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir categoria: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Excluir este produto permanentemente?')) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      setProducts(products.filter(p => p.id !== id));
      toast.success('Produto removido');
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `products/${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(fileName);

      setProductForm(prev => ({ ...prev, image_url: publicUrl }));
      
      // Adicionar também à galeria se for a primeira imagem
      if (productMedia.length === 0) {
        setProductMedia([{ url: publicUrl, type: 'image', position: 0 }]);
      }
      
      toast.success('Imagem principal carregada!');
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSaving(true);
    try {
      const newMedia = [...productMedia];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `products/${Math.random()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('banners')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('banners')
          .getPublicUrl(fileName);

        newMedia.push({
          url: publicUrl,
          type: type,
          position: newMedia.length
        });
      }

      setProductMedia(newMedia);
      toast.success(`${type === 'image' ? 'Imagens' : 'Vídeo'} carregado(s)!`);
    } catch (error: any) {
      toast.error('Erro no upload: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const resetProductForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: '',
      description: '',
      composition: '',
      price: '',
      cost_price: '',
      discount_price: '',
      affiliate_commission: '0',
      category_id: '',
      stock: '0',
      image_url: '',
      active: true
    });
    setErrors({});
    setProductTiers([]);
    setProductMedia([]);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: product.description || '',
      composition: product.composition || '',
      price: product.price.toString(),
      cost_price: product.cost_price?.toString() || '',
      discount_price: product.discount_price?.toString() || '',
      affiliate_commission: (product.affiliate_commission || 0).toString(),
      category_id: product.category_id || '',
      stock: product.stock.toString(),
      image_url: product.image_url || '',
      active: product.active
    });
    setProductTiers(product.tiers || []);
    setProductMedia(product.media || []);
    setShowProductModal(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <Loading message="Carregando estoque..." />;

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
              <Package className="text-indigo-600" />
              Gestão de Produtos
            </h1>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => setShowAPIModal(true)}
              className="flex items-center gap-2 bg-slate-800 text-white px-5 py-3 rounded-2xl font-bold hover:bg-slate-900 transition-all shadow-lg"
            >
              <Sparkles size={20} className="text-indigo-400" />
              Configurar APIs
            </button>
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-2 bg-white text-slate-700 px-5 py-3 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all"
            >
              <Tag size={20} />
              Categorias
            </button>
            <button 
              onClick={() => { resetProductForm(); setShowProductModal(true); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={20} />
              Novo Produto
            </button>
          </div>
        </div>

        {/* Filtros e Busca */}
        <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por nome do produto..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-widest ${viewMode === 'grid' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Package size={16} />
              Cards
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-widest ${viewMode === 'list' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Search size={16} />
              Detalhes
            </button>
          </div>
        </div>

        {/* Lista de Produtos */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <motion.div 
                key={product.id}
                layout
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group"
              >
                <div className="aspect-square relative bg-slate-100">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <ImageIcon size={48} />
                    </div>
                  )}
                  
                  <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => openEditModal(product)}
                      className="p-2 bg-white text-indigo-600 rounded-full shadow-lg hover:bg-indigo-50"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => deleteProduct(product.id)}
                      className="p-2 bg-white text-red-600 rounded-full shadow-lg hover:bg-red-50"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  {!product.active && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-slate-800 text-white px-4 py-1 rounded-full text-xs font-bold uppercase">Inativo</span>
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">
                      {product.category?.name || 'Geral'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {product.stock} em estoque
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 truncate">{product.name}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    {product.discount_price ? (
                      <>
                        <span className="text-lg font-black text-indigo-600">R$ {product.discount_price.toFixed(2)}</span>
                        <span className="text-sm text-slate-400 line-through">R$ {product.price.toFixed(2)}</span>
                      </>
                    ) : (
                      <span className="text-lg font-black text-slate-900">R$ {product.price.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estoque</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          {product.image_url ? (
                            <img src={product.image_url} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                              <ImageIcon size={16} />
                            </div>
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500">{product.category?.name || 'Geral'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-black text-indigo-600">R$ {product.price.toFixed(2)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-bold ${product.stock <= 5 ? 'text-rose-500' : 'text-slate-500'}`}>
                        {product.stock} un
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${product.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {product.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => openEditModal(product)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => deleteProduct(product.id)}
                          className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Seção de Chaves de API Prominente */}
        <div className="mt-12 bg-slate-900 rounded-[40px] p-8 md:p-12 text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] -mr-32 -mt-32"></div>
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
              <div>
                <h2 className="text-3xl font-black uppercase italic tracking-tighter mb-2">Sistema de Chaves API</h2>
                <p className="text-slate-400 font-medium max-w-xl">
                  Gerencie suas credenciais do Google Gemini e OpenAI para automatizar descrições e inteligência da loja.
                </p>
              </div>
              <button 
                onClick={() => setShowAPIModal(true)}
                className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-black uppercase italic tracking-tighter hover:bg-indigo-50 transition-all shadow-xl flex items-center gap-3"
              >
                <Plus size={24} />
                Nova Chave API
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {apiKeys.map(key => (
                <div key={key.id} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-3xl hover:bg-white/10 transition-all group">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-3 h-3 rounded-full ${key.active ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-600'}`}></div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setApiKeyForm({ id: key.id, name: key.name, service: key.service, key_value: key.key_value, active: key.active });
                          setIsEditingKey(true);
                          setShowAPIModal(true);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-indigo-400"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (!confirm('Excluir esta chave?')) return;
                          try {
                            const { error } = await supabase.from('api_keys').delete().eq('id', key.id);
                            if (error) throw error;
                            toast.success('Chave removida');
                            fetchAPIKeys();
                          } catch (err: any) {
                            toast.error('Erro ao remover: ' + err.message);
                          }
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg text-rose-400"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  <h4 className="font-bold text-lg mb-1">{key.name}</h4>
                  <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-4">{key.service}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Status</span>
                    <button 
                      onClick={async () => {
                        try {
                          const { error } = await supabase.from('api_keys').update({ active: !key.active }).eq('id', key.id);
                          if (error) throw error;
                          fetchAPIKeys();
                        } catch (err: any) {
                          toast.error('Erro ao alternar status: ' + err.message);
                        }
                      }}
                      className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest transition-all ${key.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}
                    >
                      {key.active ? 'Ativa' : 'Inativa'}
                    </button>
                  </div>
                </div>
              ))}
              {apiKeys.length === 0 && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-3xl">
                  <Sparkles size={48} className="mx-auto mb-4 text-white/10" />
                  <p className="text-slate-500 font-bold">Nenhuma chave configurada ainda.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Package className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhum produto encontrado</h3>
            <p className="text-slate-500">Tente mudar os termos da busca ou adicione um novo produto.</p>
          </div>
        )}
      </div>

      {/* Modal de Produto */}
      <AnimatePresence>
        {showProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl my-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white rounded-t-3xl sticky top-0 z-10">
                <h2 className="text-xl font-bold">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h2>
                <button onClick={() => setShowProductModal(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <div className="max-h-[80vh] overflow-y-auto">
                <form onSubmit={handleProductSubmit} className="p-8 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Lado Esquerdo: Info Básica */}
                    <div className="space-y-6">
                      <div>
                        <label className={`block text-sm font-bold mb-1 ${errors.name ? 'text-red-500' : 'text-slate-700'}`}>
                          Nome do Produto *
                        </label>
                        <input 
                          type="text" 
                          value={productForm.name}
                          onChange={e => {
                            setProductForm({...productForm, name: e.target.value});
                            if (errors.name) setErrors(prev => ({ ...prev, name: false }));
                          }}
                          className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${errors.name ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                          placeholder="Ex: Tênis Esportivo Pro"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                        <select 
                          value={productForm.category_id}
                          onChange={e => setProductForm({...productForm, category_id: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                          <option value="">Geral (Sem Categoria)</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Preço Custo (R$)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={productForm.cost_price}
                            onChange={e => setProductForm({...productForm, cost_price: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className={`block text-sm font-bold mb-1 ${errors.price ? 'text-red-500' : 'text-slate-700'}`}>
                            Preço Venda *
                          </label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={productForm.price}
                            onChange={e => {
                              setProductForm({...productForm, price: e.target.value});
                              if (errors.price) setErrors(prev => ({ ...prev, price: false }));
                            }}
                            className={`w-full px-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${errors.price ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Promoção (R$)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={productForm.discount_price}
                            onChange={e => setProductForm({...productForm, discount_price: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="Opcional"
                          />
                        </div>
                      </div>

                    <div className="p-4 bg-indigo-50 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-indigo-700 uppercase tracking-widest">Venda Escalonada (Tiers)</h4>
                        <button 
                          type="button"
                          onClick={() => setProductTiers([...productTiers, { quantity: 1, discount_percentage: 0 }])}
                          className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-md font-bold hover:bg-indigo-700 transition-colors"
                        >
                          + Adicionar Tier
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        {productTiers.map((tier, idx) => (
                          <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-indigo-100">
                            <div className="flex-1">
                              <label className="block text-[9px] text-slate-400 uppercase font-bold">Qtd Mínima</label>
                              <input 
                                type="number" 
                                value={tier.quantity}
                                onChange={e => {
                                  const newTiers = [...productTiers];
                                  newTiers[idx].quantity = parseInt(e.target.value);
                                  setProductTiers(newTiers);
                                }}
                                className="w-full text-sm font-bold outline-none"
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-[9px] text-slate-400 uppercase font-bold">% Desconto</label>
                              <input 
                                type="number" 
                                value={tier.discount_percentage}
                                onChange={e => {
                                  const newTiers = [...productTiers];
                                  newTiers[idx].discount_percentage = parseFloat(e.target.value);
                                  setProductTiers(newTiers);
                                }}
                                className="w-full text-sm font-bold outline-none"
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={() => setProductTiers(productTiers.filter((_, i) => i !== idx))}
                              className="p-2 text-red-400 hover:text-red-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        {productTiers.length === 0 && (
                          <p className="text-[10px] text-slate-400 text-center py-2 italic">Nenhum desconto progressivo configurado.</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Comissão Afiliado (R$ ou %)</label>
                      <input 
                        type="number" 
                        step="0.01"
                        value={productForm.affiliate_commission}
                        onChange={e => setProductForm({...productForm, affiliate_commission: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Estoque Inicial</label>
                      <input 
                        type="number" 
                        value={productForm.stock}
                        onChange={e => setProductForm({...productForm, stock: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Lado Direito: Foto, Composição e Descrição */}
                  <div className="space-y-4">
                    <div className="relative group">
                      <label className={`block text-sm font-bold mb-1 ${errors.image_url ? 'text-red-500' : 'text-slate-700'}`}>
                        Foto Principal *
                      </label>
                      <div className={`aspect-square w-full border-2 border-dashed rounded-2xl overflow-hidden relative flex flex-col items-center justify-center bg-slate-50 transition-all ${errors.image_url ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}>
                        {productForm.image_url ? (
                          <img src={productForm.image_url} className="w-full h-full object-contain p-4" referrerPolicy="no-referrer" />
                        ) : (
                          <>
                            <Upload className={`${errors.image_url ? 'text-red-300' : 'text-slate-300'} mb-2`} size={32} />
                            <span className={`text-xs ${errors.image_url ? 'text-red-400 font-bold' : 'text-slate-400'}`}>Clique para enviar</span>
                          </>
                        )}
                        <input 
                          type="file" 
                          accept="image/*"
                          onChange={e => {
                            handleImageUpload(e);
                            if (errors.image_url) setErrors(prev => ({ ...prev, image_url: false }));
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    </div>

                    {/* Galeria de Fotos e Vídeos */}
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Galeria (Fotos e Vídeos)</h4>
                        <div className="flex gap-2">
                          <label className="cursor-pointer text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-md font-bold hover:bg-indigo-700 transition-colors">
                            + Fotos
                            <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => handleMediaUpload(e, 'image')} />
                          </label>
                          <label className="cursor-pointer text-[10px] bg-slate-800 text-white px-2 py-1 rounded-md font-bold hover:bg-slate-900 transition-colors">
                            + Vídeo
                            <input type="file" accept="video/*" className="hidden" onChange={(e) => handleMediaUpload(e, 'video')} />
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {productMedia.map((media, idx) => (
                          <div key={idx} className="aspect-square relative rounded-lg overflow-hidden bg-white border border-slate-200 group/media">
                            {media.type === 'video' ? (
                              <video src={media.url + "#t=0.1"} className="w-full h-full object-contain" muted playsInline />
                            ) : (
                              <img src={media.url} className="w-full h-full object-contain p-1" referrerPolicy="no-referrer" />
                            )}
                            <button 
                              type="button"
                              onClick={() => setProductMedia(productMedia.filter((_, i) => i !== idx))}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center py-0.5">
                              {media.type === 'video' ? 'VÍDEO' : `FOTO ${idx + 1}`}
                            </div>
                          </div>
                        ))}
                        {productMedia.length === 0 && (
                          <div className="col-span-4 py-4 text-center text-[10px] text-slate-400 italic">
                            Nenhuma mídia adicional.
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Composição (Uso Interno/IA)</label>
                      <textarea 
                        rows={3}
                        value={productForm.composition}
                        onChange={e => setProductForm({...productForm, composition: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        placeholder="Materiais, fornecedor, detalhes técnicos..."
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-bold text-slate-700">Descrição (Loja)</label>
                        <button 
                          type="button"
                          onClick={generateAIDescription}
                          disabled={isGeneratingAI}
                          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                        >
                          {isGeneratingAI ? (
                            <div className="w-3 h-3 border-2 border-indigo-700 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Sparkles size={12} />
                          )}
                          Gerar com IA
                        </button>
                      </div>
                      <textarea 
                        rows={6}
                        value={productForm.description}
                        onChange={e => setProductForm({...productForm, description: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                        placeholder="Detalhes que o cliente verá..."
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        id="active"
                        checked={productForm.active}
                        onChange={e => setProductForm({...productForm, active: e.target.checked})}
                        className="w-5 h-5 accent-indigo-600"
                      />
                      <label htmlFor="active" className="text-sm font-bold text-slate-700">Produto Ativo na Loja</label>
                    </div>
                  </div>
                </div>

                  <div className="flex gap-4 pt-4 sticky bottom-0 bg-white pb-4">
                    <button 
                      type="button"
                      onClick={() => setShowProductModal(false)}
                      className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      disabled={saving}
                      className="flex-[2] bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <Save size={20} />
                          {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Configuração de APIs */}
      <AnimatePresence>
        {showAPIModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
                <h2 className="text-xl font-bold">Configurar Chaves de API</h2>
                <button onClick={() => setShowAPIModal(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Chave (Identificação)</label>
                    <input 
                      type="text" 
                      value={apiKeyForm.name}
                      onChange={e => setApiKeyForm({...apiKeyForm, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Ex: Gemini Principal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Serviço</label>
                    <select 
                      value={apiKeyForm.service}
                      onChange={e => setApiKeyForm({...apiKeyForm, service: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="gemini">Google Gemini</option>
                      <option value="openai">OpenAI (ChatGPT)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Valor da Chave</label>
                    <input 
                      type="password" 
                      value={apiKeyForm.key_value}
                      onChange={e => setApiKeyForm({...apiKeyForm, key_value: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="Cole sua chave aqui..."
                    />
                  </div>
                  <button 
                    onClick={async () => {
                      if (!apiKeyForm.name || !apiKeyForm.key_value) {
                        toast.error('Preencha todos os campos da chave.');
                        return;
                      }
                      setSaving(true);
                      try {
                        const payload = {
                          name: apiKeyForm.name,
                          service: apiKeyForm.service,
                          key_value: apiKeyForm.key_value,
                          active: apiKeyForm.active
                        };

                        if (isEditingKey && apiKeyForm.id) {
                          const { error } = await supabase.from('api_keys').update(payload).eq('id', apiKeyForm.id);
                          if (error) throw error;
                          toast.success('Chave atualizada!');
                        } else {
                          const { error } = await supabase.from('api_keys').insert([payload]);
                          if (error) throw error;
                          toast.success('Chave de API salva com sucesso!');
                        }
                        
                        setApiKeyForm({ id: '', name: '', service: 'gemini', key_value: '', active: true });
                        setIsEditingKey(false);
                        fetchAPIKeys();
                      } catch (err: any) {
                        toast.error('Erro ao salvar chave: ' + err.message);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    disabled={saving}
                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
                  >
                    {isEditingKey ? 'Atualizar Chave' : 'Salvar Chave'}
                  </button>
                  {isEditingKey && (
                    <button 
                      onClick={() => {
                        setIsEditingKey(false);
                        setApiKeyForm({ id: '', name: '', service: 'gemini', key_value: '', active: true });
                      }}
                      className="w-full bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-700 mb-3">Chaves Salvas</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {apiKeys.map(key => (
                      <div key={key.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={async () => {
                              try {
                                const { error } = await supabase.from('api_keys').update({ active: !key.active }).eq('id', key.id);
                                if (error) throw error;
                                fetchAPIKeys();
                              } catch (err: any) {
                                toast.error('Erro ao alternar status: ' + err.message);
                              }
                            }}
                            className={`w-4 h-4 rounded-full border-2 transition-colors ${key.active ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'}`}
                            title={key.active ? 'Ativa' : 'Inativa'}
                          />
                          <div>
                            <p className="text-xs font-bold text-slate-700">{key.name}</p>
                            <p className="text-[10px] text-slate-400 uppercase">{key.service}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => {
                              setApiKeyForm({
                                id: key.id,
                                name: key.name,
                                service: key.service,
                                key_value: key.key_value,
                                active: key.active
                              });
                              setIsEditingKey(true);
                            }}
                            className="text-indigo-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={async () => {
                              if (!confirm('Excluir esta chave?')) return;
                              try {
                                const { error } = await supabase.from('api_keys').delete().eq('id', key.id);
                                if (error) throw error;
                                toast.success('Chave removida');
                                fetchAPIKeys();
                              } catch (err: any) {
                                toast.error('Erro ao remover: ' + err.message);
                              }
                            }}
                            className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {apiKeys.length === 0 && (
                      <p className="text-center text-[10px] text-slate-400 py-2 italic">Nenhuma chave cadastrada.</p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 italic">
                    As chaves salvas aqui serão usadas para funções de IA como geração de descrições.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de Categorias */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-800 text-white">
                <h2 className="text-xl font-bold">Gerenciar Categorias</h2>
                <button 
                  onClick={() => {
                    setShowCategoryModal(false);
                    setEditingCategory(null);
                    setNewCategoryName('');
                    setNewCategoryIcon('');
                  }} 
                  className="hover:rotate-90 transition-transform"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <form onSubmit={handleCategorySubmit} className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input 
                      required
                      type="text" 
                      value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={editingCategory ? "Editar nome..." : "Nova categoria..."}
                    />
                    <button 
                      type="submit"
                      disabled={saving}
                      className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center"
                    >
                      {editingCategory ? <Save size={24} /> : <Plus size={24} />}
                    </button>
                    {editingCategory && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingCategory(null);
                          setNewCategoryName('');
                          setNewCategoryIcon('');
                        }}
                        className="bg-slate-200 text-slate-600 p-3 rounded-xl hover:bg-slate-300"
                      >
                        <X size={24} />
                      </button>
                    )}
                  </div>
                  <input 
                    type="text" 
                    value={newCategoryIcon}
                    onChange={e => setNewCategoryIcon(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    placeholder="Nome do ícone Lucide (ex: Heart, Star, Zap)..."
                  />
                  <p className="text-xs text-slate-500">Use nomes de ícones da biblioteca Lucide React.</p>
                </form>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group">
                      <div className="flex items-center gap-3">
                        {cat.icon && <span className="text-indigo-500 text-sm bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">{cat.icon}</span>}
                        <span className="font-medium text-slate-700">{cat.name}</span>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => {
                            setEditingCategory(cat);
                            setNewCategoryName(cat.name);
                            setNewCategoryIcon(cat.icon || '');
                          }}
                          className="text-indigo-400 hover:text-indigo-600"
                        >
                          <Edit size={18} />
                        </button>
                        <button 
                          onClick={() => deleteCategory(cat.id)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {categories.length === 0 && (
                    <p className="text-center text-slate-400 py-4 italic">Nenhuma categoria cadastrada.</p>
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
