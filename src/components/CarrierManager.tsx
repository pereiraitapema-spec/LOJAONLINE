import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { Search, Truck, Trash2 } from 'lucide-react';

export const CarrierManager = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchOrders(); }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, shipments(*)')
      .order('created_at', { ascending: false });
    
    if (error) toast.error('Erro ao carregar pedidos');
    else setOrders(data || []);
  };

  const deleteOrder = async (orderId: string) => {
    if (!confirm('Tem certeza que deseja apagar este pedido de teste?')) return;
    
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (error) toast.error('Erro ao apagar');
    else { toast.success('Pedido apagado'); fetchOrders(); }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Truck className="text-emerald-600" /> Gestão de Transportadora
      </h2>
      <input 
        placeholder="Buscar pedido..."
        onChange={(e) => setSearch(e.target.value)}
        className="w-full p-2 border rounded mb-4"
      />
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="p-3 text-left">Pedido</th>
            <th className="p-3 text-left">Rastreio</th>
            <th className="p-3 text-left">Transportadora</th>
            <th className="p-3 text-center">Ações</th>
          </tr>
        </thead>
        <tbody>
          {orders.filter(o => o.id.toString().includes(search)).map(order => (
            <tr key={order.id} className="border-b">
              <td className="p-3 font-bold">#{order.id}</td>
              <td className="p-3">{order.shipments?.[0]?.tracking_number || 'N/A'}</td>
              <td className="p-3">{order.shipments?.[0]?.carrier_name || 'N/A'}</td>
              <td className="p-3 text-center">
                <button onClick={() => deleteOrder(order.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
