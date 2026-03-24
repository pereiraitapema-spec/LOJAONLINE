import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Save, Bot, Users } from 'lucide-react';
import { Loading } from '../components/Loading';

export default function AiAgentSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    vendas: { rules: '', memory: '' },
    afiliados: { rules: '', memory: '' }
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const { data, error } = await supabase.from('ai_agent_settings').select('*');
      if (data) {
        const newSettings = { ...settings };
        data.forEach(s => {
          if (s.agent_type === 'vendas') newSettings.vendas = { rules: s.rules || '', memory: s.memory || '' };
          if (s.agent_type === 'afiliados') newSettings.afiliados = { rules: s.rules || '', memory: s.memory || '' };
        });
        setSettings(newSettings);
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async (type: 'vendas' | 'afiliados') => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_agent_settings')
        .upsert({
          agent_type: type,
          rules: settings[type].rules,
          memory: settings[type].memory
        }, { onConflict: 'agent_type' });
      if (error) throw error;
      toast.success(`Configurações do agente de ${type} salvas!`);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando configurações..." />;

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">Configurações dos Agentes IA</h1>
      
      {['vendas', 'afiliados'].map((type) => (
        <div key={type} className="bg-white p-6 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            {type === 'vendas' ? <Bot className="text-indigo-600" /> : <Users className="text-emerald-600" />}
            <h2 className="text-xl font-semibold capitalize">Agente de {type}</h2>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700">Regras</label>
            <textarea
              value={settings[type as 'vendas' | 'afiliados'].rules}
              onChange={(e) => setSettings(prev => ({ ...prev, [type]: { ...prev[type as 'vendas' | 'afiliados'], rules: e.target.value } }))}
              className="w-full h-32 p-3 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700">Memória</label>
            <textarea
              value={settings[type as 'vendas' | 'afiliados'].memory}
              onChange={(e) => setSettings(prev => ({ ...prev, [type]: { ...prev[type as 'vendas' | 'afiliados'], memory: e.target.value } }))}
              className="w-full h-32 p-3 border rounded-lg"
            />
          </div>
          
          <button
            onClick={() => handleSave(type as 'vendas' | 'afiliados')}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            <Save size={18} /> Salvar {type}
          </button>
        </div>
      ))}
    </div>
  );
}
