import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { CheckCircle2, ShoppingBag, ArrowRight, Home, Download, Share2, QrCode, Barcode, Landmark, Clock, Truck, LayoutDashboard } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/Loading';
import { TrackingModal } from '../components/TrackingModal';

export default function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        // Fetch Order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle();

        if (orderError) throw orderError;
        setOrder(orderData);

        // Fetch Settings for payment details
        const { data: settingsData } = await supabase
          .from('store_settings')
          .select('*')
          .single();
        
        setSettings(settingsData);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Real-time listener for order status updates (Webhook confirmation)
    const subscription = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'orders',
        filter: `id=eq.${orderId}`
      }, (payload) => {
        console.log('🔔 Pedido atualizado em tempo real:', payload.new);
        setOrder(payload.new);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [orderId, navigate]);

  const getPaymentDetails = () => {
    if (!order || !settings) return null;
    
    const method = settings.payment_methods?.find((m: any) => m.type === order.payment_method);
    return method?.details || 'Aguardando processamento...';
  };

  if (loading) return <Loading message="Carregando detalhes do pedido..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/60 overflow-hidden border border-slate-100"
      >
        <div className="p-8 md:p-12 text-center">
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.2 }}
            className={`w-24 h-24 ${(order?.status === 'paid' || order?.status === 'processing' || order?.status === 'shipped') ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'} rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner`}
          >
            {(order?.status === 'paid' || order?.status === 'processing' || order?.status === 'shipped') ? <CheckCircle2 size={48} /> : <Clock size={48} />}
          </motion.div>

          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">
            {(order?.status === 'paid' || order?.status === 'processing' || order?.status === 'shipped') 
              ? 'Pedido Confirmado!' 
              : (order?.status === 'pending' && order?.payment_method === 'credit_card' ? 'Pagamento em Análise!' : 'Pedido Recebido!')}
          </h1>
          <p className="text-slate-500 text-lg mb-8">
            {(order?.status === 'paid' || order?.status === 'processing' || order?.status === 'shipped') 
              ? (order?.tracking_code ? 'Seu pedido está sendo levado para a transportadora.' : 'Obrigado por sua compra. Seu pedido foi processado com sucesso e está sendo preparado para envio.')
              : (order?.status === 'pending' && order?.payment_method === 'credit_card' 
                  ? 'Seu pagamento está passando por uma análise de segurança e será aprovado em breve.' 
                  : 'Seu pedido foi recebido e está aguardando o pagamento para ser processado.')}
          </p>

          {order && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8 text-left"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Truck size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest">Código de Rastreio</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">
                    {order.tracking_code || 'Aguardando Postagem'}
                  </p>
                  <button 
                    onClick={() => setIsTrackingModalOpen(true)}
                    className="text-xs font-bold text-indigo-600 hover:underline mt-1 flex items-center gap-1"
                  >
                    <LayoutDashboard size={14} />
                    Acompanhar Entrega
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {order && (order.status === 'pending' || order.status === 'awaiting_payment') && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-indigo-50 border-2 border-indigo-100 rounded-3xl p-8 mb-8 text-center"
            >
              <div className="flex flex-col items-center gap-4">
                {(order.payment_method === 'pix' || (order.payment_method === 'pagarme' && order.pix_code)) && (
                  <>
                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <QrCode size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">Pague com PIX</h3>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 w-48 h-48 flex items-center justify-center">
                      <img 
                        src={order.payment_url || ''} 
                        alt="QR Code PIX" 
                        className="w-full h-full"
                      />
                    </div>
                    <div className="w-full">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Chave PIX (Copia e Cola)</p>
                      <div className="flex gap-2">
                        <input 
                          readOnly 
                          value={order.pix_code || ''} 
                          className="flex-1 bg-white border border-slate-200 px-4 py-2 rounded-xl text-sm font-mono"
                        />
                        <button 
                          onClick={() => {
                            const code = order.pix_code || '';
                            if (code) {
                              navigator.clipboard.writeText(code);
                              toast.success('Chave PIX copiada!');
                            }
                          }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
                        >
                          Copiar
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {(order.payment_method === 'boleto' || (order.payment_method === 'pagarme' && order.payment_url?.includes('boleto'))) && (
                  <>
                    <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
                      <Barcode size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">Pague com Boleto</h3>
                    <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 text-left">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Código de Barras</p>
                      <p className="font-mono text-sm break-all bg-slate-50 p-3 rounded-lg border border-slate-100 mb-4">
                        {order.pix_code || ''}
                      </p>
                      <button 
                        onClick={() => order.payment_url ? window.open(order.payment_url, '_blank') : toast.error('Boleto não disponível ainda.')}
                        className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                      >
                        <Download size={18} />
                        Visualizar Boleto PDF
                      </button>
                    </div>
                  </>
                )}

                {order.payment_method === 'transfer' && (
                  <>
                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Landmark size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic">Dados para Transferência</h3>
                    <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 text-left">
                      <p className="text-sm text-slate-600 mb-4">Realize a transferência para a conta abaixo e envie o comprovante pelo WhatsApp.</p>
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Dados da Conta</p>
                          <p className="text-sm font-bold text-slate-800 whitespace-pre-line">
                            {getPaymentDetails() || 'Dados não configurados'}
                          </p>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Valor Exato</p>
                          <p className="text-lg font-black text-indigo-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {order && (
            <div className="bg-slate-50 rounded-3xl p-6 mb-8 text-left border border-slate-100">
              <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número do Pedido</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">#{order.id.split('-')[0].toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <span className={`px-3 py-1 ${order.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} rounded-full text-xs font-bold uppercase`}>
                    {order.status === 'paid' ? 'Pago' : 'Aguardando Pagamento'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {order.order_items?.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl border border-slate-200 flex items-center justify-center text-slate-400">
                        <ShoppingBag size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{item.product_name}</p>
                        <p className="text-xs text-slate-500">Qtd: {item.quantity}</p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-slate-200 flex justify-between items-center">
                <p className="text-slate-500 font-bold">Total Pago</p>
                <p className="text-2xl font-black text-indigo-600 tracking-tighter">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
            >
              <Home size={20} />
              Voltar para Loja
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-white text-slate-600 border border-slate-200 px-8 py-4 rounded-2xl font-bold hover:bg-slate-50 transition-all"
            >
              <Download size={20} />
              Imprimir Recibo
            </button>
          </div>
        </div>

        <div className="bg-slate-900 p-6 text-center">
          <p className="text-slate-400 text-sm font-medium flex items-center justify-center gap-2">
            <Share2 size={16} />
            Compartilhe sua compra e ganhe descontos na próxima!
          </p>
        </div>
      </motion.div>

      <TrackingModal 
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
      />
    </div>
  );
}
