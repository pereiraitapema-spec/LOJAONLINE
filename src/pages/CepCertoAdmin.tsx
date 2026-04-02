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
  const hasFetched = React.useRef(false);
  
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
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [senderData, setSenderData] = useState<any>({
    nome: '',
    cep: '',
    cidade: '',
    estado: '',
    endereco: '',
    numero: '',
    complemento: ''
  });
  const [recipientQuoteData, setRecipientQuoteData] = useState<any>({
    cep: '',
    peso: '',
    altura: '',
    largura: '',
    comprimento: '',
    valor_encomenda: ''
  });
  const [quoteResult, setQuoteResult] = useState<any>(null);
  const [calculatingQuote, setCalculatingQuote] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cepcerto_sender_data');
    if (saved) {
      setSenderData(JSON.parse(saved));
    }
  }, []);

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
        
        if (!hasFetched.current) {
          hasFetched.current = true;
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

  const handleSaveSender = () => {
    if (!senderData.cep || senderData.cep.length !== 8) {
      toast.error('CEP do Remetente é obrigatório e deve ter 8 dígitos.');
      return;
    }
    localStorage.setItem('cepcerto_sender_data', JSON.stringify(senderData));
    toast.success('Dados do remetente salvos com sucesso!');
  };

  const handleCalculateQuote = async () => {
    // LOG 1 — DADOS RECEBIDOS DO FORMULÁRIO
    console.log("CEP CERTO - Dados formulário", {
      cep_remetente: senderData.cep,
      cep_destinatario: recipientQuoteData.cep,
      peso_gramas: recipientQuoteData.peso,
      altura: recipientQuoteData.altura,
      largura: recipientQuoteData.largura,
      comprimento: recipientQuoteData.comprimento,
      valor_encomenda: recipientQuoteData.valor_encomenda
    });

    // LOG 2 — VALIDAÇÃO CAMPOS
    if (!senderData.cep || !recipientQuoteData.cep || !recipientQuoteData.peso || 
        !recipientQuoteData.altura || !recipientQuoteData.largura || 
        !recipientQuoteData.comprimento || !recipientQuoteData.valor_encomenda) {
      
      console.error("CEP CERTO - Campo faltando", {
        cep_remetente: senderData.cep,
        cep_destinatario: recipientQuoteData.cep,
        peso_gramas: recipientQuoteData.peso,
        altura: recipientQuoteData.altura,
        largura: recipientQuoteData.largura,
        comprimento: recipientQuoteData.comprimento,
        valor_encomenda: recipientQuoteData.valor_encomenda
      });
      toast.error('Campo obrigatório não preenchido');
      return;
    }

    if (senderData.cep.length !== 8) {
      toast.error('CEP do Remetente deve ter 8 dígitos.');
      return;
    }
    if (recipientQuoteData.cep.length !== 8) {
      toast.error('CEP do Destinatário deve ter 8 dígitos.');
      return;
    }

    // Formatação CEP
    const cep_remetente_formatado = senderData.cep.replace(/\D/g, '');
    const cep_destinatario_formatado = recipientQuoteData.cep.replace(/\D/g, '');
    console.log("CEP formatado", cep_remetente_formatado, cep_destinatario_formatado);

    // LOG 3 — CONVERSÃO PESO
    const pesoGramas = parseFloat(recipientQuoteData.peso);
    const pesoKg = pesoGramas / 1000;
    console.log("CEP CERTO - Peso convertido", {
      peso_gramas: pesoGramas,
      peso_kilo: pesoKg
    });

    // VALIDAÇÃO PESO
    if (isNaN(pesoKg) || pesoKg < 0.3 || pesoKg > 30) {
      console.log("Peso validado - ERRO", pesoKg);
      toast.error('Peso deve ser entre 300g e 30kg.');
      return;
    }
    console.log("Peso validado - OK", pesoKg);

    // VALIDAÇÃO DIMENSÕES
    const altura = parseFloat(recipientQuoteData.altura);
    const largura = parseFloat(recipientQuoteData.largura);
    const comprimento = parseFloat(recipientQuoteData.comprimento);
    console.log("Dimensões", {
      altura,
      largura,
      comprimento
    });

    if (isNaN(altura) || altura < 0.4 || altura > 100) {
      toast.error('Altura deve ser entre 0,4cm e 100cm.');
      return;
    }

    if (isNaN(largura) || largura < 11 || largura > 100) {
      toast.error('Largura deve ser entre 11cm e 100cm.');
      return;
    }

    if (isNaN(comprimento) || comprimento < 13 || comprimento > 100) {
      toast.error('Comprimento deve ser entre 13cm e 100cm.');
      return;
    }

    const valor = parseFloat(recipientQuoteData.valor_encomenda);
    if (isNaN(valor) || valor <= 0) {
      toast.error('Valor da encomenda inválido.');
      return;
    }

    setCalculatingQuote(true);
    setQuoteResult(null);

    try {
      // LOG 4 — BUSCAR TOKEN
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('api_key, config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .limit(1);

      if (!carriers || carriers.length === 0) {
        console.error("CEP CERTO - Token não encontrado");
        toast.error('Configuração CEP CERTO não encontrada');
        return;
      }

      const carrierData = carriers[0];
      let apiKey = carrierData.api_key;
      if (!apiKey && carrierData.config) {
        const config = typeof carrierData.config === 'string' ? JSON.parse(carrierData.config) : carrierData.config;
        apiKey = config.api_key_postagem || config.api_key;
      }

      if (!apiKey) {
        console.error("CEP CERTO - Token não encontrado");
        toast.error('Configuração CEP CERTO não encontrada');
        return;
      }
      console.log("CEP CERTO - Token encontrado", apiKey);

      // LOG 5 — BODY COMPLETO API
      const body = {
        token_cliente_postagem: apiKey,
        cep_remetente: cep_remetente_formatado,
        cep_destinatario: cep_destinatario_formatado,
        peso: pesoKg.toString(),
        altura: altura.toString(),
        largura: largura.toString(),
        comprimento: comprimento.toString(),
        valor_encomenda: valor.toString()
      };
      console.log("CEP CERTO - Body enviado API", body);

      // 2. Fazer POST
      const response = await fetch('https://cepcerto.com/api-cotacao/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // LOG 6 — RESPOSTA API
      console.log("CEP CERTO - Resposta API", response);

      if (response.ok) {
        const data = await response.json();
        // LOG 7 — STATUS API
        console.log("CEP CERTO - Dados da Resposta", data);
        
        if (data.status === 'sucesso') {
          setQuoteResult(data);
          toast.success('Cotação realizada com sucesso!');
        } else {
          console.error("CEP CERTO - Status inválido", data);
          toast.error(`Erro ao calcular frete. Motivo: ${data.mensagem || 'Erro API CEP CERTO'}`);
        }
      } else {
        console.error("CEP CERTO - Erro na requisição (HTTP Error)");
        toast.error('Erro ao calcular frete. Motivo: Erro API CEP CERTO');
      }
    } catch (error) {
      console.error("CEP CERTO - Erro API", error);
      toast.error(`Erro ao calcular frete. Motivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setCalculatingQuote(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!carrier) return;
    setRefreshingBalance(true);
    try {
      const balanceData = await shippingService.getBalance();
      setBalance(balanceData);
      setLastFetched(Date.now());
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
      
      // 1. SELECT api_key FROM public.shipping_carriers
      const { data: carriers, error: carrierError } = await supabase
        .from('shipping_carriers')
        .select('api_key, config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .limit(1);

      if (carrierError || !carriers || carriers.length === 0) {
        console.error('Erro ao buscar api_key:', carrierError);
        setBalance({ error: "Não foi possível consultar saldo" });
        return;
      }

      const carrierData = carriers[0];
      // Tenta pegar a api_key direta ou de dentro do config se for JSON
      let apiKey = carrierData.api_key;
      
      if (!apiKey && carrierData.config) {
        try {
          const config = typeof carrierData.config === 'string' ? JSON.parse(carrierData.config) : carrierData.config;
          apiKey = config.api_key_postagem || config.api_key;
        } catch (e) {}
      }

      if (!apiKey) {
        setBalance({ error: "Não foi possível consultar saldo" });
        return;
      }

      setCarrier(carrierData);
      
      // 2. POST https://cepcerto.com/api-saldo/
      try {
        const response = await fetch('https://cepcerto.com/api-saldo/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_cliente_postagem: apiKey })
        });

        if (response.ok) {
          const data = await response.json();
          // 3. Tratar resposta e 4. Exibir no Modal
          if (data && (data.saldo || data.saldo_atual)) {
            setBalance({ saldo: data.saldo || data.saldo_atual });
            setLastFetched(Date.now());
          } else {
            setBalance({ error: "Não foi possível consultar saldo" });
          }
        } else {
          setBalance({ error: "Não foi possível consultar saldo" });
        }
      } catch (e) {
        console.error('Erro na requisição POST:', e);
        setBalance({ error: "Não foi possível consultar saldo" });
      }
      
      // Busca de pedidos recentes (opcional, mantendo para não quebrar a UI)
      const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .or('shipping_method.ilike.sedex,shipping_method.ilike.pac,shipping_method.ilike.jadlog')
        .order('created_at', { ascending: false })
        .limit(10);
      
      setRecentOrders(orders || []);

    } catch (error: any) {
      console.error('Error fetching CepCerto data:', error);
      setBalance({ error: "Não foi possível consultar saldo" });
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
        amount,
        'pereira.itapema@gmail.com', 
        '47999999999',
        currentCarrier.config
      );

      setPixData(data);
      setShowPixModal(true);
      toast.success('PIX gerado com sucesso!');
      const balanceData = await shippingService.getBalance();
      setBalance(balanceData);
      setLastFetched(Date.now());
    } catch (error: any) {
      console.error('Erro ao gerar PIX:', error);
      toast.error('Erro ao gerar PIX: ' + error.message);
    } finally {
      setIsGeneratingPix(false);
    }
  };

  const handleGenerateManualLabel = async () => {
    if (!carrier || !carrier.config) {
      toast.error('Configurações da transportadora não carregadas.');
      return;
    }
    try {
      toast.loading('Gerando etiqueta manual...', { id: 'gen-label-manual' });
      
      const payload = {
        ...manualLabelData,
        token_cliente_postagem: carrier.config.api_key_postagem || carrier.config.api_key
      };
      
      const result = await shippingService.generateLabel('manual', carrier.config, payload);
      
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
    
    // Converte gramas para kg se o valor for maior que 30 (assumindo que valores > 30 são gramas)
    let pesoNum = parseFloat(quoteData.peso);
    if (pesoNum > 30) {
      pesoNum = pesoNum / 1000;
    }
    
    const altNum = parseFloat(quoteData.altura);
    const largNum = parseFloat(quoteData.largura);
    const compNum = parseFloat(quoteData.comprimento);

    if (pesoNum < 0.3 || pesoNum > 30) {
      toast.error(`Peso inválido (${pesoNum}kg). Deve ser entre 0.3kg e 30kg.`);
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
        carrier.config || {}
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
      const result = await shippingService.cancelLabel(trackingCode, carrier.config || {});
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
      const result = await shippingService.consultPostage(trackingCode, carrier.config || {});
      
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
      const result = await shippingService.getFinancialStatement(carrier.config || {});
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
      const result = await shippingService.getTrackingInfo(trackingCode, carrier.config || {});
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
              onClick={() => {
                console.log('Botão Atualizar clicado!');
                fetchData();
              }}
              className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              Atualizar
            </button>
          </div>
          
          {/* Card de Saldo e Recarga */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center justify-between">
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

            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
              <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Adicionar Crédito (PIX)</p>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  value={pixAmount} 
                  onChange={e => setPixAmount(e.target.value)}
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                  placeholder="Valor (R$)"
                />
                <button 
                  onClick={handleGeneratePix}
                  disabled={isGeneratingPix}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 text-sm flex items-center gap-2"
                >
                  <QrCode size={18} />
                  {isGeneratingPix ? 'Gerando...' : 'Gerar PIX'}
                </button>
              </div>
            </div>
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
            <div className="bg-white p-12 rounded-3xl shadow-sm border border-slate-200 text-center">
              <Calculator size={64} className="mx-auto mb-6 text-indigo-600 opacity-20" />
              <h3 className="text-2xl font-black text-slate-900 mb-4 uppercase italic tracking-tighter">Cotação de Frete</h3>
              <p className="text-slate-500 mb-8 max-w-md mx-auto">Realize cotações rápidas com remetente fixo e destinatário variável para todos os serviços CepCerto.</p>
              <button 
                onClick={() => setShowQuoteModal(true)}
                className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 mx-auto"
              >
                <Calculator size={20} />
                Nova Cotação
              </button>
            </div>
          )}
          {/* Modal Cotação */}
          {showQuoteModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] w-full max-w-4xl shadow-2xl p-8 my-8"
              >
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Nova Cotação de Frete</h2>
                  <button onClick={() => setShowQuoteModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  {/* Seção 1 - Remetente */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <MapPin size={20} className="text-indigo-600" />
                      <h3 className="font-bold text-slate-900 uppercase text-sm tracking-wider">Cadastro Remetente</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Remetente</label>
                        <input 
                          type="text" 
                          value={senderData.nome} 
                          onChange={e => setSenderData({...senderData, nome: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="Nome da Empresa/Pessoa"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CEP Remetente *</label>
                          <input 
                            type="text" 
                            value={senderData.cep} 
                            onChange={e => setSenderData({...senderData, cep: e.target.value.replace(/\D/g, '').slice(0, 8)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="00000000"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
                          <input 
                            type="text" 
                            value={senderData.cidade} 
                            onChange={e => setSenderData({...senderData, cidade: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Endereço</label>
                          <input 
                            type="text" 
                            value={senderData.endereco} 
                            onChange={e => setSenderData({...senderData, endereco: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Número</label>
                          <input 
                            type="text" 
                            value={senderData.numero} 
                            onChange={e => setSenderData({...senderData, numero: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estado</label>
                          <input 
                            type="text" 
                            value={senderData.estado} 
                            onChange={e => setSenderData({...senderData, estado: e.target.value.toUpperCase().slice(0, 2)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="UF"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Complemento</label>
                          <input 
                            type="text" 
                            value={senderData.complemento} 
                            onChange={e => setSenderData({...senderData, complemento: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={handleSaveSender}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all text-sm flex items-center justify-center gap-2"
                    >
                      <Check size={18} />
                      Salvar Remetente
                    </button>
                  </div>

                  {/* Seção 2 - Destinatário */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                      <Truck size={20} className="text-indigo-600" />
                      <h3 className="font-bold text-slate-900 uppercase text-sm tracking-wider">Dados Destinatário</h3>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CEP Destinatário *</label>
                          <input 
                            type="text" 
                            value={recipientQuoteData.cep} 
                            onChange={e => setRecipientQuoteData({...recipientQuoteData, cep: e.target.value.replace(/\D/g, '').slice(0, 8)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="00000000"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Peso (gramas) *</label>
                          <input 
                            type="number" 
                            value={recipientQuoteData.peso} 
                            onChange={e => setRecipientQuoteData({...recipientQuoteData, peso: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="Ex: 500"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Altura (cm)</label>
                          <input 
                            type="number" 
                            value={recipientQuoteData.altura} 
                            onChange={e => setRecipientQuoteData({...recipientQuoteData, altura: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Largura (cm)</label>
                          <input 
                            type="number" 
                            value={recipientQuoteData.largura} 
                            onChange={e => setRecipientQuoteData({...recipientQuoteData, largura: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Comprimento (cm)</label>
                          <input 
                            type="number" 
                            value={recipientQuoteData.comprimento} 
                            onChange={e => setRecipientQuoteData({...recipientQuoteData, comprimento: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Valor da Encomenda (R$)</label>
                        <input 
                          type="number" 
                          value={recipientQuoteData.valor_encomenda} 
                          onChange={e => setRecipientQuoteData({...recipientQuoteData, valor_encomenda: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="Ex: 50"
                        />
                      </div>
                    </div>

                    <button 
                      onClick={handleCalculateQuote}
                      disabled={calculatingQuote}
                      className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
                    >
                      {calculatingQuote ? <RefreshCw size={20} className="animate-spin" /> : <Calculator size={20} />}
                      Calcular Frete
                    </button>
                  </div>
                </div>

                {/* Resultado da Cotação */}
                {quoteResult && (
                  <div className="mt-12 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h3 className="text-lg font-black text-slate-900 mb-6 uppercase italic tracking-tighter flex items-center gap-2">
                      <Activity size={20} className="text-indigo-600" />
                      Resultado da Cotação
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {quoteResult.frete?.valor_pac && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">PAC</p>
                          <p className="text-lg font-black text-indigo-600">R$ {quoteResult.frete.valor_pac}</p>
                          <p className="text-xs text-slate-500">Prazo: {quoteResult.frete.prazo_pac}</p>
                        </div>
                      )}
                      {quoteResult.frete?.valor_sedex && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">SEDEX</p>
                          <p className="text-lg font-black text-indigo-600">R$ {quoteResult.frete.valor_sedex}</p>
                          <p className="text-xs text-slate-500">Prazo: {quoteResult.frete.prazo_sedex}</p>
                        </div>
                      )}
                      {quoteResult.frete?.valor_jadlog_package && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">JADLOG PACKAGE</p>
                          <p className="text-lg font-black text-indigo-600">R$ {quoteResult.frete.valor_jadlog_package}</p>
                          <p className="text-xs text-slate-500">Prazo: {quoteResult.frete.prazo_jadlog_package}</p>
                        </div>
                      )}
                      {quoteResult.frete?.valor_jadlog_dotcom && (
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">JADLOG DOTCOM</p>
                          <p className="text-lg font-black text-indigo-600">R$ {quoteResult.frete.valor_jadlog_dotcom}</p>
                          <p className="text-xs text-slate-500">Prazo: {quoteResult.frete.prazo_jadlog_dotcom}</p>
                        </div>
                      )}
                    </div>

                    {quoteResult.alertas && quoteResult.alertas.length > 0 && (
                      <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                          <AlertCircle size={16} />
                          Atenção:
                        </div>
                        <ul className="space-y-1">
                          {quoteResult.alertas.map((alerta: string, idx: number) => (
                            <li key={idx} className="text-xs text-amber-600 flex items-center gap-2">
                              <div className="w-1 h-1 bg-amber-400 rounded-full" />
                              {alerta}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-8 flex gap-4">
                  <button 
                    onClick={() => {
                      setRecipientQuoteData({
                        cep: '',
                        peso: '',
                        altura: '',
                        largura: '',
                        comprimento: '',
                        valor_encomenda: ''
                      });
                      setQuoteResult(null);
                    }}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={20} />
                    Nova Cotação
                  </button>
                  <button 
                    onClick={() => setShowQuoteModal(false)}
                    className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal PIX */}
          {showPixModal && pixData && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl p-8 text-center"
              >
                <h2 className="text-2xl font-black text-slate-900 mb-6 uppercase italic tracking-tighter">PIX Gerado</h2>
                <div className="bg-slate-50 p-4 rounded-2xl mb-6 flex justify-center">
                  <QRCodeSVG value={pixData.copia_cola} size={200} />
                </div>
                <p className="text-sm text-slate-500 mb-6">Escaneie o QR Code ou copie o código abaixo:</p>
                <div className="bg-slate-100 p-4 rounded-xl text-xs font-mono text-slate-700 break-all mb-6">
                  {pixData.copia_cola}
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(pixData.copia_cola);
                      toast.success('Código copiado!');
                    }}
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                  >
                    Copiar Código
                  </button>
                  <button 
                    onClick={() => setShowPixModal(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
