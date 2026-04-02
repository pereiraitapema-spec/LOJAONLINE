import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Truck, CreditCard, Zap,
  Search, ChevronRight, Check, Copy, RefreshCw, X, AlertCircle, Wallet, QrCode, Trash2,
  MapPin, Calculator, FileText, ArrowRight, ExternalLink, Activity
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Loading } from '../components/Loading';
import { shippingService } from '../services/shippingService';
import { QRCodeSVG } from 'qrcode.react';
import { TrackingModal } from '../components/TrackingModal';
import { formatCurrency } from '../lib/utils';

export default function CepCertoAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [balance, setBalance] = useState<any>(null);
  const [pixAmount, setPixAmount] = useState('50');
  const [pixData, setPixData] = useState<any>(null);
  const [carrier, setCarrier] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [logisticaSubTab, setLogisticaSubTab] = useState('cotacao');
  const [lastFetched, setLastFetched] = useState<number | null>(null);
  
  // Ferramentas
  const [cepSearch, setCepSearch] = useState('');
  const [cepResult, setCepResult] = useState<any>(null);
  const [searchingCep, setSearchingCep] = useState(false);
  
  const [trackingSearch, setTrackingSearch] = useState('');
  const [consultingPostage, setConsultingPostage] = useState(false);
  const [consultResult, setConsultResult] = useState<any>(null);
  const [financialData, setFinancialData] = useState<any>(null);
  const [showFinancialModal, setShowFinancialModal] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [showValueModal, setShowValueModal] = useState(false);
  const [loadingFinancial, setLoadingFinancial] = useState(false);
  const [trackingInfo, setTrackingInfo] = useState<any>(null);
  const [showTrackingInfoModal, setShowTrackingInfoModal] = useState(false);
  const [loadingTrackingInfo, setLoadingTrackingInfo] = useState(false);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [quoteData, setQuoteData] = useState<any>({
    cep_origem: '',
    cep_remetente: '',
    cep_destino: '',
    peso: '',
    altura: '',
    largura: '',
    comprimento: '',
    valor_encomenda: ''
  });
  const [calculating, setCalculating] = useState(false);
  const [trackingModal, setTrackingModal] = useState<{ isOpen: boolean, code: string }>({ isOpen: false, code: '' });
  const [manualLabelData, setManualLabelData] = useState<any>({
    token_cliente_postagem: '',
    tipo_entrega: 'sedex',
    logistica_reversa: '',
    cep_remetente: '',
    cep_destinatario: '',
    peso: '',
    altura: '',
    largura: '',
    comprimento: '',
    valor_encomenda: '',
    nome_remetente: '',
    cpf_cnpj_remetente: '',
    whatsapp_remetente: '',
    email_remetente: '',
    logradouro_remetente: '',
    bairro_remetente: '',
    numero_endereco_remetente: '',
    complemento_remetente: '',
    nome_destinatario: '',
    cpf_cnpj_destinatario: '',
    whatsapp_destinatario: '',
    email_destinatario: '',
    logradouro_destinatario: '',
    bairro_destinatario: '',
    numero_endereco_destinatario: '',
    complemento_destinatario: '',
    tipo_doc_fiscal: 'declaracao',
    produtos: [{ descricao: '', valor: '', quantidade: '' }],
    chave_danfe: ''
  });
  const [savedSender, setSavedSender] = useState<any>(null);

  useEffect(() => {
    const fetchSavedSender = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('saved_senders')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (data) {
        setSavedSender(data);
        setManualLabelData((prev: any) => ({
          ...prev,
          ...data
        }));
      }
    };
    fetchSavedSender();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          navigate('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile?.role !== 'admin' && session.user.email !== 'pereira.itapema@gmail.com') {
          toast.error('Acesso negado.');
          navigate('/');
          return;
        }
        
        if (!lastFetched || Date.now() - lastFetched > 5 * 60 * 1000) {
          await Promise.race([
            fetchData(),
            new Promise(resolve => setTimeout(resolve, 5000))
          ]);
        }
      } catch (error) {
        console.error('Erro na verificação de admin:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, [navigate]);

  useEffect(() => {
    if (!carrier) return;
    const interval = setInterval(() => {
      console.log('Auto-refreshing CepCerto data...');
      fetchData(true);
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(interval);
  }, [carrier]);

  const handleRefreshBalance = async () => {
    if (!carrier) return;
    setRefreshingBalance(true);
    try {
      const balanceData = await shippingService.getBalance(carrier.settings);
      setBalance(balanceData);
      toast.success('Saldo atualizado!');
    } catch (e) {
      console.error('Erro ao buscar saldo:', e);
      toast.error('Erro ao atualizar saldo.');
    } finally {
      setRefreshingBalance(false);
    }
  };

  const formatCEP = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/^(\d{5})(\d{3})$/, '$1-$2');
  };

  const fetchData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      
      const { data: carriers, error: carrierError } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      if (carrierError) {
        console.error('Erro ao buscar transportadora CepCerto:', carrierError);
        toast.error('Erro ao buscar transportadora.');
        setLoading(false);
        return;
      }

      if (!carriers) {
        console.warn('Transportadora CepCerto não encontrada ou inativa.');
        if (!silent) toast.error('Transportadora CepCerto não encontrada ou inativa.');
        setLoading(false);
        return;
      }

      setCarrier(carriers);
      setLastFetched(Date.now());
      
      if (carriers.config?.origin_zip) {
        setQuoteData(prev => ({ 
          ...prev, 
          cep_origem: carriers.config.origin_zip,
          cep_remetente: carriers.config.origin_zip 
        }));
      }

      await Promise.all([
        (async () => {
          try {
            const config = carriers.config || carriers.settings;
            const balanceData = await shippingService.getBalance(config);
            setBalance(balanceData);
          } catch (e) {
            console.error('Erro ao buscar saldo:', e);
          }
        })(),
        (async () => {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .or('shipping_method.ilike.sedex,shipping_method.ilike.pac,shipping_method.ilike.jadlog')
            .order('created_at', { ascending: false })
            .limit(10);
          
          setRecentOrders(orders || []);
        })()
      ]);

    } catch (error: any) {
      console.error('Error fetching CepCerto data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePix = async () => {
    let currentCarrier = carrier;
    if (!currentCarrier) {
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();
      
      if (carriers) {
        setCarrier(carriers);
        currentCarrier = carriers;
      }
    }

    if (!currentCarrier) {
      toast.error('Transportadora não carregada.');
      return;
    }
    
    const amount = parseFloat(pixAmount);
    if (isNaN(amount) || amount < 20) {
      toast.error('O valor mínimo para recarga é R$ 20,00');
      return;
    }

    try {
      setIsGeneratingPix(true);
      const data = await shippingService.generatePix(
        currentCarrier.id,
        amount,
        'pereira.itapema@gmail.com', 
        '47999999999'
      );

      setPixData(data);
      setShowPixModal(true);
      toast.success('PIX gerado com sucesso!');
      const balanceData = await shippingService.getBalance(currentCarrier.settings);
      setBalance(balanceData);
    } catch (error: any) {
      console.error('Erro ao gerar PIX:', error);
      toast.error('Erro ao gerar PIX: ' + error.message);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleGenerateManualLabel = async () => {
    if (!carrier || !carrier.settings) {
      toast.error('Configurações da transportadora não carregadas.');
      return;
    }
    try {
      toast.loading('Gerando etiqueta manual...', { id: 'gen-label-manual' });
      
      const payload = {
        ...manualLabelData,
        token_cliente_postagem: carrier.settings.api_key_postagem || carrier.settings.api_key
      };
      
      const result = await shippingService.generateLabel('manual', carrier.settings, payload);
      
      if (result.success) {
        toast.success('Etiqueta gerada com sucesso!', { id: 'gen-label-manual' });
        console.log('✅ Etiqueta manual gerada:', result);
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: 'gen-label-manual' });
    }
  };

  const handleGenerateLabel = async (orderId: string) => {
    if (!carrier) return;
    try {
      toast.loading('Gerando etiqueta...', { id: 'gen-label' });
      const result = await shippingService.generateLabel(orderId);
      
      if (result.success) {
        const { error } = await supabase
          .from('orders')
          .update({
            tracking_code: result.tracking_code,
            shipping_label_url: result.shipping_label_url,
            status: 'shipped'
          })
          .eq('id', orderId);

        if (error) throw error;
        
        toast.success('Etiqueta gerada com sucesso!', { id: 'gen-label' });
        fetchData();
      } else {
        throw new Error(result.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`, { id: 'gen-label' });
    }
  };

  const handleSearchCep = async () => {
    if (cepSearch.length < 8) return;
    try {
      setSearchingCep(true);
      const res = await fetch(`https://viacep.com.br/ws/${cepSearch.replace(/\D/g, '')}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error('CEP não encontrado');
      setCepResult(data);
    } catch (error: any) {
      toast.error(error.message);
      setCepResult(null);
    } finally {
      setSearchingCep(false);
    }
  };

  const handleCalculate = async () => {
    if (!carrier) return;
    
    const pesoNum = parseFloat(quoteData.peso);
    const altNum = parseFloat(quoteData.altura);
    const largNum = parseFloat(quoteData.largura);
    const compNum = parseFloat(quoteData.comprimento);

    if (pesoNum < 0.3 || pesoNum > 30) {
      toast.error('Peso deve ser entre 0.3kg e 30kg');
      return;
    }
    if (altNum < 8 || altNum > 100) {
      toast.error('Altura deve ser entre 8cm e 100cm');
      return;
    }
    if (largNum < 13 || largNum > 100) {
      toast.error('Largura deve ser entre 13cm e 100cm');
      return;
    }
    if (compNum < 8 || compNum > 100) {
      toast.error('Comprimento deve ser entre 8cm e 100cm');
      return;
    }
    const valorNum = parseFloat(quoteData.valor_encomenda);
    if (valorNum < 1 || valorNum > 35000) {
      toast.error('Valor da encomenda deve ser entre R$ 1,00 e R$ 35.000,00');
      return;
    }
    if ((altNum + largNum + compNum) > 200) {
      toast.error('A soma de Altura + Largura + Comprimento não pode exceder 200cm');
      return;
    }

    try {
      setCalculating(true);
      const result = await shippingService.calculateShipping(
        quoteData.cep_destino,
        [{
          weight: pesoNum,
          width: largNum,
          height: altNum,
          length: compNum,
          price: parseFloat(quoteData.valor_encomenda)
        }],
        carrier.settings
      );
      setQuotes(result);
    } catch (error: any) {
      toast.error('Erro no cálculo: ' + error.message);
    } finally {
      setCalculating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado para a área de transferência!');
  };

  const handleCancelLabel = async (orderId: string, trackingCode: string) => {
    if (!window.confirm(`Deseja realmente cancelar a etiqueta deste pedido?`)) return;
    
    try {
      toast.loading('Cancelando etiqueta...', { id: 'cancel-label' });
      const result = await shippingService.cancelLabel(trackingCode, carrier.settings);
      if (!result.success) {
        throw new Error(result.error || 'Erro ao cancelar etiqueta');
      }

      const { error: updateError } = await supabase
        .from('orders')
        .update({ 
          tracking_code: null, 
          shipping_label_url: null 
        })
        .eq('id', orderId);

      if (updateError) throw updateError;

      toast.success('Etiqueta cancelada com sucesso!', { id: 'cancel-label' });
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao cancelar: ' + error.message, { id: 'cancel-label' });
    }
  };

  const handleConsultPostage = async (code?: string) => {
    const trackingCode = code || trackingSearch;
    if (!trackingCode) {
      toast.error('Digite um código de rastreio');
      return;
    }

    if (!carrier) {
      toast.error('Configurações do CepCerto não encontradas');
      return;
    }

    setConsultingPostage(true);
    setConsultResult(null);
    try {
      const result = await shippingService.consultPostage(trackingCode, carrier.settings);
      
      if (result && (result.sucesso === true || result.sucesso === "true")) {
        setConsultResult(result);
        toast.success(result.mensagem || 'Informação encontrada no CepCerto');
      } else {
        toast.loading('Informação não encontrada no CepCerto. Redirecionando para Correios...', { duration: 3000 });
        setTimeout(() => {
          window.open(`https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`, '_blank');
        }, 2000);
      }
    } catch (error: any) {
      console.error('Erro ao consultar postagem:', error);
      window.open(`https://rastreamento.correios.com.br/app/index.php?objeto=${trackingCode}`, '_blank');
    } finally {
      setConsultingPostage(false);
    }
  };

  const handleGetFinancialStatement = async () => {
    if (!carrier) return;
    setLoadingFinancial(true);
    try {
      const result = await shippingService.getFinancialStatement(carrier.settings);
      if (result && (result.sucesso === true || result.sucesso === "true")) {
        setFinancialData(result);
        setShowFinancialModal(true);
      } else {
        toast.error(result?.mensagem || 'Erro ao buscar extrato financeiro');
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoadingFinancial(false);
    }
  };

  const handleGetTrackingInfo = async (trackingCode: string) => {
    if (!carrier) return;
    setLoadingTrackingInfo(true);
    try {
      const result = await shippingService.getTrackingInfo(trackingCode, carrier.settings);
      if (result && (result.sucesso === true || result.sucesso === "true")) {
        setTrackingInfo(result);
        setShowTrackingInfoModal(true);
      } else {
        toast.error(result?.mensagem || 'Erro ao buscar informações de rastreio');
      }
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally {
      setLoadingTrackingInfo(false);
    }
  };

  if (loading) return <Loading message="Carregando Logística CepCerto..." />;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-bottom border-slate-100">
          <div className="flex items-center gap-3 text-indigo-600 font-bold text-xl cursor-pointer" onClick={() => navigate('/dashboard')}>
            <Shield size={28} />
            <span>Admin Pro</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => navigate('/dashboard')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <LayoutDashboard size={20} /> Dashboard
          </button>
          <button onClick={() => navigate('/banners')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ImageIcon size={20} /> Banners
          </button>
          <button onClick={() => navigate('/campaigns')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Megaphone size={20} /> Campanhas
          </button>
          <button onClick={() => navigate('/products')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Package size={20} /> Produtos
          </button>
          <button onClick={() => navigate('/orders')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <ShoppingBag size={20} /> Pedidos
          </button>
          <button onClick={() => navigate('/affiliates')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Users size={20} /> Afiliados
          </button>
          <button onClick={() => navigate('/gateways')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <CreditCard size={20} /> Gateways
          </button>
          <div className="space-y-1">
            <button onClick={() => navigate('/shipping')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
              <Truck size={20} /> Transportadoras
            </button>
            <button className="w-full flex items-center gap-3 px-8 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-bold transition-colors text-sm">
              <Zap size={16} /> Logística CepCerto
            </button>
          </div>
          <button onClick={() => navigate('/settings')} className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors">
            <Settings size={20} /> Configurações
          </button>
        </nav>
      </aside>

      <div className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Logística CepCerto</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-500">Gerenciamento profissional de fretes e etiquetas.</p>
                {lastFetched && (
                  <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                    Atualizado: {new Date(lastFetched).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
            <button 
              onClick={() => fetchData()}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
          
          {/* Card de Saldo */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saldo Disponível</p>
              <h2 className="text-3xl font-black text-slate-900 mt-1">
                {balance ? `R$ ${balance.saldo || balance.saldo_atual || '0,00'}` : 'Carregando...'}
              </h2>
            </div>
            <button 
              onClick={handleRefreshBalance}
              disabled={refreshingBalance}
              className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all"
            >
              <RefreshCw size={24} className={refreshingBalance ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Conteúdo Principal (Tabs) */}
          <div className="flex gap-4 mb-8">
            <button 
              onClick={() => setLogisticaSubTab('cotacao')}
              className={`px-6 py-3 rounded-2xl font-bold transition-all ${logisticaSubTab === 'cotacao' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Cotação
            </button>
            <button 
              onClick={() => setLogisticaSubTab('etiquetas')}
              className={`px-6 py-3 rounded-2xl font-bold transition-all ${logisticaSubTab === 'etiquetas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Etiquetas
            </button>
            <button 
              onClick={() => setLogisticaSubTab('rastreio')}
              className={`px-6 py-3 rounded-2xl font-bold transition-all ${logisticaSubTab === 'rastreio' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              Rastreio
            </button>
          </div>

          {/* Conteúdo das Tabs */}
          {logisticaSubTab === 'cotacao' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Formulário de Cotação */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic tracking-tighter">Nova Cotação</h3>
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" placeholder="CEP Destino" value={quoteData.cep_destino} onChange={e => setQuoteData({...quoteData, cep_destino: formatCEP(e.target.value)})} className="col-span-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Peso (kg)" value={quoteData.peso} onChange={e => setQuoteData({...quoteData, peso: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Valor (R$)" value={quoteData.valor_encomenda} onChange={e => setQuoteData({...quoteData, valor_encomenda: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Altura (cm)" value={quoteData.altura} onChange={e => setQuoteData({...quoteData, altura: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Largura (cm)" value={quoteData.largura} onChange={e => setQuoteData({...quoteData, largura: e.target.value})} className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                  <input type="number" placeholder="Comprimento (cm)" value={quoteData.comprimento} onChange={e => setQuoteData({...quoteData, comprimento: e.target.value})} className="col-span-2 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" />
                </div>
                <button onClick={handleCalculate} disabled={calculating} className="w-full mt-6 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200">
                  {calculating ? 'Calculando...' : 'Calcular Frete'}
                </button>
              </div>

              {/* Resultados */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-black text-slate-900 mb-6 uppercase italic tracking-tighter">Opções de Envio</h3>
                {quotes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Truck size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Preencha os dados e calcule o frete.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((q: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-900">{q.name}</p>
                          <p className="text-sm text-slate-500">Prazo: {q.delivery_time} dias</p>
                        </div>
                        <p className="text-lg font-black text-indigo-600">R$ {q.price}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
