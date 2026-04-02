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
        
        // Executa fetchData com um timeout de segurança para garantir que a tela carregue
        // mesmo que as APIs externas (CepCerto/Proxy) demorem ou falhem
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
      
      // Buscar transportadora CepCerto
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('*')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .maybeSingle();

      if (!carriers) {
        if (!silent) toast.error('Transportadora CepCerto não encontrada ou inativa.');
        setLoading(false);
        return;
      }

      setCarrier(carriers);
      setLastFetched(Date.now());
      
      // Configurar CEP de origem padrão se disponível
      if (carriers.config?.origin_zip) {
        setQuoteData(prev => ({ 
          ...prev, 
          cep_origem: carriers.config.origin_zip,
          cep_remetente: carriers.config.origin_zip 
        }));
      }

      // Buscar saldo e pedidos em paralelo
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
    // Tentar carregar o carrier se ainda não estiver carregado
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
      // Atualiza o saldo após gerar PIX
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
        // Atualizar pedido no banco
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
        fetchData(); // Atualizar lista
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

    // Validações conforme API CepCerto (Postagem)
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

      // Limpar no banco de dados
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
        // Se não encontrou informação ou sucesso é falso, redireciona para o Correios
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

      <main className="flex-1 p-8 overflow-y-auto">
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

          {/* Tabs Navigation */}
          <div className="flex gap-2 mb-8 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'logistica', label: 'Logística', icon: Truck },
              { id: 'etiquetas', label: 'Etiquetas', icon: ShoppingBag },
              { id: 'financeiro', label: 'Financeiro', icon: CreditCard },
              { id: 'ferramentas', label: 'Ferramentas', icon: Zap },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Card de Saldo - Altura reduzida */}
                <div className="bg-indigo-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-indigo-200 relative overflow-hidden h-fit">
                  <div className="absolute top-0 right-0 p-6 opacity-10">
                    <Wallet size={80} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mb-1">Saldo Disponível</p>
                    <h2 className="text-4xl font-black italic tracking-tighter mb-4">
                      {balance?.saldo ? formatCurrency(parseFloat(balance.saldo)) : 'R$ 0,00'}
                    </h2>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={handleRefreshBalance}
                        disabled={refreshingBalance}
                        className="flex-1 py-2.5 bg-white/20 hover:bg-white/30 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 border border-white/30 disabled:opacity-50 text-xs"
                      >
                        <RefreshCw size={14} className={refreshingBalance ? 'animate-spin' : ''} />
                        {refreshingBalance ? '...' : 'Atualizar'}
                      </button>
                      <button 
                        onClick={handleGetFinancialStatement}
                        disabled={loadingFinancial}
                        className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 border border-indigo-400 disabled:opacity-50 text-xs"
                      >
                        <FileText size={14} />
                        Extrato
                      </button>
                    </div>
                  </div>
                </div>

                {/* Recarregar Saldo - Altura reduzida */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm h-fit">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                      <CreditCard className="text-indigo-600" size={20} />
                      Recarregar Saldo
                    </h3>
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest">Liberação instantânea via PIX</p>
                  </div>
                  
                  <button 
                    onClick={() => setShowValueModal(true)}
                    className="w-full px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
                  >
                    <QrCode size={18} />
                    Gerar PIX
                  </button>
                </div>
              </div>

              {/* Ações Rápidas */}
              <div className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter mb-4 flex items-center gap-2">
                  <Zap className="text-indigo-600" size={20} />
                  Ações Rápidas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={handleGeneratePix} className="p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all text-center group">
                    <QrCode className="text-slate-400 group-hover:text-indigo-600 mx-auto mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase text-slate-600">Inserir crédito via pix</p>
                  </button>
                  <button onClick={handleRefreshBalance} className="p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all text-center group">
                    <Wallet className="text-slate-400 group-hover:text-indigo-600 mx-auto mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase text-slate-600">Consulta de saldo</p>
                  </button>
                  <button onClick={() => setActiveTab('logistica')} className="p-4 bg-slate-50 hover:bg-indigo-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-all text-center group">
                    <Calculator className="text-slate-400 group-hover:text-indigo-600 mx-auto mb-2" size={24} />
                    <p className="text-[9px] font-black uppercase text-slate-600">Cotação de frete</p>
                  </button>
                </div>
              </div>

              {/* Etiquetas Recentes - Full Width */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm overflow-hidden w-full">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Etiquetas Recentes</h3>
                  <button onClick={() => navigate('/orders')} className="text-indigo-600 font-bold text-sm hover:underline">Ver todos os pedidos</button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left border-b border-slate-100">
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pedido</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Serviço</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Rastreio</th>
                        <th className="pb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="group hover:bg-slate-50/50 transition-colors">
                          <td className="py-4">
                            <span className="font-mono text-xs font-bold text-slate-400">#{order.id.slice(0, 8)}</span>
                          </td>
                          <td className="py-4">
                            <p className="text-sm font-bold text-slate-900">{order.customer_name}</p>
                          </td>
                          <td className="py-4">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                              order.shipping_method.includes('SEDEX') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {order.shipping_method}
                            </span>
                          </td>
                          <td className="py-4">
                            {order.tracking_code ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-indigo-600">{order.tracking_code}</span>
                                <button onClick={() => copyToClipboard(order.tracking_code)} className="text-slate-300 hover:text-indigo-600">
                                  <Copy size={12} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 italic">Pendente</span>
                            )}
                          </td>
                          <td className="py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {!order.tracking_code && (
                                <button 
                                  onClick={() => handleGenerateLabel(order.id)}
                                  className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
                                  title="Gerar Etiqueta"
                                >
                                  <Zap size={16} />
                                </button>
                              )}
                              {order.shipping_label_url && (
                                <a 
                                  href={order.shipping_label_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                                  title="Imprimir Etiqueta"
                                >
                                  <ExternalLink size={16} />
                                </a>
                              )}
                              {order.tracking_code && (
                                <>
                                  <button 
                                    onClick={() => setTrackingModal({ isOpen: true, code: order.tracking_code })}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                                    title="Rastrear"
                                  >
                                    <Truck size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleConsultPostage(order.tracking_code)}
                                    className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-colors"
                                    title="Consultar Postagem (API)"
                                  >
                                    <Search size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleGetTrackingInfo(order.tracking_code)}
                                    className="p-2 bg-purple-50 text-purple-600 rounded-xl hover:bg-purple-100 transition-colors"
                                    title="Rastreio Detalhado (API)"
                                  >
                                    <Activity size={16} />
                                  </button>
                                  <button 
                                    onClick={() => handleCancelLabel(order.id, order.tracking_code)}
                                    className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                                    title="Cancelar Etiqueta"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={() => navigate(`/orders?id=${order.id}&from=cepcerto`)}
                                className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {recentOrders.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-12 text-center">
                            <Truck size={48} className="mx-auto text-slate-200 mb-4" />
                            <p className="text-slate-400 font-medium">Nenhuma etiqueta gerada recentemente.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'logistica' && (
            <div className="space-y-8">
              {/* Sub-tabs */}
              <div className="flex gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 w-fit shadow-sm">
                <button onClick={() => setLogisticaSubTab('cotacao')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${logisticaSubTab === 'cotacao' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Cotação Rápida</button>
                <button onClick={() => setLogisticaSubTab('etiqueta')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${logisticaSubTab === 'etiqueta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>Gerar Etiqueta</button>
              </div>
              
              {logisticaSubTab === 'cotacao' && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 italic uppercase tracking-tighter">
                    <Calculator className="text-indigo-600" size={24} />
                    Cotação Rápida
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <input placeholder="CEP Origem" value={quoteData.cep_origem} onChange={e => setQuoteData({...quoteData, cep_origem: formatCEP(e.target.value)})} maxLength={9} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="CEP Destino" value={quoteData.cep_destino} onChange={e => setQuoteData({...quoteData, cep_destino: formatCEP(e.target.value)})} maxLength={9} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Altura (cm)" value={quoteData.altura} onChange={e => setQuoteData({...quoteData, altura: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Largura (cm)" value={quoteData.largura} onChange={e => setQuoteData({...quoteData, largura: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Comprimento (cm)" value={quoteData.comprimento} onChange={e => setQuoteData({...quoteData, comprimento: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Peso (kg)" value={quoteData.peso} onChange={e => setQuoteData({...quoteData, peso: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Valor Seguro (R$)" value={quoteData.valor_encomenda} onChange={e => setQuoteData({...quoteData, valor_encomenda: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                  </div>
                  <button 
                    onClick={handleCalculate}
                    disabled={calculating}
                    className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {calculating ? 'Calculando...' : 'Calcular Frete'}
                  </button>
                </div>
              )}

              {logisticaSubTab === 'etiqueta' && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 mt-8">
                <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 italic uppercase tracking-tighter">
                  <ShoppingBag className="text-indigo-600" size={24} />
                  Gerar Etiqueta Manual
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Remetente */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-700">Remetente</h4>
                    <input placeholder="Nome" value={manualLabelData.nome_remetente} onChange={e => setManualLabelData({...manualLabelData, nome_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="CPF/CNPJ" value={manualLabelData.cpf_cnpj_remetente} onChange={e => setManualLabelData({...manualLabelData, cpf_cnpj_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="CEP" value={manualLabelData.cep_remetente} onChange={e => setManualLabelData({...manualLabelData, cep_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Logradouro" value={manualLabelData.logradouro_remetente} onChange={e => setManualLabelData({...manualLabelData, logradouro_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                  </div>
                  {/* Destinatário */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-700">Destinatário</h4>
                    <input placeholder="Nome" value={manualLabelData.nome_destinatario} onChange={e => setManualLabelData({...manualLabelData, nome_destinatario: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="CPF/CNPJ" value={manualLabelData.cpf_cnpj_destinatario} onChange={e => setManualLabelData({...manualLabelData, cpf_cnpj_destinatario: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="CEP" value={manualLabelData.cep_destinatario} onChange={e => setManualLabelData({...manualLabelData, cep_destinatario: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                    <input placeholder="Logradouro" value={manualLabelData.logradouro_destinatario} onChange={e => setManualLabelData({...manualLabelData, logradouro_destinatario: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                  </div>
                </div>
                <button 
                  onClick={handleGenerateManualLabel}
                  className="w-full mt-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  Gerar Etiqueta
                </button>
              </div>
              )}
              {/* Consulta de Postagem */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 italic uppercase tracking-tighter">
                    <Search className="text-indigo-600" size={24} />
                    Consulta de Postagem
                  </h3>
                  <div className="flex gap-3 mb-4">
                    <input 
                      type="text"
                      value={trackingSearch}
                      onChange={(e) => setTrackingSearch(e.target.value)}
                      placeholder="Código de Rastreio..."
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                    <button 
                      onClick={() => handleConsultPostage()}
                      disabled={consultingPostage}
                      className="p-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                    >
                      {consultingPostage ? <RefreshCw className="animate-spin" size={20} /> : <Search size={20} />}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-relaxed">
                    Consulta forçada via API CepCerto. Caso não haja informação, você será redirecionado ao site dos Correios.
                  </p>

                  {consultResult && (
                    <div className="mt-6 p-6 bg-amber-50 rounded-[2rem] border border-amber-100 space-y-4">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Resultado CepCerto</p>
                        <button onClick={() => setConsultResult(null)} className="text-amber-400 hover:text-amber-600">
                          <X size={18} />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-amber-900">{consultResult.mensagem}</p>
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-amber-200">
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase">Saldo Anterior</p>
                          <p className="text-sm font-black text-amber-900">{consultResult.saldo_anterior}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase">Saldo Atual</p>
                          <p className="text-sm font-black text-amber-900">{consultResult.saldo_atual}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Rastreio Rápido */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3 italic uppercase tracking-tighter">
                    <Truck className="text-indigo-600" size={24} />
                    Rastreio Rápido
                  </h3>
                  <div className="flex gap-3">
                    <input 
                      type="text"
                      placeholder="Código de Rastreio..."
                      className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setTrackingModal({ isOpen: true, code: (e.target as HTMLInputElement).value });
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = (e.currentTarget.previousSibling as HTMLInputElement);
                        if (input.value) setTrackingModal({ isOpen: true, code: input.value });
                      }}
                      className="p-4 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg shadow-slate-200"
                    >
                      <Search size={20} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financeiro' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Saldo em Conta</p>
                  <h2 className="text-4xl font-black text-slate-900 italic tracking-tighter mb-6">
                    {balance?.saldo ? formatCurrency(parseFloat(balance.saldo)) : 'R$ 0,00'}
                  </h2>
                  <button 
                    onClick={handleGetFinancialStatement}
                    disabled={loadingFinancial}
                    className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-indigo-100"
                  >
                    {loadingFinancial ? <RefreshCw className="animate-spin" size={20} /> : <FileText size={20} />}
                    Ver Extrato Completo
                  </button>
                </div>

                <div className="md:col-span-2 bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 flex items-center gap-8">
                  <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                    <Shield size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-indigo-900 uppercase italic tracking-tighter mb-2">Segurança Financeira</h3>
                    <p className="text-indigo-700 font-medium leading-relaxed">
                      Todas as transações são processadas via API segura do CepCerto. 
                      Seu saldo é atualizado em tempo real após cada postagem ou recarga.
                    </p>
                  </div>
                </div>
              </div>

              {/* Histórico Financeiro */}
              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-8">Histórico de Transações</h3>
                {financialData?.extrato ? (
                  <div className="space-y-4">
                    {financialData.extrato.map((item: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-bold text-slate-900">{item.descricao}</p>
                          <p className="text-xs text-slate-500">{item.data}</p>
                        </div>
                        <p className={`font-black ${item.valor.startsWith('-') ? 'text-red-600' : 'text-emerald-600'}`}>
                          {item.valor}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <FileText size={64} className="mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">Clique no botão acima para carregar o extrato oficial</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'ferramentas' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <button 
                onClick={handleGeneratePix}
                className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-indigo-500 transition-all text-center"
              >
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CreditCard size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Inserir crédito via pix</h3>
              </button>

              <button 
                onClick={async () => {
                  try {
                    const balance = await shippingService.getBalance(carrier.settings);
                    toast.success(`Saldo atual: ${balance.saldo}`);
                  } catch (e: any) {
                    toast.error('Erro ao consultar saldo: ' + e.message);
                  }
                }}
                className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-indigo-500 transition-all text-center"
              >
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wallet size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Consulta de saldo</h3>
              </button>

              <button 
                onClick={() => setActiveTab('cotacao')}
                className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 hover:border-indigo-500 transition-all text-center"
              >
                <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Truck size={32} />
                </div>
                <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">Cotação de frete</h3>
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

      {showFinancialModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-indigo-600 text-white">
              <div className="flex items-center gap-3">
                <CreditCard size={24} />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Extrato Financeiro</h2>
              </div>
              <button onClick={() => setShowFinancialModal(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase">Cliente</p>
                  <p className="text-sm font-black text-slate-900">{financialData?.nome_cliente}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo Anterior</p>
                    <p className="text-lg font-black text-slate-900">{financialData?.saldo_anterior}</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valor Creditado</p>
                    <p className="text-lg font-black text-emerald-600">{financialData?.valor_creditado}</p>
                  </div>
                </div>

                <div className="p-6 bg-indigo-600 rounded-2xl text-white shadow-lg shadow-indigo-100">
                  <p className="text-xs font-bold opacity-80 uppercase mb-1">Saldo Atual Disponível</p>
                  <p className="text-3xl font-black tracking-tighter">{financialData?.saldo_atual}</p>
                </div>

                {financialData?.mensagem && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
                      <AlertCircle size={14} />
                      {financialData.mensagem}
                    </p>
                  </div>
                )}
              </div>

              {/* Se o extrato retornar uma lista (extrato_lista), renderizamos aqui */}
              {financialData?.extrato_lista && Array.isArray(financialData.extrato_lista) && (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Últimas Movimentações</p>
                  {financialData.extrato_lista.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-center">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{item.descricao || 'Movimentação'}</p>
                        <p className="text-[10px] text-slate-500">{item.data}</p>
                      </div>
                      <p className={`text-xs font-black ${item.tipo === 'credito' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {item.valor}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button 
                onClick={() => setShowFinancialModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
              >
                Fechar Extrato
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Rastreio Detalhado */}
      {showTrackingInfoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-purple-600 text-white">
              <div className="flex items-center gap-3">
                <Activity size={24} />
                <h2 className="text-xl font-black uppercase italic tracking-tighter">Rastreio Detalhado</h2>
              </div>
              <button onClick={() => setShowTrackingInfoModal(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase">Cliente</p>
                  <p className="text-sm font-black text-slate-900">{trackingInfo?.nome_cliente}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Saldo Anterior</p>
                    <p className="text-lg font-black text-slate-900">{trackingInfo?.saldo_anterior}</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Valor Creditado</p>
                    <p className="text-lg font-black text-emerald-600">{trackingInfo?.valor_creditado}</p>
                  </div>
                </div>

                <div className="p-6 bg-purple-600 rounded-2xl text-white shadow-lg shadow-purple-100">
                  <p className="text-xs font-bold opacity-80 uppercase mb-1">Saldo Atual</p>
                  <p className="text-3xl font-black tracking-tighter">{trackingInfo?.saldo_atual}</p>
                </div>

                {trackingInfo?.mensagem && (
                  <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                    <p className="text-xs font-bold text-amber-800 flex items-center gap-2">
                      <AlertCircle size={14} />
                      {trackingInfo.mensagem}
                    </p>
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowTrackingInfoModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
      {showValueModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
          >
            <h2 className="text-xl font-black uppercase italic tracking-tighter mb-6">Inserir Valor (R$)</h2>
            <input 
              type="number"
              value={pixAmount}
              onChange={e => setPixAmount(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl mb-6 font-bold text-lg"
              placeholder="0,00"
            />
            <div className="flex gap-4">
              <button onClick={() => setShowValueModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Cancelar</button>
              <button onClick={() => {
                setShowValueModal(false);
                handleGeneratePix();
              }} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">OK</button>
            </div>
          </motion.div>
        </div>
      )}
      {showPixModal && pixData && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black uppercase italic tracking-tighter">PIX Gerado!</h2>
              </div>
              <button onClick={() => setShowPixModal(false)} className="hover:rotate-90 transition-transform">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <p className="text-emerald-700 font-medium text-center">Escaneie o QR Code ou copie o código abaixo.</p>
              <div className="bg-white p-4 rounded-3xl shadow-inner flex flex-col items-center justify-center aspect-square overflow-hidden relative border border-slate-100 max-w-[200px] mx-auto">
                {pixData.qrcode_img ? (
                  <img 
                    src={pixData.qrcode_img} 
                    alt="QR Code PIX" 
                    className="w-full h-full object-contain z-10 bg-white"
                    referrerPolicy="no-referrer"
                    id="pix-qr-img"
                  />
                ) : (
                  <div id="pix-qr-svg">
                    <QRCodeSVG 
                      value={pixData.copia_cola || pixData.copia_e_cola || pixData.pix_code || ''} 
                      size={150} 
                    />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Código Copia e Cola</p>
                <div className="flex gap-2">
                  <input 
                    readOnly 
                    value={pixData.copia_cola || pixData.copia_e_cola || pixData.pix_code || ''} 
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs"
                  />
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(pixData.copia_cola || pixData.copia_e_cola || pixData.pix_code);
                      toast.success('Código copiado!');
                    }}
                    className="px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                  >
                    Copiar
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowPixModal(false)}
                className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
              >
                Voltar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

