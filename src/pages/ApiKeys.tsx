import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Key, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { GoogleGenerativeAI } from "@google/generative-ai";

interface ApiKey {
  id: string;
  name: string;
  service: string;
  model?: string;
  key_value: string;
  active: boolean;
  status: 'online' | 'no_credit' | 'error' | 'active' | 'credit';
  priority: number;
  last_error_at?: string;
  created_at: string;
}

const MODELS_BY_SERVICE: Record<string, string[]> = {
  gemini: ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash-latest'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  groq: ['llama3-70b-8192', 'llama3-8b-8192', 'mixtral-8x7b-32768', 'gemma-7b-it'],
  claude: ['claude-3-5-sonnet-20240620', 'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  deepseek: ['deepseek-chat', 'deepseek-coder'],
  mistral: ['mistral-tiny', 'mistral-small', 'mistral-medium', 'mistral-large-latest'],
  together: ['mistralai/Mixtral-8x7B-Instruct-v0.1', 'meta-llama/Llama-3-70b-chat-hf', 'nousresearch/hermes-2-pro-llama-3-8b']
};

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState({
    name: '',
    service: 'gemini',
    model: 'gemini-1.5-flash',
    key_value: '',
    active: true,
    priority: 0
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async (key: any) => {
    if (!key.key_value) {
      toast.error('Valor da chave não encontrado.');
      return;
    }

    setIsTesting(true);
    const toastId = toast.loading('Testando conexão...');

    try {
      if (key.service === 'gemini') {
        const genAI = new GoogleGenerativeAI(key.key_value);
        const model = genAI.getGenerativeModel({ model: key.model || 'gemini-1.5-flash' });
        await model.generateContent('ping');
        toast.success('Conexão com Gemini bem-sucedida!', { id: toastId });
      } else if (key.service === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${key.key_value}`
          }
        });
        if (!response.ok) throw new Error('Chave OpenAI inválida ou sem crédito.');
        toast.success('Conexão com OpenAI bem-sucedida!', { id: toastId });
      } else {
        toast.error('Teste não disponível para este serviço ainda.', { id: toastId });
      }
    } catch (err: any) {
      toast.error('Falha na conexão: ' + err.message, { id: toastId });
    } finally {
      setIsTesting(false);
    }
  };

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar chaves:', error);
      toast.error('Erro ao carregar chaves de API');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setNewKey({ name: '', service: 'gemini', model: 'gemini-1.5-flash', key_value: '', active: true, priority: 0 });
    setEditingId(null);
    setIsAdding(true);
  };

  const handleEdit = (key: ApiKey) => {
    setNewKey({
      name: key.name,
      service: key.service,
      model: key.model || MODELS_BY_SERVICE[key.service][0],
      key_value: key.key_value,
      active: key.active,
      priority: key.priority || 0
    });
    setEditingId(key.id);
    setIsAdding(true);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const { error } = await supabase
          .from('api_keys')
          .update(newKey)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Chave atualizada com sucesso');
      } else {
        const { error } = await supabase
          .from('api_keys')
          .insert([newKey]);
        if (error) throw error;
        toast.success('Chave adicionada com sucesso');
      }
      
      setIsAdding(false);
      setEditingId(null);
      setNewKey({ name: '', service: 'gemini', model: 'gemini-1.5-flash', key_value: '', active: true, priority: 0 });
      fetchKeys();
    } catch (error: any) {
      toast.error(editingId ? 'Erro ao atualizar chave' : 'Erro ao adicionar chave');
    }
  };

  const toggleKeyStatus = async (id: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from('api_keys')
        .update({ active: !currentActive })
        .eq('id', id);

      if (error) throw error;
      fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta chave?')) return;
    try {
      const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Chave excluída');
      fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao excluir chave');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Key className="text-emerald-400" />
            Gerenciamento de APIs
          </h1>
          <p className="text-gray-400">Configure as chaves para o Agente de IA e Fallback</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nova API
        </button>
      </div>

      {isAdding && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingId ? 'Editar Chave de API' : 'Cadastrar Nova Chave'}
          </h2>
          <form onSubmit={handleSaveKey} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Nome Identificador</label>
              <input
                type="text"
                required
                value={newKey.name}
                onChange={e => setNewKey({ ...newKey, name: e.target.value })}
                placeholder="Ex: Gemini Principal"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Serviço</label>
              <select
                value={newKey.service}
                onChange={e => {
                  const service = e.target.value;
                  setNewKey({ 
                    ...newKey, 
                    service, 
                    model: MODELS_BY_SERVICE[service][0] 
                  });
                }}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="claude">Anthropic (Claude)</option>
                <option value="groq">Groq</option>
                <option value="deepseek">DeepSeek</option>
                <option value="mistral">Mistral AI</option>
                <option value="together">Together AI</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Modelo</label>
              <select
                value={newKey.model}
                onChange={e => setNewKey({ ...newKey, model: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                {MODELS_BY_SERVICE[newKey.service]?.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">Prioridade (Maior = Primeiro)</label>
              <input
                type="number"
                value={newKey.priority}
                onChange={e => setNewKey({ ...newKey, priority: parseInt(e.target.value) || 0 })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-400 mb-1">Chave de API (Secret Key)</label>
              <input
                type="password"
                required
                value={newKey.key_value}
                onChange={e => setNewKey({ ...newKey, key_value: e.target.value })}
                placeholder="Cole sua chave aqui"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>
            <div className="md:col-span-2 flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Salvar Chave
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-gray-800 h-48 rounded-xl animate-pulse" />
          ))
        ) : keys.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-gray-800 rounded-xl border border-dashed border-gray-700">
            <Key className="mx-auto text-gray-600 mb-4" size={48} />
            <p className="text-gray-400">Nenhuma chave configurada ainda.</p>
          </div>
        ) : (
          keys.map(key => (
            <div key={key.id} className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-emerald-500/50 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    key.service === 'gemini' ? 'bg-blue-500/10 text-blue-400' :
                    key.service === 'openai' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-orange-500/10 text-orange-400'
                  }`}>
                    <Key size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{key.name}</h3>
                      {localStorage.getItem('sticky_api_id') === key.id && key.status === 'online' && (
                        <span className="bg-emerald-500/20 text-emerald-400 text-[8px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter animate-pulse border border-emerald-500/30">Em Uso</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        !key.active ? 'bg-gray-600' :
                        key.status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                        key.status === 'no_credit' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' :
                        'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      }`} />
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{key.service}</span>
                      {key.model && (
                        <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded uppercase">{key.model}</span>
                      )}
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded">P:{key.priority || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => testConnection(key)}
                    disabled={isTesting}
                    className="p-1.5 text-amber-400 hover:bg-amber-400/10 rounded-md transition-colors disabled:opacity-50"
                    title="Testar Conexão"
                  >
                    <RefreshCw size={16} className={isTesting ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleEdit(key)}
                    className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                    title="Editar"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    onClick={() => toggleKeyStatus(key.id, key.active)}
                    className={`p-1.5 rounded-md transition-colors ${
                      key.active ? 'text-emerald-400 hover:bg-emerald-400/10' : 'text-gray-500 hover:bg-gray-500/10'
                    }`}
                    title={key.active ? 'Ativa' : 'Inativa'}
                  >
                    {key.active ? <CheckCircle size={18} /> : <XCircle size={18} />}
                  </button>
                  <button
                    onClick={() => deleteKey(key.id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Status:</span>
                  <span className={`flex items-center gap-1.5 font-medium ${
                    key.status === 'active' ? 'text-emerald-400' : 
                    key.status === 'credit' ? 'text-amber-400' : 
                    'text-red-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      key.status === 'active' ? 'bg-emerald-400 animate-pulse' : 
                      key.status === 'credit' ? 'bg-amber-400' : 
                      'bg-red-400'
                    }`} />
                    {key.status === 'active' ? '🟢 Funcionando' : 
                     key.status === 'credit' ? '🟡 Sem Crédito' : 
                     '🔴 Falha / Erro'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-400">Chave:</span>
                  <span className="text-gray-300 font-mono">••••••••{key.key_value.slice(-4)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                <span className="text-[10px] text-gray-500">
                  Adicionada em {new Date(key.created_at).toLocaleDateString()}
                </span>
                <button 
                  onClick={fetchKeys}
                  className="text-gray-500 hover:text-white transition-colors"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
