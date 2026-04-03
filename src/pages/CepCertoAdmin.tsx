import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { 
  Shield, LayoutDashboard, Settings, Package, Image as ImageIcon, 
  ShoppingBag, Megaphone, Users, Truck, CreditCard, Zap,
  Search, ChevronRight, Check, Copy, RefreshCw, X, AlertCircle, Wallet, QrCode, Trash2, Printer,
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
    nome_remetente: '',
    cpf_cnpj_remetente: '',
    whatsapp_remetente: '',
    email_remetente: '',
    cep_remetente: '',
    cidade_remetente: '',
    estado_remetente: '',
    logradouro_remetente: '',
    numero_remetente: '',
    complemento_remetente: '',
    bairro_remetente: ''
  });
  const [recipientQuoteData, setRecipientQuoteData] = useState<any>({
    cep: '',
    peso: '',
    altura: '',
    largura: '',
    comprimento: '',
    valor_encomenda: ''
  });
  const [freteResultado, setFreteResultado] = useState<any>(null);
  const [freteSelecionado, setFreteSelecionado] = useState<any>(null);
  const [showLabelConfirmModal, setShowLabelConfirmModal] = useState(false);
  const [calculatingQuote, setCalculatingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [postagemData, setPostagemData] = useState<any>({
    tipo_entrega: 'sedex',
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
    numero_endereco_remetente: '',
    complemento_remetente: '',
    bairro_remetente: '',
    cidade_remetente: '',
    estado_remetente: '',
    nome_destinatario: '',
    cpf_cnpj_destinatario: '',
    whatsapp_destinatario: '',
    email_destinatario: '',
    logradouro_destinatario: '',
    numero_endereco_destinatario: '',
    complemento_destinatario: '',
    bairro_destinatario: '',
    cidade_destinatario: '',
    estado_destinatario: '',
    tipo_doc_fiscal: 'declaracao',
    chave_danfe: '',
    produtos: [{ descricao: 'Pacote', valor: '', quantidade: '1' }]
  });
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [labelResult, setLabelResult] = useState<any>(null);
  const [showLabelResultModal, setShowLabelResultModal] = useState(false);
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<any[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [printType, setPrintType] = useState<'etiqueta' | 'declaracao' | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cepcerto_remetente_padrao');
    if (saved) {
      const data = JSON.parse(saved);
      setSenderData(data);
      // Preencher dados do remetente na postagem
      setPostagemData((prev: any) => ({
        ...prev,
        nome_remetente: data.nome_remetente || '',
        cpf_cnpj_remetente: data.cpf_cnpj_remetente || '',
        whatsapp_remetente: data.whatsapp_remetente || '',
        email_remetente: data.email_remetente || '',
        cep_remetente: data.cep_remetente || '',
        cidade_remetente: data.cidade_remetente || '',
        estado_remetente: data.estado_remetente || '',
        logradouro_remetente: data.logradouro_remetente || '',
        numero_endereco_remetente: data.numero_remetente || '',
        complemento_remetente: data.complemento_remetente || '',
        bairro_remetente: data.bairro_remetente || ''
      }));
    }
  }, []);

  useEffect(() => {
    if (logisticaSubTab === 'etiquetas') {
      const savedQuote = localStorage.getItem('cepcerto_dados_etiqueta');
      if (savedQuote) {
        const data = JSON.parse(savedQuote);
        setPostagemData((prev: any) => ({
          ...prev,
          tipo_entrega: data.frete_tipo?.toLowerCase().replace(' ', '-') || 'sedex',
          cep_remetente: data.cep_remetente || prev.cep_remetente,
          cep_destinatario: data.cep_destinatario || prev.cep_destinatario,
          peso: data.peso || prev.peso,
          altura: data.altura || prev.altura,
          largura: data.largura || prev.largura,
          comprimento: data.comprimento || prev.comprimento,
          valor_encomenda: data.valor_encomenda || prev.valor_encomenda,
          produtos: [{ descricao: 'Pacote', valor: data.valor_encomenda || '', quantidade: '1' }]
        }));
      }

      const savedLabels = localStorage.getItem('cepcerto_etiquetas_geradas');
      if (savedLabels) {
        setEtiquetasGeradas(JSON.parse(savedLabels));
      }
    }
  }, [logisticaSubTab]);

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

  useEffect(() => {
    const savedQuotes = localStorage.getItem('cepcerto_cotacoes');
    if (savedQuotes) {
      setAvailableQuotes(JSON.parse(savedQuotes));
    }
    
    const savedSelected = localStorage.getItem('cepcerto_cotacao_selecionada');
    if (savedSelected) {
      setFreteSelecionado(JSON.parse(savedSelected));
    }

    const savedHistory = localStorage.getItem('cepcerto_etiquetas_geradas');
    if (savedHistory) {
      setEtiquetasGeradas(JSON.parse(savedHistory));
    }
  }, []);

  const [cotacaoGerada, setCotacaoGerada] = useState(false);
  const [cotacaoExecutada, setCotacaoExecutada] = useState(false);
  const [calculatingAutoQuote, setCalculatingAutoQuote] = useState(false);
  const [availableQuotes, setAvailableQuotes] = useState([]);

  // Funções auxiliares de formatação e validação
  function converterPesoGramas(peso: number) {
    if (peso < 1) {
      return peso * 1000;
    }
    return peso;
  }

  async function buscarCEPAPI(cep: string) {
    try {
      console.log("Chamando API CEP");
      const response = await fetch(`/api/cep/${cep}`);
      const data = await response.json();
      console.log("Resposta CEP:", data);
      if (!data || data.erro) {
        console.error("CEP não encontrado");
        toast.error("CEP não consta na base de dados");
        return;
      }
      console.log("CEP válido");
      // Preencher endereço (assumindo que existe uma lógica para isso)
      // preencherEndereco(data); 
    } catch (error) {
      console.error("Erro consulta CEP");
      console.error(error);
    }
  }

  function validarCEPOnline(cep: string) {
    cep = cep.replace(/\D/g, '');
    if (cep.length !== 8) {
      console.log("CEP incompleto");
      return;
    }
    console.log("Consultando CEP online");
    buscarCEPAPI(cep);
  }

  const formatarCEP = (cep: string) => {
    cep = cep.replace(/\D/g, '');
    if (cep.length > 8) cep = cep.slice(0, 8);
    if (cep.length === 8) cep = cep.replace(/^(\d{5})(\d{3})$/, '$1-$2');
    return cep;
  };

  const validarCEP = (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) {
      console.error("CEP inválido");
      toast.error("CEP inválido");
      return false;
    }
    return true;
  };

  function formatarWhatsapp(numero: string) {
    numero = numero.replace(/\D/g, '');
    if (numero.length > 11) {
      numero = numero.slice(0, 11);
    }
    numero = numero.replace(/^(\d{2})(\d)/g, "($1) $2");
    numero = numero.replace(/(\d)(\d{4})$/, "$1-$2");
    return numero;
  }

  function validarWhatsapp(numero: string) {
    const limpo = numero.replace(/\D/g, '');
    if (limpo.length !== 11) {
      console.error("WhatsApp inválido");
      toast.error("WhatsApp inválido");
      return false;
    }
    return true;
  }

  const formatarCPF = (cpf: string) => {
    cpf = cpf.replace(/\D/g, '');
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2");
    cpf = cpf.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
    return cpf;
  };

  const formatarCNPJ = (cnpj: string) => {
    cnpj = cnpj.replace(/\D/g, '');
    cnpj = cnpj.replace(/^(\d{2})(\d)/, "$1.$2");
    cnpj = cnpj.replace(/^(\d{2}).(\d{3})(\d)/, "$1.$2.$3");
    cnpj = cnpj.replace(/.(\d{3})(\d)/, ".$1/$2");
    cnpj = cnpj.replace(/(\d{4})(\d)/, "$1-$2");
    return cnpj;
  };

  // Função para mostrar cotações
  const mostrarCotacoes = (cotacao: any) => {
    console.log("Renderizando opções cotação");
    const container = document.getElementById("cotacao-opcoes");
    if (!container) {
      console.error("Container cotação não encontrado");
      return;
    }
    container.innerHTML = "";
    container.innerHTML += `
      <div class="frete-opcao p-4 border border-slate-200 rounded-xl mb-2">
        <input type="radio" name="frete" value="sedex" class="mr-2">
        Sedex — ${cotacao.valor_sedex} — ${cotacao.prazo_entrega_sedex}
      </div>
    `;
    container.innerHTML += `
      <div class="frete-opcao p-4 border border-slate-200 rounded-xl mb-2">
        <input type="radio" name="frete" value="pac" class="mr-2">
        PAC — ${cotacao.valor_pac} — ${cotacao.prazo_entrega_pac}
      </div>
    `;
  };

  async function calcularCotacaoOnline() {
    console.log("========== VALIDAÇÃO ==========");
    const { 
      cep_destinatario, 
      peso, 
      produtos 
    } = postagemData;
    const whatsapp = postagemData.whatsapp_destinatario || '';

    console.log("CEP:", cep_destinatario);
    console.log("WhatsApp:", whatsapp);
    console.log("Produtos:", produtos);
    console.log("Peso:", peso);
    console.log("Chamando cálculo");

    // Validação
    if (
      !validarCEP(cep_destinatario) ||
      !validarWhatsapp(whatsapp) ||
      !produtos || produtos.length === 0
    ) {
      console.log("Dados inválidos — cancelando cálculo");
      console.log("========== FIM VALIDAÇÃO ==========");
      return;
    }

    console.log("========== FIM VALIDAÇÃO ==========");
    
    if (cotacaoExecutada) {
      console.log("Cotação já executada, ignorando.");
      return;
    }
    
    console.log("========== INÍCIO CÁLCULO FRETE ==========");
    
    setCalculatingAutoQuote(true);
    
    try {
      // Conversão de peso
      const pesoGramas = parseFloat(peso) || 0;
      const pesoFinal = converterPesoGramas(pesoGramas);
      console.log("Peso produto (gramas):", pesoFinal);

      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('api_key, config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .limit(1);

      if (!carriers || carriers.length === 0) {
        console.error("Nenhuma transportadora ativa encontrada");
        return;
      }

      const carrierData = carriers[0];
      let apiKey = carrierData.api_key;
      if (!apiKey && carrierData.config) {
        const config = typeof carrierData.config === 'string' ? JSON.parse(carrierData.config) : carrierData.config;
        apiKey = config.api_key_postagem || config.api_key;
      }

      if (!apiKey) {
        console.error("API Key não encontrada");
        return;
      }

      const valorTotal = produtos.reduce((acc: number, prod: any) => acc + (parseFloat(prod.valor) || 0) * (parseInt(prod.quantidade) || 1), 0);

      const body = {
        token_cliente_postagem: apiKey,
        cep_remetente: senderData.cep_remetente,
        cep_destinatario: cep_destinatario.replace(/\D/g, ''),
        peso: (pesoFinal / 1000).toString(), // API espera KG
        altura: postagemData.altura || "2",
        largura: postagemData.largura || "11",
        comprimento: postagemData.comprimento || "16",
        valor_encomenda: valorTotal.toString()
      };

      const response = await fetch('/api/cepcerto/cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log("========== RESPOSTA API ==========");
      console.log(response);

      if (response.ok) {
        const data = await response.json();
        console.log("========== FINAL COTAÇÃO ==========");
        console.log("Produtos:", produtos);
        console.log("Cotação:", data);
        
        if (data.dados_frete) {
          const cotacao = {
            valor_pac: data.dados_frete.find((q: any) => q.tipo === 'PAC')?.valor || 'N/A',
            prazo_entrega_pac: data.dados_frete.find((q: any) => q.tipo === 'PAC')?.prazo || 'N/A',
            valor_sedex: data.dados_frete.find((q: any) => q.tipo === 'SEDEX')?.valor || 'N/A',
            prazo_entrega_sedex: data.dados_frete.find((q: any) => q.tipo === 'SEDEX')?.prazo || 'N/A',
          };
          mostrarCotacao(cotacao);
          setCotacaoExecutada(true);
        }
      } else {
        console.error("Erro na resposta da API");
      }

    } catch (error) {
      console.error("Erro no cálculo de frete");
      console.error(error);
    } finally {
      setCalculatingAutoQuote(false);
    }
  }

  function mostrarCotacao(response: any) {
    console.log("Renderizando cotação");
    const container = document.getElementById("cotacao-gerar-etiqueta");
    if (container) {
      container.innerHTML = `
        <div>
          <input type="radio" name="frete" value="sedex">
          Sedex — ${response.valor_sedex} — ${response.prazo_entrega_sedex}
        </div>
        <div>
          <input type="radio" name="frete" value="pac">
          PAC — ${response.valor_pac} — ${response.prazo_entrega_pac}
        </div>
      `;
      console.log("Cotação exibida na tela");
    }
  }

  function verificarDestinatarioCompleto() {
    console.log("Verificando destinatário");
    if (
      postagemData.nome_destinatario &&
      postagemData.cep_destinatario &&
      postagemData.logradouro_destinatario &&
      postagemData.numero_endereco_destinatario &&
      postagemData.bairro_destinatario &&
      postagemData.cidade_destinatario &&
      postagemData.estado_destinatario
    ) {
      if (!cotacaoExecutada) {
        console.log("Destinatário completo detectado — Gerando cotação");
        calcularCotacaoOnline();
      }
    } else {
      // Reseta se campos forem limpos
      setCotacaoExecutada(false);
    }
  }

  // Ajuste no handleDestinatarioChange para incluir formatação e logs
  const handleDestinatarioChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cep_destinatario') {
      formattedValue = formatarCEP(value);
      if (formattedValue.length === 9) {
        console.log("CEP validado:", formattedValue);
        validarCEPOnline(formattedValue);
      }
    }
    
    if (field === 'whatsapp_destinatario') {
      formattedValue = formatarWhatsapp(value);
      console.log("Telefone formatado:", formattedValue);
    }

    if (field === 'cpf_cnpj_destinatario') {
      formattedValue = value.length > 14 ? formatarCNPJ(value) : formatarCPF(value);
    }

    setPostagemData(prev => ({ ...prev, [field]: formattedValue }));
    
    // Resetar cotação se campos críticos mudarem
    if (['cep_destinatario', 'produtos', 'cidade_destinatario'].includes(field)) {
      setCotacaoExecutada(false);
      console.log("Cotação resetada após alteração de campo crítico");
    }
    
    verificarDestinatarioCompleto();
  };

  // Monitoramento contínuo para cotação automática
  useEffect(() => {
    // Monitoramento contínuo removido conforme solicitado
  }, []);


  const handleSaveSender = () => {
    if (!senderData.cep_remetente || senderData.cep_remetente.length !== 8) {
      toast.error('CEP do Remetente é obrigatório e deve ter 8 dígitos.');
      return;
    }
    localStorage.setItem('cepcerto_remetente_padrao', JSON.stringify(senderData));
    toast.success('Dados do remetente salvos com sucesso!');
  };

  const [showSelectQuoteModal, setShowSelectQuoteModal] = useState(false);
  const [selectedQuoteForConfirmation, setSelectedQuoteForConfirmation] = useState<any>(null);

  const limparNumero = (valor: any, campo: string) => {
    if (!valor) {
      console.error("CAMPO UNDEFINED:", campo);
      return "";
    }
    return valor.toString().replace(/\D/g, '');
  };

  const handleCalculateQuote = async () => {
    console.log("========== CEP CERTO - CALCULAR FRETE ==========");
    console.log("CEP CERTO - BOTÃO CALCULAR FRETE CLICADO");
    
    try {
      // PASSO 1 - REMETENTE
      console.log("PASSO 1 - REMETENTE");
      console.log({
        nome_remetente: senderData.nome_remetente,
        cpf_cnpj_remetente: senderData.cpf_cnpj_remetente,
        whatsapp_remetente: senderData.whatsapp_remetente,
        email_remetente: senderData.email_remetente
      });

      // PASSO 2 - DADOS COTAÇÃO
      console.log("PASSO 2 - DADOS COTAÇÃO");
      console.log({
        cep_remetente: senderData.cep_remetente,
        cep_destinatario: recipientQuoteData.cep,
        peso: recipientQuoteData.peso,
        altura: recipientQuoteData.altura,
        largura: recipientQuoteData.largura,
        comprimento: recipientQuoteData.comprimento,
        valor_encomenda: recipientQuoteData.valor_encomenda
      });

      // PASSO 3 - DESTINATÁRIO (Se houver no contexto de cotação, embora geralmente seja preenchido depois)
      console.log("PASSO 3 - DESTINATÁRIO");
      console.log({
        nome_destinatario: postagemData.nome_destinatario,
        cpf_cnpj_destinatario: postagemData.cpf_cnpj_destinatario,
        whatsapp_destinatario: postagemData.whatsapp_destinatario,
        email_destinatario: postagemData.email_destinatario
      });

      // LOG CAMPOS INDIVIDUAIS
      console.log("CEP REMETENTE:", senderData.cep_remetente);
      console.log("CEP DESTINATARIO:", recipientQuoteData.cep);
      console.log("PESO:", recipientQuoteData.peso);
      console.log("ALTURA:", recipientQuoteData.altura);
      console.log("LARGURA:", recipientQuoteData.largura);
      console.log("COMPRIMENTO:", recipientQuoteData.comprimento);

      // LOG 2 — VALIDAÇÃO CAMPOS
      console.log("PASSO 1 - VALIDAR CAMPOS (INTERNO)");
      if (!senderData.cep_remetente || !recipientQuoteData.cep || !recipientQuoteData.peso || 
          !recipientQuoteData.altura || !recipientQuoteData.largura || 
          !recipientQuoteData.comprimento || !recipientQuoteData.valor_encomenda) {
        
        if (!senderData.cep_remetente) console.error("CEP REMETENTE FALTANDO");
        if (!recipientQuoteData.cep) console.error("CEP DESTINATARIO FALTANDO");
        if (!recipientQuoteData.peso) console.error("PESO FALTANDO");
        if (!recipientQuoteData.altura) console.error("ALTURA FALTANDO");
        if (!recipientQuoteData.largura) console.error("LARGURA FALTANDO");
        if (!recipientQuoteData.comprimento) console.error("COMPRIMENTO FALTANDO");
        if (!recipientQuoteData.valor_encomenda) console.error("VALOR ENCOMENDA FALTANDO");

        console.error("CEP CERTO - Campo faltando", {
          cep_remetente: senderData.cep_remetente,
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

      if (senderData.cep_remetente.length !== 8) {
        toast.error('CEP do Remetente deve ter 8 dígitos.');
        return;
      }
      if (recipientQuoteData.cep.length !== 8) {
        toast.error('CEP do Destinatário deve ter 8 dígitos.');
        return;
      }

      console.log("PASSO 4 - INICIANDO CÁLCULO");

      // Formatação CEP usando limparNumero
      const cep_remetente_formatado = limparNumero(senderData.cep_remetente, "cep_remetente");
      const cep_destinatario_formatado = limparNumero(recipientQuoteData.cep, "cep_destinatario");
      
      console.log("PASSO 2 - DADOS COTAÇÃO FORMATADOS", {
        cep_remetente: cep_remetente_formatado,
        cep_destinatario: cep_destinatario_formatado,
        peso: recipientQuoteData.peso,
        altura: recipientQuoteData.altura,
        largura: recipientQuoteData.largura,
        comprimento: recipientQuoteData.comprimento
      });

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

      console.log("PASSO 6 - LOADING");
      setCalculatingQuote(true);
      setFreteResultado(null);
      setFreteSelecionado(null);
      setQuoteError(null);

      // LOG 4 — BUSCAR TOKEN
      console.log("PASSO 3 - BUSCANDO TOKEN");
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('api_key, config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .limit(1);

      if (!carriers || carriers.length === 0) {
        console.error("CEP CERTO - Token não encontrado");
        toast.error('Configuração CEP CERTO não encontrada');
        setCalculatingQuote(false);
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
        setCalculatingQuote(false);
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
      console.log("PASSO 4 - BODY COTAÇÃO", body);

      // 2. Fazer POST via Proxy
      console.log("PASSO 5 - ENVIANDO API COTAÇÃO");
      const response = await fetch('/api/cepcerto/cotacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // LOG 6 — RESPOSTA API
      console.log("PASSO 8 - RESPOSTA API", response);

      if (response.ok) {
        const data = await response.json();
        // LOG 7 — STATUS API
        console.log("CEP CERTO - Dados da Resposta", data);
        
        if (data.erro) {
          console.error("CEP CERTO - Erro API", data.erro);
          setQuoteError(data.erro);
          toast.error(`Erro na cotação: ${data.erro}`);
          setCalculatingQuote(false);
          return;
        }

        if (data.dados_frete) {
          console.log("CEP CERTO - Frete encontrado", data.dados_frete);
          setFreteResultado(data.dados_frete);
          
          // Salvar cotações no localStorage
          localStorage.setItem('cepcerto_cotacoes', JSON.stringify(data.dados_frete));
          setAvailableQuotes(data.dados_frete);
          
          toast.success('Cotação realizada com sucesso!');
        } else {
          console.error("CEP CERTO - Dados de frete não encontrados na resposta");
          toast.error('Erro ao calcular frete. Motivo: Resposta inválida da API');
        }
      } else {
        const errorText = await response.text();
        console.error("CEP CERTO - Erro na requisição (HTTP Error)", { status: response.status, error: errorText });
        toast.error('Erro ao calcular frete. Motivo: Erro API CEP CERTO');
      }
    } catch (error: any) {
      console.error("PASSO 7 - ERRO");
      console.error("CEP CERTO - ERRO COTAÇÃO");
      console.error(error);
      console.error("STACK", error.stack);
      toast.error(`Erro ao calcular frete. Motivo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setCalculatingQuote(false);
      console.log("========== FIM CALCULAR FRETE ==========");
    }
  };

  const handlePrepareLabel = () => {
    if (!freteSelecionado) {
      toast.error('Selecione um frete primeiro');
      return;
    }

    // VALIDAÇÃO OBRIGATÓRIA REMETENTE
    if (!senderData.nome_remetente) {
      toast.error('Nome do remetente é obrigatório');
      console.error("NOME REMETENTE FALTANDO");
      return;
    }
    if (!senderData.cpf_cnpj_remetente) {
      toast.error('CPF/CNPJ do remetente é obrigatório');
      console.error("CPF/CNPJ REMETENTE FALTANDO");
      return;
    }
    if (!senderData.whatsapp_remetente) {
      toast.error('WhatsApp do remetente é obrigatório');
      console.error("WHATSAPP REMETENTE FALTANDO");
      return;
    }
    if (!senderData.email_remetente) {
      toast.error('Email do remetente é obrigatório');
      console.error("EMAIL REMETENTE FALTANDO");
      return;
    }

    const pesoGramas = parseFloat(recipientQuoteData.peso);
    const pesoKg = pesoGramas / 1000;

    const dadosEtiqueta = {
      cep_remetente: senderData.cep_remetente,
      cep_destinatario: recipientQuoteData.cep,
      peso: pesoKg.toString(),
      altura: recipientQuoteData.altura,
      largura: recipientQuoteData.largura,
      comprimento: recipientQuoteData.comprimento,
      valor_encomenda: recipientQuoteData.valor_encomenda,
      frete_tipo: freteSelecionado.tipo,
      frete_valor: freteSelecionado.valor,
      frete_prazo: freteSelecionado.prazo
    };

    localStorage.setItem("cepcerto_dados_etiqueta", JSON.stringify(dadosEtiqueta));
    
    // Salvar cotação selecionada
    const selectedQuote = {
      tipo_entrega: freteSelecionado.tipo.toLowerCase().replace(' ', '-'),
      valor: freteSelecionado.valor,
      prazo: freteSelecionado.prazo,
      transportadora: freteSelecionado.tipo.toLowerCase().includes('jadlog') ? 'Jadlog' : 'Correios'
    };
    localStorage.setItem('cepcerto_cotacao_selecionada', JSON.stringify(selectedQuote));
    
    console.log("CEP CERTO - Dados etiqueta preparados", dadosEtiqueta);
    console.log("CEP CERTO - Cotação selecionada salva", selectedQuote);
    
    // Preencher postagemData com dados do remetente salvo
    setPostagemData((prev: any) => ({
      ...prev,
      tipo_entrega: freteSelecionado.tipo.toLowerCase().replace(' ', '-'),
      cep_remetente: senderData.cep_remetente,
      cep_destinatario: recipientQuoteData.cep,
      peso: pesoKg.toString(),
      altura: recipientQuoteData.altura,
      largura: recipientQuoteData.largura,
      comprimento: recipientQuoteData.comprimento,
      valor_encomenda: recipientQuoteData.valor_encomenda,
      nome_remetente: senderData.nome_remetente,
      cpf_cnpj_remetente: senderData.cpf_cnpj_remetente,
      whatsapp_remetente: senderData.whatsapp_remetente,
      email_remetente: senderData.email_remetente,
      logradouro_remetente: senderData.logradouro_remetente,
      numero_endereco_remetente: senderData.numero_remetente,
      complemento_remetente: senderData.complemento_remetente,
      bairro_remetente: senderData.bairro_remetente,
      cidade_remetente: senderData.cidade_remetente,
      estado_remetente: senderData.estado_remetente
    }));

    setLogisticaSubTab('etiquetas');
    setShowQuoteModal(false);
    toast.success('Dados transferidos para postagem!');
  };

  const gerarEtiqueta = async () => {
    // Validar cotação selecionada
    const savedQuote = localStorage.getItem('cepcerto_cotacao_selecionada');
    const cotacao_selecionada = freteSelecionado || (savedQuote ? JSON.parse(savedQuote) : null);

    console.log("========== GERAR ETIQUETA ==========");
    console.log("DESTINATÁRIO", {
      nome: postagemData.nome_destinatario,
      cpf_cnpj: postagemData.cpf_cnpj_destinatario,
      whatsapp: postagemData.whatsapp_destinatario,
      email: postagemData.email_destinatario,
      cep: postagemData.cep_destinatario,
      logradouro: postagemData.logradouro_destinatario,
      numero: postagemData.numero_endereco_destinatario,
      bairro: postagemData.bairro_destinatario,
      cidade: postagemData.cidade_destinatario,
      estado: postagemData.estado_destinatario
    });
    console.log("PRODUTOS", postagemData.produtos);
    console.log("COTAÇÕES RETORNADAS", availableQuotes);
    console.log("COTAÇÃO SELECIONADA", cotacao_selecionada);
    console.log("STATUS COTAÇÃO");
    console.log("Cotação automática executada");

    const tipo_entrega_final = postagemData.tipo_entrega || cotacao_selecionada?.tipo_entrega || cotacao_selecionada?.tipo?.toLowerCase().replace(' ', '-');

    if (!tipo_entrega_final) {
      console.error("CEP CERTO - Tipo entrega não definido");
      toast.error('Tipo de entrega não definido. Selecione a cotação novamente.');
      return;
    }

    setGeneratingLabel(true);
    console.log("CEP CERTO - Iniciando geração de etiqueta (Proxy)", postagemData);
    
    console.log("TIPO ENTREGA ENVIADO", tipo_entrega_final);
    console.log("VALOR FRETE", cotacao_selecionada?.valor || 'Não disponível');

    try {
      // PASSO 1 — LOG DADOS FRETE
      console.log("PASSO 1 - DADOS FRETE");
      console.log({
        tipo_entrega: postagemData.tipo_entrega,
        cep_remetente: postagemData.cep_remetente,
        cep_destinatario: postagemData.cep_destinatario,
        peso: postagemData.peso,
        altura: postagemData.altura,
        largura: postagemData.largura,
        comprimento: postagemData.comprimento,
        valor_encomenda: postagemData.valor_encomenda
      });

      // PASSO 2 — LOG REMETENTE
      console.log("PASSO 2 - REMETENTE");
      console.log({
        nome_remetente: postagemData.nome_remetente,
        cpf_cnpj_remetente: postagemData.cpf_cnpj_remetente,
        whatsapp_remetente: postagemData.whatsapp_remetente,
        email_remetente: postagemData.email_remetente,
        logradouro_remetente: postagemData.logradouro_remetente,
        bairro_remetente: postagemData.bairro_remetente,
        numero_endereco_remetente: postagemData.numero_endereco_remetente
      });

      // PASSO 3 — LOG DESTINATÁRIO
      console.log("PASSO 3 - DESTINATÁRIO");
      console.log({
        nome_destinatario: postagemData.nome_destinatario,
        cpf_cnpj_destinatario: postagemData.cpf_cnpj_destinatario,
        whatsapp_destinatario: postagemData.whatsapp_destinatario,
        email_destinatario: postagemData.email_destinatario,
        logradouro_destinatario: postagemData.logradouro_destinatario,
        bairro_destinatario: postagemData.bairro_destinatario,
        numero_endereco_destinatario: postagemData.numero_endereco_destinatario
      });

      // PASSO 4 — LOG PRODUTOS
      console.log("PASSO 4 - PRODUTOS");
      console.log(postagemData.produtos);

      // 1. Buscar Token
      const { data: carriers } = await supabase
        .from('shipping_carriers')
        .select('api_key, config')
        .eq('provider', 'cepcerto')
        .eq('active', true)
        .limit(1);

      if (!carriers || carriers.length === 0) {
        console.error("CEP CERTO - Token não encontrado");
        toast.error('Configuração CEP CERTO não encontrada');
        setGeneratingLabel(false);
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
        toast.error('Token de postagem não encontrado');
        setGeneratingLabel(false);
        return;
      }

      // 2. Montar Body
      const body = {
        token_cliente_postagem: apiKey,
        ...postagemData,
        tipo_entrega: tipo_entrega_final,
        // Garantir formatos e evitar undefined usando limparNumero
        nome_remetente: (postagemData.nome_remetente || '').trim(),
        cpf_cnpj_remetente: limparNumero(postagemData.cpf_cnpj_remetente, "cpf_cnpj_remetente"),
        whatsapp_remetente: limparNumero(postagemData.whatsapp_remetente, "whatsapp_remetente"),
        email_remetente: (postagemData.email_remetente || '').trim(),
        
        nome_destinatario: (postagemData.nome_destinatario || '').trim(),
        cpf_cnpj_destinatario: limparNumero(postagemData.cpf_cnpj_destinatario, "cpf_cnpj_destinatario"),
        whatsapp_destinatario: limparNumero(postagemData.whatsapp_destinatario, "whatsapp_destinatario"),
        email_destinatario: (postagemData.email_destinatario || '').trim() || "",
        
        cep_remetente: limparNumero(postagemData.cep_remetente, "cep_remetente"),
        cep_destinatario: limparNumero(postagemData.cep_destinatario, "cep_destinatario")
      };

      // PASSO 5 — LOG BODY COMPLETO
      console.log("PASSO 5 - BODY COMPLETO");
      console.log(JSON.stringify(body, null, 2));

      // 3. Enviar POST via Proxy
      console.log("PASSO 6 - ENVIANDO API CEP CERTO");
      const response = await fetch('/api/cepcerto/postagem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // PASSO 7 — LOG RESPOSTA COMPLETA
      console.log("PASSO 7 - RESPOSTA COMPLETA API");
      console.log(response);

      if (response.ok) {
        const data = await response.json();
        console.log("RESPONSE RAW");
        console.log(JSON.stringify(data, null, 2));
        console.log("DEBUG API");
        console.log(data?.debug);

        // PASSO 8 — LOG CAMPOS RETORNO
        console.log("PASSO 8 - CAMPOS RETORNO");
        console.log({
          status: data?.status,
          sucesso: data?.sucesso,
          mensagem: data?.mensagem,
          codigoObjeto: data?.frete?.codigoObjeto || data?.codigoObjeto,
          idRecibo: data?.frete?.idRecibo || data?.idRecibo,
          idStringCorreios: data?.frete?.idStringCorreios || data?.idStringCorreios,
          pdfUrlEtiqueta: data?.frete?.pdfUrlEtiqueta || data?.pdfUrlEtiqueta,
          declaracaoUrl: data?.frete?.declaracaoUrl || data?.pdfUrlDeclaracao
        });

        if (data.erro || (data.sucesso === false)) {
          console.error("CEP CERTO - API RETORNOU ERRO");
          console.error(data);
          toast.error(`Erro na postagem: ${data.erro || data.mensagem || 'Erro desconhecido'}`);
          return;
        }

        // Tentar encontrar o código do objeto em diferentes estruturas possíveis
        const codigoObjeto = data?.frete?.codigoObjeto || data?.codigoObjeto;

        if (codigoObjeto) {
          const result = {
            id: Date.now().toString(),
            data: new Date().toISOString(),
            codigoObjeto: codigoObjeto,
            idRecibo: data?.frete?.idRecibo || data?.idRecibo,
            idStringCorreios: data?.frete?.idStringCorreios || data?.idStringCorreios,
            pdfUrlEtiqueta: data?.frete?.pdfUrlEtiqueta || data?.pdfUrlEtiqueta,
            pdfUrlDeclaracao: data?.frete?.pdfUrlDeclaracao || data?.pdfUrlDeclaracao,
            transportadora: tipo_entrega_final.includes('jadlog') ? 'Jadlog' : 'Correios',
            tipo_entrega: tipo_entrega_final,
            valor: cotacao_selecionada?.valor || freteSelecionado?.valor || `R$ ${postagemData.valor_encomenda}`,
            prazo: cotacao_selecionada?.prazo || freteSelecionado?.prazo || '',
            status: 'Gerada',
            nome: postagemData.nome_destinatario,
            cidade: recipientQuoteData.cidade || postagemData.cidade_destinatario || '',
            estado: recipientQuoteData.estado || postagemData.estado_destinatario || '',
            email: postagemData.email_destinatario,
            cep: postagemData.cep_destinatario
          };

          setLabelResult(result);
          setShowLabelResultModal(true);
          setShowLabelConfirmModal(false);
          toast.success('Etiqueta gerada com sucesso!');

          // Salvar no histórico
          const novasEtiquetas = [result, ...etiquetasGeradas];
          setEtiquetasGeradas(novasEtiquetas);
          localStorage.setItem('cepcerto_etiquetas_geradas', JSON.stringify(novasEtiquetas));
          localStorage.setItem('cepcerto_etiqueta_gerada', JSON.stringify(result));
        } else {
          console.error("CEP CERTO - Resposta sem código de objeto");
          console.error("Resposta completa:", data);
          console.error("Mensagem API:", data?.mensagem);
          toast.error('Erro ao gerar etiqueta: Resposta inválida da API (Sem código de objeto)');
          return; // NÃO PROSSEGUIR
        }
      } else {
        const errorText = await response.text();
        console.error("CEP CERTO - Erro na requisição (HTTP Error)", { status: response.status, error: errorText });
        toast.error('Erro ao conectar com a API de postagem');
      }
    } catch (error) {
      console.error("CEP CERTO - Erro ao gerar etiqueta", error);
      toast.error('Erro inesperado ao gerar etiqueta');
    } finally {
      setGeneratingLabel(false);
      setShowLabelConfirmModal(false);
      console.log("========== FIM GERAR ETIQUETA ==========");
    }
  };

  const handleSelectQuote = (quote: any) => {
    const selectedQuote = {
      tipo_entrega: quote.tipo.toLowerCase().replace(' ', '-'),
      valor: quote.valor,
      prazo: quote.prazo,
      transportadora: quote.tipo.toLowerCase().includes('jadlog') ? 'Jadlog' : 'Correios',
      tipo: quote.tipo
    };
    
    setPostagemData((prev: any) => ({
      ...prev,
      tipo_entrega: selectedQuote.tipo_entrega
    }));
    
    localStorage.setItem('cepcerto_cotacao_selecionada', JSON.stringify(selectedQuote));
    setFreteSelecionado(selectedQuote);
    toast.success(`Cotação ${quote.tipo} selecionada!`);
    console.log("COTAÇÃO SELECIONADA E SALVA", selectedQuote);
  };

  const handleConfirmQuote = () => {
    // Mantido por compatibilidade, mas a seleção agora é direta
    if (selectedQuoteForConfirmation) {
      handleSelectQuote(selectedQuoteForConfirmation);
      setShowSelectQuoteModal(false);
      setSelectedQuoteForConfirmation(null);
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

  const handlePrint = (type: 'etiqueta' | 'declaracao') => {
    if (selectedLabels.length === 0) {
      toast.error('Selecione pelo menos uma etiqueta para imprimir.');
      return;
    }
    
    console.log("========== IMPRESSÃO ETIQUETAS ==========");
    console.log("Selecionadas", selectedLabels);
    console.log("Tipo impressão", type);
    console.log("Quantidade", selectedLabels.length);

    setPrintType(type);
    setIsPrinting(true);
    
    // Pequeno delay para garantir que o DOM foi atualizado antes de chamar o print
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintType(null);
    }, 500);
  };

  // Função auxiliar para dividir array em chunks
  const chunkArray = (arr: any[], size: number) => {
    const chunks = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
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
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Remetente *</label>
                        <input 
                          type="text" 
                          value={senderData.nome_remetente} 
                          onChange={e => setSenderData({...senderData, nome_remetente: e.target.value.slice(0, 50)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="Nome da Empresa/Pessoa"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CPF / CNPJ Remetente *</label>
                          <input 
                            type="text" 
                            value={senderData.cpf_cnpj_remetente} 
                            onChange={e => setSenderData({...senderData, cpf_cnpj_remetente: e.target.value.replace(/\D/g, '').slice(0, 14)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="Apenas números"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WhatsApp Remetente *</label>
                          <input 
                            type="text" 
                            value={senderData.whatsapp_remetente} 
                            onChange={e => setSenderData({...senderData, whatsapp_remetente: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="DDD + Número"
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email Remetente *</label>
                        <input 
                          type="email" 
                          value={senderData.email_remetente} 
                          onChange={e => setSenderData({...senderData, email_remetente: e.target.value.slice(0, 50)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          placeholder="email@exemplo.com"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CEP Remetente *</label>
                          <input 
                            type="text" 
                            value={senderData.cep_remetente} 
                            onChange={e => setSenderData({...senderData, cep_remetente: e.target.value.replace(/\D/g, '').slice(0, 8)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="00000000"
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
                          <input 
                            type="text" 
                            value={senderData.cidade_remetente} 
                            onChange={e => setSenderData({...senderData, cidade_remetente: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Endereço</label>
                          <input 
                            type="text" 
                            value={senderData.logradouro_remetente} 
                            onChange={e => setSenderData({...senderData, logradouro_remetente: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Número</label>
                          <input 
                            type="text" 
                            value={senderData.numero_remetente} 
                            onChange={e => setSenderData({...senderData, numero_remetente: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estado</label>
                          <input 
                            type="text" 
                            value={senderData.estado_remetente} 
                            onChange={e => setSenderData({...senderData, estado_remetente: e.target.value.toUpperCase().slice(0, 2)})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            placeholder="UF"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Complemento</label>
                          <input 
                            type="text" 
                            value={senderData.complemento_remetente} 
                            onChange={e => setSenderData({...senderData, complemento_remetente: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bairro</label>
                        <input 
                          type="text" 
                          value={senderData.bairro_remetente} 
                          onChange={e => setSenderData({...senderData, bairro_remetente: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                        />
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

                  </div>
                </div>

                {/* Resultado da Cotação */}
                {freteResultado && (
                  <div className="mt-12 p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                        <Activity size={20} className="text-indigo-600" />
                        Resultado da Cotação
                      </h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Selecione um frete para continuar</p>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                      {freteResultado.valor_pac && (
                        <div 
                          onClick={() => setFreteSelecionado({
                            tipo: "PAC",
                            valor: freteResultado.valor_pac,
                            prazo: freteResultado.prazo_entrega_pac
                          })}
                          className={`bg-white p-6 rounded-3xl border-2 transition-all cursor-pointer relative ${freteSelecionado?.tipo === 'PAC' ? 'border-indigo-600 shadow-lg shadow-indigo-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                        >
                          <div className="absolute top-4 right-4">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${freteSelecionado?.tipo === 'PAC' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                              {freteSelecionado?.tipo === 'PAC' && <Check size={12} className="text-white" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                              <Package size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">PAC</p>
                          </div>
                          <p className="text-2xl font-black text-indigo-600 mb-1">{freteResultado.valor_pac}</p>
                          <p className="text-sm text-slate-500 font-medium">Prazo: {freteResultado.prazo_entrega_pac}</p>
                        </div>
                      )}
                      
                      {freteResultado.valor_sedex && (
                        <div 
                          onClick={() => setFreteSelecionado({
                            tipo: "SEDEX",
                            valor: freteResultado.valor_sedex,
                            prazo: freteResultado.prazo_entrega_sedex
                          })}
                          className={`bg-white p-6 rounded-3xl border-2 transition-all cursor-pointer relative ${freteSelecionado?.tipo === 'SEDEX' ? 'border-emerald-600 shadow-lg shadow-emerald-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                        >
                          <div className="absolute top-4 right-4">
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${freteSelecionado?.tipo === 'SEDEX' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'}`}>
                              {freteSelecionado?.tipo === 'SEDEX' && <Check size={12} className="text-white" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                              <Zap size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">SEDEX</p>
                          </div>
                          <p className="text-2xl font-black text-emerald-600 mb-1">{freteResultado.valor_sedex}</p>
                          <p className="text-sm text-slate-500 font-medium">Prazo: {freteResultado.prazo_entrega_sedex}</p>
                        </div>
                      )}

                      {(freteResultado.valor_jadlog_package || freteResultado.valor_jadlog_dotcom) && (
                        <div className="space-y-4">
                          {freteResultado.valor_jadlog_package && (
                            <div 
                              onClick={() => setFreteSelecionado({
                                tipo: "JADLOG PACKAGE",
                                valor: freteResultado.valor_jadlog_package,
                                prazo: freteResultado.prazo_entrega_jadlog_package
                              })}
                              className={`bg-white p-6 rounded-3xl border-2 transition-all cursor-pointer relative ${freteSelecionado?.tipo === 'JADLOG PACKAGE' ? 'border-blue-600 shadow-lg shadow-blue-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                            >
                              <div className="absolute top-4 right-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${freteSelecionado?.tipo === 'JADLOG PACKAGE' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                  {freteSelecionado?.tipo === 'JADLOG PACKAGE' && <Check size={12} className="text-white" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                  <Truck size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">JADLOG PACKAGE</p>
                              </div>
                              <p className="text-2xl font-black text-blue-600 mb-1">{freteResultado.valor_jadlog_package}</p>
                              <p className="text-sm text-slate-500 font-medium">Prazo: {freteResultado.prazo_entrega_jadlog_package}</p>
                            </div>
                          )}
                          {freteResultado.valor_jadlog_dotcom && (
                            <div 
                              onClick={() => setFreteSelecionado({
                                tipo: "JADLOG DOTCOM",
                                valor: freteResultado.valor_jadlog_dotcom,
                                prazo: freteResultado.prazo_entrega_jadlog_dotcom
                              })}
                              className={`bg-white p-6 rounded-3xl border-2 transition-all cursor-pointer relative ${freteSelecionado?.tipo === 'JADLOG DOTCOM' ? 'border-blue-600 shadow-lg shadow-blue-100' : 'border-slate-200 shadow-sm hover:border-slate-300'}`}
                            >
                              <div className="absolute top-4 right-4">
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${freteSelecionado?.tipo === 'JADLOG DOTCOM' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'}`}>
                                  {freteSelecionado?.tipo === 'JADLOG DOTCOM' && <Check size={12} className="text-white" />}
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                  <Truck size={20} />
                                </div>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">JADLOG DOTCOM</p>
                              </div>
                              <p className="text-2xl font-black text-blue-600 mb-1">{freteResultado.valor_jadlog_dotcom}</p>
                              <p className="text-sm text-slate-500 font-medium">Prazo: {freteResultado.prazo_entrega_jadlog_dotcom}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handlePrepareLabel}
                      disabled={!freteSelecionado}
                      className={`w-full py-5 rounded-2xl font-black text-lg uppercase italic tracking-tighter transition-all flex items-center justify-center gap-3 ${freteSelecionado ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-200 hover:bg-emerald-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      <FileText size={24} />
                      Gerar Etiqueta
                    </button>
                  </div>
                )}

                {quoteError && (
                  <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-[2rem] flex items-start gap-4">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-red-900 mb-1">CEP Inválido</h4>
                      <p className="text-sm text-red-600">{quoteError}</p>
                    </div>
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
                      setFreteResultado(null);
                      setFreteSelecionado(null);
                      setQuoteError(null);
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

          {logisticaSubTab === 'etiquetas' && (
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-8 pb-4 border-b border-slate-100">
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Gerar Nova Etiqueta</h3>
                    <p className="text-sm text-slate-500">Preencha os dados abaixo para postagem via CepCerto.</p>
                  </div>
                </div>

                <div className="space-y-12">
                  {/* Linha 1: Remetente e Destinatário */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* SEÇÃO 1 — REMETENTE */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                        <MapPin size={16} className="text-indigo-600" />
                        Seção 1 — Remetente
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome / Razão Social</label>
                          <input type="text" value={postagemData.nome_remetente} onChange={e => setPostagemData({...postagemData, nome_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CPF / CNPJ</label>
                            <input type="text" value={postagemData.cpf_cnpj_remetente} onChange={e => setPostagemData({...postagemData, cpf_cnpj_remetente: e.target.value.replace(/\D/g, '')})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WhatsApp</label>
                            <input type="text" value={postagemData.whatsapp_remetente} onChange={e => setPostagemData({...postagemData, whatsapp_remetente: e.target.value.replace(/\D/g, '')})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                            <input type="email" value={postagemData.email_remetente} onChange={e => setPostagemData({...postagemData, email_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CEP Remetente</label>
                            <input 
                              type="text" 
                              value={postagemData.cep_remetente}
                              onChange={e => setPostagemData({...postagemData, cep_remetente: e.target.value})}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Logradouro</label>
                            <input type="text" value={postagemData.logradouro_remetente} onChange={e => setPostagemData({...postagemData, logradouro_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Número</label>
                            <input type="text" value={postagemData.numero_endereco_remetente} onChange={e => setPostagemData({...postagemData, numero_endereco_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bairro</label>
                            <input type="text" value={postagemData.bairro_remetente} onChange={e => setPostagemData({...postagemData, bairro_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
                            <input type="text" value={postagemData.cidade_remetente} onChange={e => setPostagemData({...postagemData, cidade_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estado</label>
                            <input type="text" value={postagemData.estado_remetente} onChange={e => setPostagemData({...postagemData, estado_remetente: e.target.value.toUpperCase().slice(0, 2)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Complemento</label>
                          <input type="text" value={postagemData.complemento_remetente} onChange={e => setPostagemData({...postagemData, complemento_remetente: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                        </div>
                      </div>
                    </div>

                    {/* SEÇÃO 2 — DESTINATÁRIO */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                        <Users size={16} className="text-indigo-600" />
                        Seção 2 — Destinatário
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nome Completo</label>
                          <input type="text" value={postagemData.nome_destinatario} onChange={e => handleDestinatarioChange('nome_destinatario', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="Nome do destinatário" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CPF / CNPJ</label>
                            <input type="text" value={postagemData.cpf_cnpj_destinatario} onChange={e => handleDestinatarioChange('cpf_cnpj_destinatario', e.target.value)} onBlur={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">WhatsApp</label>
                            <input type="text" value={postagemData.whatsapp_destinatario} onChange={e => handleDestinatarioChange('whatsapp_destinatario', e.target.value)} onBlur={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">CEP Destinatário</label>
                            <input 
                              type="text" 
                              value={postagemData.cep_destinatario}
                              onChange={e => handleDestinatarioChange('cep_destinatario', e.target.value)}
                              onBlur={verificarDestinatarioCompleto}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Logradouro</label>
                            <input type="text" value={postagemData.logradouro_destinatario} onChange={e => handleDestinatarioChange('logradouro_destinatario', e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Número</label>
                            <input type="text" value={postagemData.numero_endereco_destinatario} onChange={e => handleDestinatarioChange('numero_endereco_destinatario', e.target.value)} onBlur={verificarDestinatarioCompleto} onInput={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Bairro</label>
                            <input type="text" value={postagemData.bairro_destinatario} onChange={e => handleDestinatarioChange('bairro_destinatario', e.target.value)} onBlur={verificarDestinatarioCompleto} onInput={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cidade</label>
                            <input type="text" value={postagemData.cidade_destinatario} onChange={e => handleDestinatarioChange('cidade_destinatario', e.target.value)} onBlur={verificarDestinatarioCompleto} onInput={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Estado</label>
                            <input type="text" value={postagemData.estado_destinatario} onChange={e => handleDestinatarioChange('estado_destinatario', e.target.value.toUpperCase().slice(0, 2))} onBlur={verificarDestinatarioCompleto} onInput={verificarDestinatarioCompleto} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Linha 2: Produtos e Documentos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* SEÇÃO 3 — PRODUTOS */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                        <Package size={16} className="text-indigo-600" />
                        Seção 3 — Produtos
                      </h4>
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Peso (gramas)</label>
                          <input type="text" value={postagemData.peso} onChange={e => setPostagemData({...postagemData, peso: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Alt (cm)</label>
                          <input type="text" value={postagemData.altura} onChange={e => setPostagemData({...postagemData, altura: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Larg (cm)</label>
                          <input type="text" value={postagemData.largura} onChange={e => setPostagemData({...postagemData, largura: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Comp (cm)</label>
                          <input type="text" value={postagemData.comprimento} onChange={e => setPostagemData({...postagemData, comprimento: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        {postagemData.produtos.map((prod: any, idx: number) => (
                          <div key={idx} className="grid grid-cols-12 gap-2">
                            <div className="col-span-6">
                              <input type="text" value={prod.descricao} onChange={e => {
                                const newProds = [...postagemData.produtos];
                                newProds[idx].descricao = e.target.value;
                                setPostagemData({...postagemData, produtos: newProds});
                              }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" placeholder="Descrição" />
                            </div>
                            <div className="col-span-2">
                              <input type="number" value={prod.quantidade} onChange={e => {
                                const newProds = [...postagemData.produtos];
                                newProds[idx].quantidade = e.target.value;
                                setPostagemData({...postagemData, produtos: newProds});
                              }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" placeholder="Qtd" />
                            </div>
                            <div className="col-span-3">
                              <input type="number" value={prod.valor} onChange={e => {
                                const newProds = [...postagemData.produtos];
                                newProds[idx].valor = e.target.value;
                                setPostagemData({...postagemData, produtos: newProds});
                              }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs" placeholder="Valor" />
                            </div>
                            <div className="col-span-1 flex items-center justify-center">
                              <button onClick={() => {
                                const newProds = postagemData.produtos.filter((_: any, i: number) => i !== idx);
                                setPostagemData({...postagemData, produtos: newProds});
                              }} className="text-red-400 hover:text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button 
                          onClick={() => setPostagemData({...postagemData, produtos: [...postagemData.produtos, { descricao: '', valor: '', quantidade: '1' }]})}
                          className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:text-indigo-700 flex items-center gap-1"
                        >
                          <Zap size={12} />
                          Adicionar Produto
                        </button>
                      </div>
                      <div id="cotacao-opcoes" className="mt-4"></div>
                    </div>

                    {/* SEÇÃO 4 — DOCUMENTO */}
                    <div className="space-y-4">
                      <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                        <Shield size={16} className="text-indigo-600" />
                        Seção 4 — Documento Fiscal
                      </h4>
                      <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tipo de Documento</label>
                          <select 
                            value={postagemData.tipo_doc_fiscal}
                            onChange={e => setPostagemData({...postagemData, tipo_doc_fiscal: e.target.value})}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium"
                          >
                            <option value="declaracao">Declaração de Conteúdo (Padrão)</option>
                            <option value="danfe">DANFE (Nota Fiscal)</option>
                          </select>
                        </div>
                        {postagemData.tipo_doc_fiscal === 'danfe' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Chave NF-e</label>
                            <input type="text" value={postagemData.chave_danfe} onChange={e => setPostagemData({...postagemData, chave_danfe: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm" placeholder="44 dígitos da chave" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linha 3: Opções de Frete */}
                <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                  <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest flex items-center gap-2">
                    <Truck size={16} className="text-indigo-600" />
                    Seção 5 — Selecionar Frete
                  </h4>
                  
                  {calculatingAutoQuote ? (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="animate-spin text-indigo-600" size={24} />
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Calculando cotações...</p>
                    </div>
                  ) : availableQuotes.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {availableQuotes.map((quote, idx) => (
                        <div 
                          key={idx}
                          className={`p-4 border rounded-2xl transition-all group cursor-pointer ${
                            (freteSelecionado?.tipo === quote.tipo || postagemData.tipo_entrega === quote.tipo.toLowerCase().replace(' ', '-'))
                              ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                              : 'bg-slate-50 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30'
                          }`}
                          onClick={() => handleSelectQuote(quote)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-black text-slate-900 uppercase italic tracking-tighter text-lg">{quote.tipo}</p>
                              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{quote.prazo} dias úteis</p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-indigo-600 text-xl tracking-tighter">R$ {quote.valor}</p>
                              <div className={`mt-2 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest transition-all inline-block ${
                                (freteSelecionado?.tipo === quote.tipo || postagemData.tipo_entrega === quote.tipo.toLowerCase().replace(' ', '-'))
                                  ? 'bg-indigo-600 text-white'
                                  : 'text-indigo-600 bg-white border border-indigo-100 group-hover:bg-indigo-600 group-hover:text-white'
                              }`}>
                                {(freteSelecionado?.tipo === quote.tipo || postagemData.tipo_entrega === quote.tipo.toLowerCase().replace(' ', '-')) ? 'Selecionado' : 'Selecionar'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preencha o CEP de destino, endereço, cidade, estado e produtos para ver as opções de frete.</p>
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-8 border-t border-slate-100">
                  <button 
                    onClick={() => {
                      if (!freteSelecionado && !postagemData.tipo_entrega) {
                        toast.error('Por favor, selecione uma opção de frete antes de gerar a etiqueta.');
                        return;
                      }
                      setShowLabelConfirmModal(true);
                    }}
                    disabled={generatingLabel}
                    className={`w-full py-5 rounded-2xl font-black text-xl uppercase italic tracking-tighter transition-all shadow-xl flex items-center justify-center gap-3 ${
                      generatingLabel
                        ? 'bg-slate-300 text-slate-500 shadow-none' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-200'
                    }`}
                  >
                    {generatingLabel ? <RefreshCw size={24} className="animate-spin" /> : <FileText size={24} />}
                    {generatingLabel ? 'Gerando Etiqueta...' : 'Gerar Etiqueta de Postagem'}
                  </button>
                </div>
              </div>

              {/* Lista de Etiquetas */}
              {etiquetasGeradas.length > 0 && (
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter flex items-center gap-2">
                      <Activity size={24} className="text-indigo-600" />
                      Lista de Etiquetas
                    </h3>
                    <div className="flex flex-wrap items-center gap-3">
                      <button 
                        onClick={() => handlePrint('etiqueta')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-md shadow-indigo-200"
                      >
                        <Printer size={16} />
                        Imprimir Etiquetas
                      </button>
                      <button 
                        onClick={() => handlePrint('declaracao')}
                        className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition-all flex items-center gap-2 shadow-md shadow-slate-200"
                      >
                        <FileText size={16} />
                        Imprimir Declaração
                      </button>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left border-b border-slate-100">
                          <th className="pb-4 pl-2">
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                              checked={selectedLabels.length === etiquetasGeradas.length && etiquetasGeradas.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedLabels(etiquetasGeradas.map(l => l.id));
                                } else {
                                  setSelectedLabels([]);
                                }
                              }}
                            />
                          </th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cidade/UF</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rastreamento</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transportadora</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Data</th>
                          <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {etiquetasGeradas.map((etq, idx) => (
                          <tr key={idx} className={`group transition-colors ${selectedLabels.includes(etq.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                            <td className="py-4 pl-2">
                              <input 
                                type="checkbox" 
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                                checked={selectedLabels.includes(etq.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedLabels([...selectedLabels, etq.id]);
                                  } else {
                                    setSelectedLabels(selectedLabels.filter(id => id !== etq.id));
                                  }
                                }}
                              />
                            </td>
                            <td className="py-4 text-sm font-bold text-slate-900">{etq.nome || '-'}</td>
                            <td className="py-4 text-sm text-slate-600">{etq.cidade ? `${etq.cidade} - ${etq.estado}` : '-'}</td>
                            <td className="py-4 text-sm text-slate-600">{etq.email || '-'}</td>
                            <td className="py-4">
                              <span className="font-mono text-sm font-bold text-slate-900">{etq.codigoObjeto}</span>
                            </td>
                            <td className="py-4 text-sm text-slate-600">{etq.transportadora}</td>
                            <td className="py-4 text-sm text-slate-600">{new Date(etq.data).toLocaleDateString()}</td>
                            <td className="py-4 text-right">
                              <div className="flex justify-end gap-2">
                                <button onClick={() => {
                                  setLabelResult(etq);
                                  setShowLabelResultModal(true);
                                }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all" title="Ver Detalhes">
                                  <ExternalLink size={18} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Modal Resultado Etiqueta */}
          {showLabelResultModal && labelResult && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 overflow-y-auto">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl p-8 my-8"
              >
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                      <Check size={28} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Etiqueta Gerada com Sucesso</h2>
                  </div>
                  <button onClick={() => setShowLabelResultModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} className="text-slate-400" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Detalhes da Etiqueta</p>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">ID Recibo</span>
                          <span className="text-sm font-bold text-slate-900">{labelResult.idRecibo}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">ID Correios</span>
                          <span className="text-sm font-bold text-slate-900">{labelResult.idStringCorreios}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Transportadora</span>
                          <span className="text-sm font-bold text-slate-900">{labelResult.transportadora}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Tipo Entrega</span>
                          <span className="text-sm font-bold text-slate-900 uppercase">{labelResult.tipo_entrega}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-500">Valor</span>
                          <span className="text-sm font-bold text-indigo-600">{labelResult.valor}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Rastreamento</p>
                      <div className="flex items-center justify-between gap-4 p-3 bg-white rounded-xl border border-slate-200">
                        <span className="font-mono font-black text-slate-900">{labelResult.codigoObjeto}</span>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(labelResult.codigoObjeto);
                            toast.success('Código copiado!');
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Copy size={18} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                      <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest mb-4">Etiqueta de Postagem</p>
                      <div className="space-y-3">
                        <button 
                          onClick={() => window.open(labelResult.pdfUrlEtiqueta, '_blank')}
                          className="w-full py-3 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-all flex items-center justify-center gap-2"
                        >
                          <Printer size={16} />
                          Imprimir Etiqueta
                        </button>
                        <button 
                          onClick={() => window.open(labelResult.pdfUrlEtiqueta, '_blank')}
                          className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold text-sm hover:bg-indigo-400 transition-all flex items-center justify-center gap-2"
                        >
                          <ExternalLink size={16} />
                          Visualizar PDF
                        </button>
                      </div>
                    </div>

                    {labelResult.pdfUrlDeclaracao && (
                      <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Declaração de Conteúdo</p>
                        <button 
                          onClick={() => window.open(labelResult.pdfUrlDeclaracao, '_blank')}
                          className="w-full py-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
                        >
                          <FileText size={16} />
                          Ver Declaração
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={() => setShowLabelResultModal(false)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all"
                  >
                    Concluído
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {/* Modal Confirmação Etiqueta */}
          {showLabelConfirmModal && freteSelecionado && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8"
              >
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
                    <FileText size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Confirmar Geração de Etiqueta</h2>
                  <p className="text-slate-500 mt-2">Revise os dados antes de prosseguir com a postagem.</p>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Frete Selecionado</p>
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-900">{freteSelecionado.tipo}</span>
                      <span className="font-black text-indigo-600">{freteSelecionado.valor}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">Prazo estimado: {freteSelecionado.prazo}</p>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Destino</p>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} className="text-slate-400" />
                      <span className="font-bold text-slate-700">CEP: {recipientQuoteData.cep}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowLabelConfirmModal(false)}
                    className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={gerarEtiqueta}
                    disabled={generatingLabel}
                    className={`flex-1 py-4 rounded-2xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                      generatingLabel
                        ? 'bg-emerald-400 text-white shadow-none cursor-not-allowed'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200'
                    }`}
                  >
                    {generatingLabel ? <RefreshCw size={20} className="animate-spin" /> : null}
                    {generatingLabel ? 'Gerando...' : 'Confirmar'}
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

          {/* Seção de Impressão (Oculta na tela, visível apenas na impressão) */}
          {isPrinting && (
            <div id="print-section" className="bg-white z-[9999] absolute top-0 left-0 w-full min-h-screen">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden;
                  }
                  #print-section, #print-section * {
                    visibility: visible;
                  }
                  #print-section {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    background: white;
                  }
                  @page {
                    size: A4;
                    margin: 0;
                  }
                }
              `}</style>
              
              {chunkArray(etiquetasGeradas.filter(e => selectedLabels.includes(e.id)), printType === 'etiqueta' ? 4 : 2).map((pageLabels, pageIndex) => (
                <div key={pageIndex} className="w-[210mm] h-[297mm] mx-auto p-[10mm] box-border bg-white" style={{ pageBreakAfter: 'always' }}>
                  <div className={`w-full h-full grid gap-4 ${printType === 'etiqueta' ? 'grid-cols-2 grid-rows-2' : 'grid-cols-1 grid-rows-2'}`}>
                    {Array.from({ length: printType === 'etiqueta' ? 4 : 2 }).map((_, cellIndex) => {
                      const label = pageLabels[cellIndex];
                      const url = label ? (printType === 'etiqueta' ? label.pdfUrlEtiqueta : label.pdfUrlDeclaracao) : null;
                      
                      return (
                        <div key={cellIndex} className="border-2 border-dashed border-slate-300 p-2 flex flex-col items-center justify-center relative overflow-hidden rounded-xl">
                          {url ? (
                            <iframe 
                              src={`${url}#toolbar=0&navpanes=0&scrollbar=0`} 
                              className="w-full h-full border-0"
                              title={`Print ${label.codigoObjeto}`}
                            />
                          ) : (
                            <div className="text-slate-300 text-sm font-bold uppercase tracking-widest flex flex-col items-center gap-2">
                              <Printer size={32} className="opacity-20" />
                              <span>Espaço Vazio</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
