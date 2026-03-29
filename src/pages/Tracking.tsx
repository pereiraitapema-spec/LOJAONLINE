import React, { useState } from 'react';
import { Search, Truck, Package, CheckCircle2, Clock, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function Tracking() {
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTrack = async () => {
    if (!trackingCode) return;
    setLoading(true);
    try {
      // Busca o pedido e seu histórico
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, status, tracking_code, tracking_history(*)')
        .or(`tracking_code.eq.${trackingCode},id.eq.${trackingCode}`)
        .maybeSingle();

      if (error) throw error;
      if (!order) {
        toast.error('Pedido ou código de rastreio não encontrado.');
        setTrackingData(null);
      } else {
        setTrackingData(order);
      }
    } catch (error: any) {
      toast.error('Erro ao buscar rastreio: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-black text-slate-900 mb-6">Acompanhe seu Pedido</h1>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8">
          <div className="flex gap-2">
            <input 
              type="text"
              placeholder="Digite o número do pedido ou rastreio..."
              value={trackingCode}
              onChange={e => setTrackingCode(e.target.value)}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button 
              onClick={handleTrack}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center gap-2"
            >
              {loading ? 'Buscando...' : <Search size={20} />}
              Buscar
            </button>
          </div>
        </div>

        {trackingData && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pedido</p>
                <p className="font-mono font-bold text-slate-900">{trackingData.id.split('-')[0].toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                <p className="font-bold text-indigo-600">{trackingData.status}</p>
              </div>
            </div>

            <div className="space-y-6">
              <h3 className="font-bold text-slate-900">Histórico de Movimentação</h3>
              {trackingData.tracking_history && trackingData.tracking_history.length > 0 ? (
                <div className="relative pl-8 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {trackingData.tracking_history.map((h: any, idx: number) => (
                    <div key={h.id} className="relative">
                      <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${idx === 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                        <Truck size={12} className="text-white" />
                      </div>
                      <p className="text-sm font-bold text-slate-900">{h.status}</p>
                      <p className="text-xs text-slate-500">{h.location} | {new Date(h.date).toLocaleString('pt-BR')}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-50 rounded-2xl text-slate-500 italic">
                  O produto está sendo embalado e logo será enviado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
