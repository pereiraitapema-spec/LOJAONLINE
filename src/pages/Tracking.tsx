import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Truck, Package, CheckCircle2, Clock, ArrowLeft, MapPin, Calendar, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { shippingService } from '../services/shippingService';

export default function Tracking() {
  const navigate = useNavigate();
  const [trackingCode, setTrackingCode] = useState('');
  const [trackingData, setTrackingData] = useState<any>(null);
  const [realTimeHistory, setRealTimeHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [carrierConfig, setCarrierConfig] = useState<any>(null);

  useEffect(() => {
    const fetchCarrierConfig = async () => {
      const { data, error } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .single();
      
      if (!error && data) {
        setCarrierConfig(data.config);
      }
    };
    fetchCarrierConfig();
  }, []);

  const handleTrack = async () => {
    if (!trackingCode) return;
    setLoading(true);
    setRealTimeHistory([]);
    try {
      // Busca o pedido e seu histórico local
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, status, tracking_code, tracking_history(*)')
        .or(`tracking_code.eq.${trackingCode},id.eq.${trackingCode}`)
        .maybeSingle();

      if (error) throw error;
      if (!order) {
        toast.error('Pedido ou código de rastreio não encontrado.');
        setTrackingData(null);
        return;
      }

      setTrackingData(order);

      // Se houver código de rastreio, busca na API do CepCerto
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
    } catch (error: any) {
      toast.error('Erro ao buscar rastreio: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <button 
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors mb-6 font-bold"
        >
          <Home size={20} />
          Voltar para o site
        </button>

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
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <MapPin size={18} className="text-indigo-600" />
                Histórico de Movimentação
              </h3>
              
              {/* Prioriza o histórico em tempo real da API */}
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
              ) : trackingData.tracking_history && trackingData.tracking_history.length > 0 ? (
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
                <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <Package size={40} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm text-slate-500 font-medium">
                    {trackingData.tracking_code 
                      ? 'Seu pedido está sendo levado para a transportadora.' 
                      : 'Seu pedido está sendo preparado.'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {trackingData.tracking_code 
                      ? 'O código de rastreio já foi gerado e aguarda coleta.' 
                      : 'Assim que for postado, você verá as atualizações aqui.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
