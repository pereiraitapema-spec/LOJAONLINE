import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Key, Plus, Trash2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  service: string;
  key_value: string;
  active: boolean;
  status: string;
  created_at: string;
}

export default function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newKey, setNewKey] = useState({
    name: '',
    service: 'gemini',
    key_value: '',
    active: true
  });

  useEffect(() => {
    fetchKeys();
  }, []);

  const fetchKeys = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('api_keys')
        .select('*')
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

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('api_keys')
        .insert([newKey]);

      if (error) throw error;
      
      toast.success('Chave adicionada com sucesso');
      setIsAdding(false);
      setNewKey({ name: '', service: 'gemini', key_value: '', active: true });
      fetchKeys();
    } catch (error: any) {
      toast.error('Erro ao adicionar chave');
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
          onClick={() => setIsAdding(!isAdding)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={20} />
          Nova API
        </button>
      </div>

      {isAdding && (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
          <h2 className="text-lg font-semibold text-white mb-4">Cadastrar Nova Chave</h2>
          <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                onChange={e => setNewKey({ ...newKey, service: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="claude">Anthropic (Claude)</option>
              </select>
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
                    <h3 className="font-semibold text-white">{key.name}</h3>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">{key.service}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
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
                  <span className="text-gray-400">Status Realtime:</span>
                  <span className={`flex items-center gap-1.5 font-medium ${
                    key.status === 'online' ? 'text-emerald-400' : 'text-red-400'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      key.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
                    }`} />
                    {key.status === 'online' ? 'Online' : 'Offline / Erro'}
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
