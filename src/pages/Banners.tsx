import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Upload,
  ArrowLeft,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface Banner {
  id: string;
  title: string;
  url: string;
  type: 'image' | 'video';
  duration: number;
  active: boolean;
  created_at: string;
}

export default function Banners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBanner, setNewBanner] = useState({
    title: '',
    duration: 5,
    type: 'image' as 'image' | 'video',
    file: null as File | null
  });

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
      if (!session) {
        navigate('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile?.role !== 'admin' && session.user.email !== 'pereira.itapema@gmail.com') {
        toast.error('Acesso negado.');
        navigate('/');
        return;
      }
      fetchBanners();
    };
    checkAdmin();
  }, []);

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar banners: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBanner.file) {
      toast.error('Selecione um arquivo primeiro.');
      return;
    }

    setUploading(true);
    try {
      const file = newBanner.file;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `carousel/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('banners')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('banners')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('banners')
        .insert([{
          title: newBanner.title || 'Sem título',
          url: publicUrl,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          duration: newBanner.duration,
          active: true
        }]);

      if (dbError) throw dbError;

      toast.success('Banner adicionado com sucesso!');
      setShowAddModal(false);
      setNewBanner({ title: '', duration: 5, type: 'image', file: null });
      fetchBanners();
    } catch (error: any) {
      toast.error('Erro ao salvar banner: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('banners')
        .update({ active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      setBanners(banners.map(b => b.id === id ? { ...b, active: !currentStatus } : b));
      toast.success('Status atualizado!');
    } catch (error: any) {
      toast.error('Erro ao atualizar status: ' + error.message);
    }
  };

  const deleteBanner = async (id: string, url: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Banner',
      message: 'Tem certeza que deseja excluir este banner? Ele será removido do carrossel imediatamente.',
      variant: 'danger',
      onConfirm: async () => {
        try {
          // Extrair o caminho do arquivo da URL pública
          const path = url.split('/storage/v1/object/public/banners/')[1];
          if (path) {
            await supabase.storage.from('banners').remove([path]);
          }

          const { error } = await supabase
            .from('banners')
            .delete()
            .eq('id', id);

          if (error) throw error;
          setBanners(banners.filter(b => b.id !== id));
          toast.success('Banner excluído!');
        } catch (error: any) {
          toast.error('Erro ao excluir: ' + error.message);
        }
      }
    });
  };

  if (loading) return <Loading message="Carregando banners..." />;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
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
              <ImageIcon className="text-indigo-600" />
              Gerenciador de Banners
            </h1>
            <p className="text-slate-500">Gerencie o carrossel de fotos e vídeos da sua loja.</p>
          </div>

          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <Plus size={20} />
            Novo Banner
          </button>
        </div>

        {/* Grid de Banners */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {banners.map((banner) => (
              <motion.div 
                key={banner.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden group"
              >
                <div className="aspect-video relative bg-slate-100">
                  {banner.type === 'video' ? (
                    <video 
                      src={banner.url} 
                      className="w-full h-full object-cover"
                      autoPlay 
                      muted 
                      loop 
                      playsInline
                    />
                  ) : (
                    <img 
                      src={banner.url} 
                      alt={banner.title} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => toggleStatus(banner.id, banner.active)}
                      className={`p-2 rounded-full shadow-lg transition-colors ${banner.active ? 'bg-green-500 text-white' : 'bg-slate-400 text-white'}`}
                      title={banner.active ? 'Ativo' : 'Inativo'}
                    >
                      {banner.active ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                    </button>
                    <button 
                      onClick={() => deleteBanner(banner.id, banner.url)}
                      className="p-2 bg-white text-red-600 rounded-full shadow-lg hover:bg-red-50 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                      <Clock size={12} />
                      {banner.duration}s
                    </div>
                    <div className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {banner.type}
                    </div>
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-bold text-slate-900 truncate">{banner.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Adicionado em {new Date(banner.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {banners.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <ImageIcon className="w-16 h-16 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Nenhum banner encontrado</h3>
            <p className="text-slate-500">Comece adicionando seu primeiro banner para o carrossel.</p>
          </div>
        )}
      </div>

      {/* Modal de Adicionar */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
              <h2 className="text-xl font-bold">Novo Banner</h2>
              <button onClick={() => setShowAddModal(false)} className="hover:rotate-90 transition-transform">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Título do Banner</label>
                <input 
                  type="text" 
                  value={newBanner.title}
                  onChange={e => setNewBanner({...newBanner, title: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Promoção de Verão"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Duração (segundos)</label>
                <div className="flex items-center gap-3">
                  <input 
                    type="range" 
                    min="3" 
                    max="30" 
                    value={newBanner.duration}
                    onChange={e => setNewBanner({...newBanner, duration: parseInt(e.target.value)})}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="font-bold text-indigo-600 w-8">{newBanner.duration}s</span>
                </div>
              </div>

              <div className="relative group">
                <label className="block text-sm font-bold text-slate-700 mb-1">Arquivo (Foto ou Vídeo)</label>
                <div className={`w-full h-32 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-2 transition-colors ${newBanner.file ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 group-hover:border-indigo-400'}`}>
                  {newBanner.file ? (
                    <>
                      <CheckCircle2 className="text-green-500" />
                      <span className="text-xs font-bold text-green-700 truncate max-w-[200px]">{newBanner.file.name}</span>
                      <button type="button" onClick={() => setNewBanner({...newBanner, file: null})} className="text-[10px] text-red-500 underline">Remover</button>
                    </>
                  ) : (
                    <>
                      <Upload className="text-slate-400" />
                      <span className="text-xs text-slate-500">Clique ou arraste o arquivo aqui</span>
                    </>
                  )}
                  <input 
                    type="file" 
                    accept="image/*,video/*"
                    onChange={e => setNewBanner({...newBanner, file: e.target.files?.[0] || null})}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={uploading || !newBanner.file}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Upload size={20} />
                    Fazer Upload e Salvar
                  </>
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}

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
