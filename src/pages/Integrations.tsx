import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  LogOut, Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Plus, Edit2, Trash2, Save, X, Link as LinkIcon, 
  Zap, Database, MessageSquare, RefreshCw
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Integration {
  id: string;
  name: string;
  type: 'erp' | 'crm' | 'marketplace' | 'automation' | 'whatsapp' | 'other';
  status: 'connected' | 'disconnected' | 'error';
  config: any;
  last_sync?: string;
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentIntegration, setCurrentIntegration] = useState<Partial<Integration>>({});
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.email !== 'pereira.itapema@gmail.com') {
        toast.error('Acesso negado.');
        navigate('/');
        return;
      }
      fetchIntegrations();
    };
    checkAdmin();
  }, [navigate]);

  const fetchIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setIntegrations(data || []);
    } catch (error: any) {
      console.error('Error fetching integrations:', error);
      // Estado inicial com as integrações solicitadas
      setIntegrations([
        { id: 'bling', name: 'Bling ERP', type: 'erp', status: 'disconnected', config: {} },
        { id: 'bitrix24', name: 'Bitrix24 CRM', type: 'crm', status: 'disconnected', config: {} },
        { id: 'tray', name: 'Tray E-commerce', type: 'marketplace', status: 'disconnected', config: {} },
        { id: 'n8n', name: 'n8n / Automação', type: 'automation', status: 'disconnected', config: {} },
        { id: 'evolution', name: 'Evolution API (WhatsApp)', type: 'whatsapp', status: 'disconnected', config: {} }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('integrations')
        .upsert({
          ...currentIntegration,
          status: currentIntegration.config?.api_key ? 'connected' : 'disconnected'
        });
      
      if (error) throw error;
      toast.success('Integração salva com sucesso!');
      setIsEditing(false);
      fetchIntegrations();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
  };

  if (loading) return <Loading message="Carregando integrações..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => navigate('/banners')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ImageIcon size={20} /> Banners
          </button>
          <button onClick={() => navigate('/campaigns')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Megaphone size={20} /> Campanhas
          </button>
          <button onClick={() => navigate('/products')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Package size={20} /> Produtos
          </button>
          <button onClick={() => navigate('/orders')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ShoppingBag size={20} /> Pedidos
          </button>
          <button onClick={() => navigate('/affiliates')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Users size={20} /> Afiliados
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium transition-colors">
            <Zap size={20} /> Integrações
          </button>
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Ecossistema de Integrações</h1>
              <p className="text-slate-500">Conecte sua loja com as melhores ferramentas do mercado.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {integrations.map(integration => (
              <div key={integration.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 relative overflow-hidden group">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 rounded-2xl ${
                    integration.type === 'erp' ? 'bg-blue-50 text-blue-600' :
                    integration.type === 'crm' ? 'bg-purple-50 text-purple-600' :
                    integration.type === 'automation' ? 'bg-indigo-50 text-indigo-600' :
                    integration.type === 'whatsapp' ? 'bg-emerald-50 text-emerald-600' :
                    'bg-orange-50 text-orange-600'
                  }`}>
                    {integration.type === 'erp' ? <Database size={24} /> :
                     integration.type === 'crm' ? <MessageSquare size={24} /> :
                     integration.type === 'automation' ? <Zap size={24} /> :
                     integration.type === 'whatsapp' ? <MessageSquare size={24} /> :
                     <ShoppingBag size={24} />}
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                    integration.status === 'connected' ? 'bg-emerald-100 text-emerald-700' :
                    integration.status === 'error' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      integration.status === 'connected' ? 'bg-emerald-500' :
                      integration.status === 'error' ? 'bg-red-500' :
                      'bg-slate-400'
                    }`} />
                    {integration.status === 'connected' ? 'Conectado' : 
                     integration.status === 'error' ? 'Erro' : 'Desconectado'}
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-900 mb-1">{integration.name}</h3>
                <p className="text-xs text-slate-500 mb-6 uppercase tracking-wider font-bold">
                  {integration.type === 'erp' ? 'Gestão ERP & Estoque' :
                   integration.type === 'crm' ? 'CRM & Vendas' :
                   integration.type === 'automation' ? 'Automação de Fluxos' :
                   integration.type === 'whatsapp' ? 'WhatsApp & Chatbot' :
                   'Marketplace & Loja'}
                </p>
                
                {integration.last_sync && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-4">
                    <RefreshCw size={12} />
                    Sincronizado em: {new Date(integration.last_sync).toLocaleString()}
                  </div>
                )}

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setCurrentIntegration(integration);
                      setIsEditing(true);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    <Settings size={16} /> Configurar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Modal de Edição */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Configurar {currentIntegration.name}</h2>
              <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-white rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">API Key / Token de Acesso</label>
                <input 
                  type="password"
                  value={currentIntegration.config?.api_key || ''}
                  onChange={e => setCurrentIntegration({
                    ...currentIntegration, 
                    config: { ...currentIntegration.config, api_key: e.target.value }
                  })}
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                  placeholder="Insira sua credencial de integração"
                />
              </div>

              {currentIntegration.id === 'bling' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">ID do Depósito (Opcional)</label>
                  <input 
                    type="text"
                    value={currentIntegration.config?.warehouse_id || ''}
                    onChange={e => setCurrentIntegration({
                      ...currentIntegration, 
                      config: { ...currentIntegration.config, warehouse_id: e.target.value }
                    })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Ex: 123456789"
                  />
                </div>
              )}

              {currentIntegration.id === 'n8n' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Webhook URL</label>
                  <input 
                    type="text"
                    value={currentIntegration.config?.webhook_url || ''}
                    onChange={e => setCurrentIntegration({
                      ...currentIntegration, 
                      config: { ...currentIntegration.config, webhook_url: e.target.value }
                    })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="https://n8n.seu-dominio.com/webhook/..."
                  />
                </div>
              )}

              {currentIntegration.id === 'evolution' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Evolution API URL</label>
                  <input 
                    type="text"
                    value={currentIntegration.config?.api_url || ''}
                    onChange={e => setCurrentIntegration({
                      ...currentIntegration, 
                      config: { ...currentIntegration.config, api_url: e.target.value }
                    })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all mb-4"
                    placeholder="https://evolution.seu-dominio.com"
                  />
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Instance Name</label>
                  <input 
                    type="text"
                    value={currentIntegration.config?.instance_name || ''}
                    onChange={e => setCurrentIntegration({
                      ...currentIntegration, 
                      config: { ...currentIntegration.config, instance_name: e.target.value }
                    })}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 transition-all"
                    placeholder="Ex: GFitLife"
                  />
                </div>
              )}

              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <p className="text-xs text-indigo-700 leading-relaxed">
                  <strong>Dica:</strong> Para obter as credenciais, acesse o painel do <strong>{currentIntegration.name}</strong>, vá em Configurações {'>'} Integrações {'>'} API.
                </p>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleSave}
                  className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  Conectar Integração
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
