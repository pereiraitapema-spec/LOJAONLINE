import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, ShoppingBag, 
  Megaphone, Plus, Edit2, Trash2, Save, X, Upload
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

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

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCampaign, setCurrentCampaign] = useState<Partial<Campaign>>({});
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCampaigns();
  }, []);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (currentCampaign.id) {
        const { error } = await supabase
          .from('campaigns')
          .update({
            title: currentCampaign.title,
            subtitle: currentCampaign.subtitle,
            image_url: currentCampaign.image_url,
            rules_text: currentCampaign.rules_text,
            link_url: currentCampaign.link_url,
            is_highlight: currentCampaign.is_highlight ?? false,
            active: currentCampaign.active,
            display_order: currentCampaign.display_order,
          })
          .eq('id', currentCampaign.id);
        if (error) throw error;
        toast.success('Campanha atualizada!');
      } else {
        const { error } = await supabase
          .from('campaigns')
          .insert([{
            title: currentCampaign.title,
            subtitle: currentCampaign.subtitle,
            image_url: currentCampaign.image_url,
            rules_text: currentCampaign.rules_text,
            link_url: currentCampaign.link_url,
            is_highlight: currentCampaign.is_highlight ?? false,
            active: currentCampaign.active ?? true,
            display_order: currentCampaign.display_order ?? 0,
          }]);
        if (error) throw error;
        toast.success('Campanha criada!');
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
    if (!window.confirm('Tem certeza que deseja excluir esta campanha?')) return;
    
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
                  
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Link de Direcionamento (Opcional)</label>
                    <input
                      type="text"
                      value={currentCampaign.link_url || ''}
                      onChange={e => setCurrentCampaign({...currentCampaign, link_url: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                      placeholder="Ex: /produtos ou link externo"
                    />
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
                  className={`bg-white rounded-2xl shadow-sm border ${campaign.active ? 'border-slate-200' : 'border-rose-200 opacity-75'} overflow-hidden flex flex-col`}
                >
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-4">
                      {campaign.image_url ? (
                        <img src={campaign.image_url} alt={campaign.title} className="w-12 h-12 object-cover rounded-lg" />
                      ) : (
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                          <Megaphone size={24} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const link = `${window.location.origin}/?campaign=${campaign.id}`;
                            navigator.clipboard.writeText(link);
                            toast.success('Link de afiliado copiado!');
                          }}
                          title="Copiar Link de Afiliado"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        </button>
                        <button
                          onClick={() => {
                            setCurrentCampaign(campaign);
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
                    
                    <h3 className="text-lg font-bold text-slate-900 mb-1">
                      {campaign.is_highlight && <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded mr-2 align-middle">DESTAQUE</span>}
                      {campaign.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-4">{campaign.subtitle}</p>
                    
                    <div className="bg-slate-50 p-3 rounded-lg">
                      <p className="text-xs text-slate-500 font-medium mb-1">Regras:</p>
                      <p className="text-sm text-slate-700 line-clamp-2">{campaign.rules_text}</p>
                    </div>
                  </div>
                  
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${campaign.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {campaign.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Ordem: {campaign.display_order}
                    </span>
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
    </div>
  );
}
