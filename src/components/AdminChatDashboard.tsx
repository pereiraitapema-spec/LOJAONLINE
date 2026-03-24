import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Mail, Phone, User, Bot, Send, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function AdminChatDashboard() {
  const [activeTab, setActiveTab] = useState<'chat' | 'whatsapp' | 'email'>('chat');
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    fetchSessions();
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => {
        if (selectedSession) fetchMessages(selectedSession.user_id);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedSession]);

  const fetchSessions = async () => {
    const { data } = await supabase.from('chat_sessions').select('*, user:user_id(email)');
    setSessions(data || []);
  };

  const fetchMessages = async (userId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const toggleMode = async (sessionId: string, currentMode: string) => {
    const newMode = currentMode === 'ai' ? 'human' : 'ai';
    await supabase.from('chat_sessions').update({ mode: newMode }).eq('id', sessionId);
    fetchSessions();
    toast.success(`Modo alterado para: ${newMode.toUpperCase()}`);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedSession) return;
    await supabase.from('chat_messages').insert({
      sender_id: (await supabase.auth.getSession()).data.session?.user?.id,
      receiver_id: selectedSession.user_id,
      message: input
    });
    setInput('');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <div className="w-1/4 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200 flex gap-2">
          {(['chat', 'whatsapp', 'email'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`p-2 rounded-lg ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'text-slate-500'}`}>
              {tab === 'chat' && <MessageSquare size={20} />}
              {tab === 'whatsapp' && <Phone size={20} />}
              {tab === 'email' && <Mail size={20} />}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.map(s => (
            <div key={s.id} onClick={() => { setSelectedSession(s); fetchMessages(s.user_id); }} className={`p-4 border-b cursor-pointer hover:bg-slate-50 ${selectedSession?.id === s.id ? 'bg-emerald-50' : ''}`}>
              <p className="font-bold text-sm">{s.user?.email}</p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${s.mode === 'ai' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>{s.mode.toUpperCase()}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        {selectedSession ? (
          <>
            <div className="p-4 bg-white border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-bold">{selectedSession.user?.email}</h2>
              <button onClick={() => toggleMode(selectedSession.id, selectedSession.mode)} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm">
                Atender: {selectedSession.mode === 'ai' ? 'Humano' : 'IA'}
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`p-3 rounded-lg max-w-[70%] ${m.sender_id === selectedSession.user_id ? 'bg-white' : 'bg-emerald-100 ml-auto'}`}>
                  <p className="text-sm">{m.message}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)} className="flex-1 p-2 border rounded-lg" placeholder="Digite..." />
              <button onClick={sendMessage} className="p-2 bg-emerald-600 text-white rounded-lg"><Send size={20} /></button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-400">Selecione uma conversa</div>
        )}
      </div>
    </div>
  );
}
