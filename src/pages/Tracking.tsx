import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Package, Truck, CheckCircle, Clock, MapPin, Search, ArrowLeft } from 'lucide-react';
import { shippingService } from '../services/shippingService';
import { motion } from 'motion/react';

const Tracking: React.FC = () => {
  const { trackingCode: urlTrackingCode } = useParams<{ trackingCode: string }>();
  const [trackingCode, setTrackingCode] = useState(urlTrackingCode || '');
  const [loading, setLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlTrackingCode) {
      handleTrack(urlTrackingCode);
    }
  }, [urlTrackingCode]);

  const handleTrack = async (code: string) => {
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const data = await shippingService.getTrackingStatus(code);
      setTrackingData(data);
    } catch (err: any) {
      console.error('Error tracking package:', err);
      setError('Não foi possível encontrar informações para este código de rastreio.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('entregue')) return <CheckCircle className="w-8 h-8 text-green-500" />;
    if (s.includes('trânsito') || s.includes('enviado') || s.includes('shipped')) return <Truck className="w-8 h-8 text-blue-500" />;
    if (s.includes('preparando') || s.includes('preparing') || s.includes('separação')) return <Package className="w-8 h-8 text-indigo-500" />;
    if (s.includes('aguardando') || s.includes('pendente')) return <Clock className="w-8 h-8 text-yellow-500" />;
    return <Package className="w-8 h-8 text-gray-500" />;
  };

  const getStatusLabel = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'paid') return 'Pagamento Confirmado';
    if (s === 'preparing') return 'Em Preparação';
    if (s === 'shipped') return 'Enviado';
    if (s === 'delivered') return 'Entregue';
    return status;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para a loja
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold text-gray-900 tracking-tight">Rastrear Pedido</h1>
          <p className="mt-2 text-lg text-gray-600">Acompanhe o status da sua entrega em tempo real.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex gap-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                placeholder="Digite seu código de rastreio (ex: BR123456789)"
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm"
              />
            </div>
            <button
              onClick={() => handleTrack(trackingCode)}
              disabled={loading || !trackingCode}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-all"
            >
              {loading ? 'Buscando...' : 'Rastrear'}
            </button>
          </div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border-l-4 border-red-400 p-4 mb-8 rounded-r-xl"
          >
            <div className="flex">
              <div className="flex-shrink-0">
                <Package className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </motion.div>
        )}

        {trackingData && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    {getStatusIcon(trackingData.status)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Status Atual</p>
                    <h2 className="text-xl font-bold text-gray-900">{getStatusLabel(trackingData.status)}</h2>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Código</p>
                  <p className="text-lg font-mono font-bold text-primary">{trackingCode}</p>
                </div>
              </div>

              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Histórico de Movimentação</h3>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100"></div>
                  <div className="space-y-8">
                    {trackingData.history.map((event: any, index: number) => (
                      <div key={index} className="relative flex items-start ml-10">
                        <div className={`absolute -left-10 mt-1.5 w-4 h-4 rounded-full border-4 border-white shadow-sm ${index === 0 ? 'bg-primary scale-125' : 'bg-gray-300'}`}></div>
                        <div className="flex-grow">
                          <div className="flex items-center justify-between mb-1">
                            <p className={`text-sm font-bold ${index === 0 ? 'text-gray-900' : 'text-gray-600'}`}>
                              {event.description}
                            </p>
                            <span className="text-xs text-gray-400 font-medium whitespace-nowrap ml-4">
                              {new Date(event.date).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <MapPin className="w-3 h-3 mr-1" />
                            {event.location}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
              <div className="flex gap-4">
                <div className="p-2 bg-blue-100 rounded-lg h-fit">
                  <Truck className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-blue-900">Precisa de ajuda com sua entrega?</h4>
                  <p className="text-sm text-blue-700 mt-1">
                    Se você tiver dúvidas sobre o prazo ou o status do seu pedido, entre em contato com nosso suporte.
                  </p>
                  <button className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4">
                    Falar com suporte via WhatsApp
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Tracking;
