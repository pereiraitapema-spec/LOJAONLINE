import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Truck, Package, CheckCircle2, Clock, ArrowLeft, MapPin, Calendar, Home, List } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { shippingService } from '../services/shippingService';

export default function Tracking() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [realTimeHistory, setRealTimeHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase.from('orders').select('id, status, tracking_code, tracking_history(*), created_at');
      
      // Se não for admin, filtra pelo usuário
      // Nota: Assumindo que temos uma forma de verificar admin. 
      // Por enquanto, vamos buscar todos se não houver filtro, ou filtrar pelo usuário.
      if (user) {
        query = query.eq('user_id', user.id);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        toast.error('Erro ao buscar pedidos.');
      } else {
        setOrders(data || []);
      }
      setLoading(false);
    };
    fetchOrders();
  }, []);

  const handleSelectOrder = async (order: any) => {
    setSelectedOrder(order);
    setRealTimeHistory([]);
    
    if (order.tracking_code) {
      try {
        const realTime = await shippingService.getTrackingStatus(order.tracking_code);
        if (realTime && realTime.history && realTime.history.length > 0) {
          setRealTimeHistory(realTime.history);
        }
      } catch (apiError) {
        console.warn('Erro ao buscar rastreio na API:', apiError);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors mb-6 font-bold"
        >
          <Home size={20} />
          Voltar para a Loja
        </button>

        <h1 className="text-2xl font-black text-slate-900 mb-6">Acompanhar Pedidos</h1>
        
        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-fit">
            <h2 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <List size={20} /> Seus Pedidos
            </h2>
            {loading ? (
              <p>Carregando...</p>
            ) : (
              <div className="space-y-2">
                {orders.map(order => (
                  <button
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`w-full text-left p-3 rounded-xl border ${selectedOrder?.id === order.id ? 'bg-indigo-50 border-indigo-200' : 'hover:bg-slate-50 border-transparent'}`}
                  >
                    <p className="font-mono text-sm font-bold">#{order.id.split('-')[0].toUpperCase()}</p>
                    <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleDateString('pt-BR')}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            {selectedOrder ? (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                <div className="flex justify-between items-center border-b border-slate-100 pb-6">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pedido</p>
                    <p className="font-mono font-bold text-slate-900">{selectedOrder.id.split('-')[0].toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                    <p className="font-bold text-indigo-600">{selectedOrder.status}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <MapPin size={18} className="text-indigo-600" />
                    Localização e Trajeto
                  </h3>
                  
                  {realTimeHistory.length > 0 ? (
                    <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                      {realTimeHistory.map((h: any, idx: number) => (
                        <div key={idx} className="relative">
                          <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                            <div className={`w-2 h-2 rounded-full bg-white ${idx === 0 ? 'animate-pulse' : ''}`} />
                          </div>
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <p className="text-sm font-bold text-slate-900">{h.description}</p>
                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} /> {h.location}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <Clock size={10} /> {h.date}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                      <Package size={40} className="mx-auto text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500 font-medium">
                        {selectedOrder.tracking_code 
                          ? 'Enviado para transportadora.' 
                          : 'Preparando seu pedido.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center text-slate-500">
                Selecione um pedido na lista ao lado para ver o rastreio.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
