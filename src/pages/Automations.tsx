import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Zap, 
  Plus, 
  Trash2, 
  Settings, 
  Play, 
  Pause, 
  ArrowLeft,
  Mail,
  MessageSquare,
  Globe,
  Bell,
  Save,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';

interface Automation {
  id: string;
  name: string;
  trigger_type: string;
  action_type: string;
  config: any;
  active: boolean;
  created_at: string;
}

export default function Automations() {
  const navigate = useNavigate();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [tableError, setTableError] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    trigger_type: 'new_lead',
    action_type: 'chat_notification',
    config: {
      message: '',
      webhook_url: '',
      email_subject: '',
      delay_minutes: 0
    }
  });

  useEffect(() => {
    fetchAutomations();
  }, []);

  const fetchAutomations = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') { // table does not exist
          setTableError(true);
        } else {
          throw error;
        }
      } else {
        setAutomations(data || []);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar automações: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        trigger_type: form.trigger_type,
        action_type: form.action_type,
        config: form.config,
        active: true
      };

      if (editingAutomation) {
        const { error } = await supabase
          .from('automations')
          .update(payload)
          .eq('id', editingAutomation.id);
        if (error) throw error;
        toast.success('Automação atualizada!');
      } else {
        const { error } = await supabase
          .from('automations')
          .insert([payload]);
        if (error) throw error;
        toast.success('Automação criada!');
      }

      setShowModal(false);
      resetForm();
      fetchAutomations();
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('automations')
        .update({ active: !currentStatus })
        .eq('id', id);
      if (error) throw error;
      setAutomations(automations.map(a => a.id === id ? { ...a, active: !currentStatus } : a));
      toast.success(`Automação ${!currentStatus ? 'ativada' : 'pausada'}`);
    } catch (error: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta automação?')) return;
    try {
      const { error } = await supabase.from('automations').delete().eq('id', id);
      if (error) throw error;
      setAutomations(automations.filter(a => a.id !== id));
      toast.success('Automação excluída');
    } catch (error: any) {
      toast.error('Erro ao excluir');
    }
  };

  const resetForm = () => {
    setEditingAutomation(null);
    setForm({
      name: '',
      trigger_type: 'new_lead',
      action_type: 'chat_notification',
      config: {
        message: '',
        webhook_url: '',
        email_subject: '',
        delay_minutes: 0
      }
    });
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'new_lead': return 'Novo Lead';
      case 'abandoned_cart': return 'Carrinho Abandonado';
      case 'new_order': return 'Novo Pedido';
      case 'order_paid': return 'Pedido Pago';
      case 'order_shipped': return 'Pedido Enviado';
      case 'status_change': return 'Mudança de Status';
      default: return type;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return <MessageSquare size={18} className="text-emerald-500" />;
      case 'email': return <Mail size={18} className="text-blue-500" />;
      case 'webhook': return <Globe size={18} className="text-indigo-500" />;
      case 'chat_notification': return <Bell size={18} className="text-amber-500" />;
      default: return <Zap size={18} />;
    }
  };

  if (loading) return <Loading message="Carregando fluxos..." />;

  if (tableError) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-6 transition-colors cursor-pointer" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft size={18} />
            Voltar ao Painel
          </div>
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-rose-700 mb-4">Banco de Dados Incompleto</h2>
            <p className="text-rose-600 mb-6">
              A tabela de automações não foi encontrada. Por favor, vá até a página de <strong>Configurações</strong> e execute o <strong>SQL de Instalação</strong> no Supabase.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Ir para Configurações
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <button 
              onClick={() => navigate('/admin/dashboard')}
              className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-2 transition-colors"
            >
              <ArrowLeft size={18} />
              Voltar ao Painel
            </button>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <Zap className="text-indigo-600 fill-indigo-600" />
              Automações (n8n-like)
            </h1>
            <p className="text-slate-500 mt-1">Crie réguas de marketing e gatilhos de venda automáticos.</p>
          </div>

          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Plus size={20} />
            Novo Fluxo
          </button>
        </div>

        {/* Grid de Automações */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {automations.map((auto) => (
            <motion.div 
              key={auto.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white p-6 rounded-3xl border-2 transition-all ${auto.active ? 'border-indigo-100 shadow-sm' : 'border-slate-100 opacity-75'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-2xl ${auto.active ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                  {getActionIcon(auto.action_type)}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => toggleActive(auto.id, auto.active)}
                    className={`p-2 rounded-xl transition-colors ${auto.active ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                    title={auto.active ? 'Pausar' : 'Ativar'}
                  >
                    {auto.active ? <Pause size={18} /> : <Play size={18} />}
                  </button>
                  <button 
                    onClick={() => { setEditingAutomation(auto); setForm({ ...auto }); setShowModal(true); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  >
                    <Settings size={18} />
                  </button>
                  <button 
                    onClick={() => deleteAutomation(auto.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-lg mb-1">{auto.name}</h3>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                <Zap size={12} />
                Gatilho: {getTriggerLabel(auto.trigger_type)}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-xs text-slate-500 italic line-clamp-2">
                  {auto.config.message || auto.config.webhook_url || 'Sem configuração de mensagem'}
                </p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <span className={`text-[10px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${auto.active ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                  {auto.active ? 'Ativo' : 'Pausado'}
                </span>
                <span className="text-[10px] text-slate-400">
                  Criado em {new Date(auto.created_at).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}

          {automations.length === 0 && (
            <div className="col-span-full bg-white p-12 rounded-3xl border-2 border-dashed border-slate-200 text-center">
              <Zap size={48} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-900">Nenhuma automação criada</h3>
              <p className="text-slate-500">Comece criando seu primeiro fluxo de marketing automático.</p>
            </div>
          )}
        </div>

        {/* Modal de Criação/Edição */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white shrink-0">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Zap size={24} />
                  {editingAutomation ? 'Editar Automação' : 'Novo Fluxo de Automação'}
                </h2>
                <button onClick={() => setShowModal(false)} className="hover:rotate-90 transition-transform">
                  <X size={24} />
                </button>
              </div>

              <div className="overflow-y-auto p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="col-span-full">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Nome da Automação</label>
                    <input 
                      type="text" 
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      placeholder="Ex: Recuperação de Carrinho 1"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Gatilho (Trigger)</label>
                    <select 
                      value={form.trigger_type}
                      onChange={e => setForm({ ...form, trigger_type: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="new_lead">Novo Lead Cadastrado</option>
                      <option value="abandoned_cart">Carrinho Abandonado</option>
                      <option value="new_order">Novo Pedido Criado</option>
                      <option value="order_paid">Pedido Pago (Sucesso)</option>
                      <option value="order_shipped">Pedido Enviado (Rastreio)</option>
                      <option value="status_change">Mudança de Status de Lead</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Ação (Action)</label>
                    <select 
                      value={form.action_type}
                      onChange={e => setForm({ ...form, action_type: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="chat_notification">Notificação no Chat IA</option>
                      <option value="whatsapp">Enviar WhatsApp (Evolution)</option>
                      <option value="email">Enviar E-mail</option>
                      <option value="webhook">Enviar Webhook (n8n)</option>
                    </select>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Settings size={16} className="text-indigo-600" />
                    Configuração da Ação
                  </h4>

                  {form.action_type === 'chat_notification' || form.action_type === 'whatsapp' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Mensagem Personalizada</label>
                      <textarea 
                        value={form.config.message}
                        onChange={e => setForm({ ...form, config: { ...form.config, message: e.target.value } })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                        placeholder="Use {{nome}} para o nome do cliente..."
                      />
                    </div>
                  ) : form.action_type === 'webhook' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">URL do Webhook</label>
                      <input 
                        type="url" 
                        value={form.config.webhook_url}
                        onChange={e => setForm({ ...form, config: { ...form.config, webhook_url: e.target.value } })}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="https://n8n.seudominio.com/webhook/..."
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Assunto do E-mail</label>
                        <input 
                          type="text" 
                          value={form.config.email_subject}
                          onChange={e => setForm({ ...form, config: { ...form.config, email_subject: e.target.value } })}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Corpo do E-mail</label>
                        <textarea 
                          value={form.config.message}
                          onChange={e => setForm({ ...form, config: { ...form.config, message: e.target.value } })}
                          className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Atraso (Delay em Minutos)</label>
                    <input 
                      type="number" 
                      value={form.config.delay_minutes}
                      onChange={e => setForm({ ...form, config: { ...form.config, delay_minutes: parseInt(e.target.value) } })}
                      className="w-32 px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={20} />}
                    {editingAutomation ? 'Salvar Alterações' : 'Criar Automação'}
                  </button>
                </div>
              </form>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
