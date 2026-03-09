import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle2, ShoppingBag, ArrowRight, Home, Download, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Loading } from '../components/Loading';

export default function Success() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('orderId');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      navigate('/');
      return;
    }

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle();

        if (error) throw error;
        setOrder(data);
      } catch (error) {
        console.error('Error fetching order:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId, navigate]);

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
            className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner"
          >
            <CheckCircle2 size={48} />
          </motion.div>

          <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">
            Pedido Confirmado!
          </h1>
          <p className="text-slate-500 text-lg mb-8">
            Obrigado por sua compra. Seu pedido foi processado com sucesso e você receberá um e-mail com os detalhes em breve.
          </p>

          {order && (
            <div className="bg-slate-50 rounded-3xl p-6 mb-8 text-left border border-slate-100">
              <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Número do Pedido</p>
                  <p className="text-lg font-black text-slate-900 tracking-tight">#{order.id.split('-')[0].toUpperCase()}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase">
                    Pago
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
    </div>
  );
}
