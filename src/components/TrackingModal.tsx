import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { X, Truck, Package, MapPin, Clock, Search, ChevronRight, ArrowLeft, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { shippingService } from '../services/shippingService';
import { toast } from 'react-hot-toast';

interface TrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trackingCode?: string;
  orderId?: string;
}

export function TrackingModal({ isOpen, onClose, trackingCode, orderId }: TrackingModalProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [realTimeHistory, setRealTimeHistory] = useState<any[]>([]);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

  useEffect(() => {
    if (isOpen) {
      if (trackingCode || orderId) {
        fetchTracking(trackingCode, orderId);
        setViewMode('detail');
      } else {
        fetchUserOrders();
        setViewMode('list');
      }
    } else {
      setTrackingData(null);
      setRealTimeHistory([]);
      setUserOrders([]);
    }
  }, [isOpen, trackingCode, orderId]);

  const fetchUserOrders = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, tracking_code, created_at, total')
        .eq('customer_email', user.email)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filtrar pedidos entregues há mais de 7 dias
      const filteredOrders = (orders || []).filter(order => {
        if (order.status !== 'delivered') return true;
        
        const createdAt = new Date(order.created_at);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        return createdAt > sevenDaysAgo;
      });

      setUserOrders(filteredOrders);
    } catch (error: any) {
      console.error('Erro ao buscar pedidos do usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTracking = async (searchCode?: string, searchId?: string) => {
    setLoading(true);
    setRealTimeHistory([]);
    try {
      const query = supabase
        .from('orders')
        .select('id, status, tracking_code, created_at, total, tracking_history(*), order_items(product_name, price)');
      
      const codeToUse = searchCode || trackingCode;
      const idToUse = searchId || orderId;

      if (codeToUse) {
        query.eq('tracking_code', codeToUse);
      } else if (idToUse) {
        query.eq('id', idToUse);
      } else {
        setLoading(false);
        return;
      }

      const { data: orders, error } = await query;

      if (error) throw error;
      const order = orders && orders.length > 0 ? orders[0] : null;

      if (!order) {
        // Se não encontrou o pedido no banco, tenta buscar o rastreio direto (flexibilidade)
        if (codeToUse) {
           const realTime = await shippingService.getTrackingStatus(codeToUse);
           if (realTime && realTime.history && realTime.history.length > 0) {
              setTrackingData({ 
                id: codeToUse, 
                tracking_code: codeToUse, 
                status: realTime.status, 
                created_at: new Date().toISOString(),
                shipping_method: 'Rastreio Externo'
              });
              setRealTimeHistory(realTime.history);
              setViewMode('detail');
              return;
           }
        }
        toast.error('Pedido ou código de rastreio não encontrado.');
        if (viewMode === 'detail' && !trackingCode && !orderId) {
          setViewMode('list');
        }
        return;
      }

      setTrackingData(order);
      setViewMode('detail');

      // Se houver código de rastreio, busca na API real através do shippingService
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-emerald-600 bg-emerald-50';
      case 'shipped': return 'text-blue-600 bg-blue-50';
      case 'delivered': return 'text-indigo-600 bg-indigo-50';
      case 'cancelled': return 'text-red-600 bg-red-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Aguardando Pagamento';
      case 'paid': return 'Pagamento Confirmado';
      case 'processing': return 'Em Preparação';
      case 'shipped': return 'Enviado';
      case 'delivered': return 'Entregue';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden relative"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
              <div className="flex items-center gap-3">
                {viewMode === 'detail' && (userOrders.length > 0 || !trackingCode) ? (
                  <button 
                    onClick={() => setViewMode('list')}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                ) : (
                  <button 
                    onClick={() => {
                      onClose();
                      navigate('/');
                    }}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors flex items-center gap-2"
                    title="Voltar para o site"
                  >
                    <Home size={20} />
                  </button>
                )}
                <h2 className="text-xl font-black italic uppercase tracking-tighter">
                  {viewMode === 'list' ? 'Meus Pedidos' : 'Rastreio do Pedido'}
                </h2>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 max-h-[70vh] overflow-y-auto scrollbar-hide">
              {viewMode === 'list' ? (
                <div className="space-y-4">
                  {/* Barra de Busca Manual */}
                  <div className="mb-6 relative">
                    <input 
                      type="text" 
                      placeholder="Digite o código de rastreio ou ID..."
                      className="w-full bg-slate-100 text-slate-700 px-6 py-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-bold placeholder:text-slate-400 pr-12"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value;
                          if (val) {
                            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
                            if (isUuid) {
                              fetchTracking(undefined, val);
                            } else {
                              fetchTracking(val);
                            }
                          }
                        }
                      }}
                    />
                    <button className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-600">
                      <Search size={20} />
                    </button>
                  </div>

                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-bold animate-pulse">Buscando seus pedidos...</p>
                    </div>
                  ) : userOrders.length > 0 ? (
                    <div className="space-y-3">
                      {userOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => fetchTracking(undefined, order.id)}
                          className="w-full text-left bg-slate-50 hover:bg-slate-100 p-4 rounded-2xl border border-slate-100 transition-all flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl ${getStatusColor(order.status)}`}>
                              <Package size={20} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Pedido #{order.id.substring(0, 8).toUpperCase()}</p>
                              <p className="font-bold text-slate-900">{getStatusText(order.status)}</p>
                              <p className="text-[10px] text-slate-500 font-medium">
                                {new Date(order.created_at).toLocaleDateString('pt-BR')} • R$ {order.total.toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Package size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-bold">Nenhum pedido recente encontrado.</p>
                      <p className="text-xs text-slate-400 mt-2">Use a busca acima para rastrear um pedido específico.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-4">
                      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-slate-500 font-bold animate-pulse">Buscando informações...</p>
                    </div>
                  ) : trackingData ? (
                    <div className="space-y-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</p>
                            <p className="font-mono font-bold text-slate-900">#{trackingData.id.substring(0, 8).toUpperCase()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</p>
                            <p className="font-bold text-slate-900">{new Date(trackingData.created_at).toLocaleDateString('pt-BR')}</p>
                          </div>
                        </div>
                        
                        {trackingData.order_items && trackingData.order_items.length > 0 && (
                          <div className="border-t border-slate-200 pt-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Produto</p>
                            <p className="font-bold text-slate-900">{trackingData.order_items[0].product_name}</p>
                            <p className="text-sm text-indigo-600 font-bold">R$ {trackingData.total.toFixed(2)}</p>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center border-t border-slate-200 pt-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</p>
                          <p className="font-bold text-indigo-600 uppercase tracking-tighter">{getStatusText(trackingData.status)}</p>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h3 className="font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 text-sm">
                          <MapPin size={18} className="text-indigo-600" />
                          Histórico de Movimentação
                        </h3>
                        
                        {realTimeHistory.length > 0 ? (
                          <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {realTimeHistory.map((h: any, idx: number) => (
                              <div key={idx} className="relative">
                                <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${idx === 0 ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                                  <div className={`w-2 h-2 rounded-full bg-white ${idx === 0 ? 'animate-pulse' : ''}`} />
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-sm font-bold text-slate-900 leading-tight">{h.description}</p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1 font-bold">
                                      <MapPin size={10} /> {h.location}
                                    </p>
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1 font-medium">
                                      <Clock size={10} /> {h.date}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : trackingData.tracking_history && trackingData.tracking_history.length > 0 ? (
                          <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {trackingData.tracking_history.map((h: any, idx: number) => (
                              <div key={h.id} className="relative">
                                <div className={`absolute -left-8 w-6 h-6 rounded-full border-4 border-white flex items-center justify-center ${idx === 0 ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                  <Truck size={12} className="text-white" />
                                </div>
                                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-sm font-bold text-slate-900 leading-tight">{h.status}</p>
                                  <p className="text-[10px] text-slate-500 mt-1 font-bold">{h.location} | {new Date(h.date).toLocaleString('pt-BR')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                            <Package size={40} className="mx-auto text-slate-300 mb-3" />
                            <p className="text-sm text-slate-500 font-bold">
                              SEU PRODUTO ESTÁ SENDO PREPARADO
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">
                              {trackingData.tracking_code 
                                ? 'O código de rastreio já foi gerado e aguarda coleta.' 
                                : 'Aguardando postagem'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <Search size={48} className="mx-auto text-slate-200 mb-4" />
                      <p className="text-slate-500 font-bold">Nenhum dado encontrado.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100">
              <button
                onClick={onClose}
                className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-800 transition-all shadow-lg"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
