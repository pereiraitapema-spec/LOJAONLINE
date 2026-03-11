import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Send } from 'lucide-react';

export default function AdminChat() {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  useEffect(() => {
    fetchMessages();
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchMessages = async () => {
    const { data } = await supabase.from('chat_messages').select('*').order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const sendMessage = async () => {
    if (!input.trim() || !selectedUser) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('chat_messages').insert({
      sender_id: user.id,
      receiver_id: selectedUser,
      message: input
    });
    setInput('');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Chat do Administrador</h1>
      <div className="h-96 overflow-y-auto border p-4 mb-4">
        {messages.map(msg => (
          <div key={msg.id} className="mb-2">
            <strong>{msg.sender_id}:</strong> {msg.message}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)} 
          className="border p-2 flex-1" 
          placeholder="Digite a mensagem..."
        />
        <button onClick={sendMessage} className="bg-indigo-600 text-white p-2 rounded">
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
