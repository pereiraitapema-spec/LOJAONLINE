import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Send, X, User, Bot, Sparkles, LogIn } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../services/chatService';
import { leadService } from '../services/leadService';
import { orderService } from '../services/orderService';

// ... (dentro do componente SmartChat)

interface Message {
  role: 'user' | 'bot';
  content: string;
}

export default function SmartChat() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [aiSettings, setAiSettings] = useState({ rules: '', memory: '', triggers: '', autoLearning: false });
  const [agentPhoto, setAgentPhoto] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef<number>(0);
  const prevIsOpenRef = useRef<boolean>(false);

  useEffect(() => {
    const fetchAgentData = async () => {
      if (!session) return;
      
      // Fetch agent settings
      const { data: affiliateData } = await supabase.from('affiliates').select('id').eq('user_id', session.user.id).maybeSingle();
      const agentType = affiliateData ? 'afiliados' : 'vendas';
      
      const { data: settings } = await supabase
        .from('ai_settings')
        .select('rules, memory')
        .eq('agent_type', agentType)
        .maybeSingle();
      
      if (settings) {
        setAiSettings({
          rules: settings.rules || '',
          memory: settings.memory || '',
          triggers: 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?',
          autoLearning: false
        });
      }

      // Fetch agent photo (from admin profile)
      const { data: adminProfile, error: profileError } = await supabase
        .from('profiles')
        .select('avatar_url')
        .in('email', ['pereira.itapema@gmail.com'])
        .maybeSingle();
      
      console.log('[SmartChat] adminProfile:', adminProfile, 'Error:', profileError);
      
      if (adminProfile && adminProfile.avatar_url) {
        setAgentPhoto(adminProfile.avatar_url);
      } else {
        console.log('[SmartChat] No avatar_url found for admin');
      }

      // Fetch user photo
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', session.user.id)
        .maybeSingle();
      if (userProfile) setUserPhoto(userProfile.avatar_url);
    };
    fetchAgentData();
  }, [session]);

// ... (dentro do componente SmartChat)

  const loadHistory = async (userId: string) => {
    console.log(`[SmartChat] Iniciando carregamento de histórico para o usuário: ${userId}`);
    // Primeiro tenta carregar do localStorage para rapidez
    const saved = localStorage.getItem(`gfitlif_chat_history_${userId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const validMessages = parsed.filter((msg: any) => msg && typeof msg.content === 'string');
          if (validMessages.length > 0) {
            console.log(`[SmartChat] Histórico carregado do localStorage: ${validMessages.length} mensagens`);
            setMessages(validMessages);
          }
        }
      } catch (e) {
        console.error('[SmartChat] Error loading chat history from localStorage:', e);
      }
    }

    // Busca do banco de dados para garantir sincronia
    try {
      console.log(`[SmartChat] Buscando histórico no banco de dados para o usuário: ${userId}`);
      const data = await chatService.fetchUserHistory(userId);

      if (data && data.length > 0) {
        console.log(`[SmartChat] Histórico carregado do banco de dados: ${data.length} mensagens`, data);
        const dbMessages: Message[] = data.map(msg => ({
          role: msg.is_human && msg.sender_id === userId && msg.receiver_id === null ? 'user' : 'bot',
          content: msg.message
        }));
        setMessages(dbMessages);
        localStorage.setItem(`gfitlif_chat_history_${userId}`, JSON.stringify(dbMessages));
      } else {
        console.log(`[SmartChat] Nenhum histórico encontrado no banco de dados para o usuário: ${userId}`);
      }
    } catch (e) {
      console.error('[SmartChat] Error loading chat history from DB:', e);
    }
  };

  useEffect(() => {
    const initSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          if (error.message.includes('Lock broken')) {
            console.warn('Auth lock broken in SmartChat, retrying...');
            return;
          }
          throw error;
        }
        setSession(session);
      } catch (e) {
        console.error('Error getting session in SmartChat:', e);
      } finally {
        setLoadingSession(false);
      }
    };
    initSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) {
        setMessages([{ role: 'bot', content: 'Olá! Sou seu assistente inteligente G-FitLif. Como posso te ajudar hoje?' }]);
      }
      setLoadingSession(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      loadHistory(session.user.id);
      
      // Fetch AI Settings
      const fetchAiSettings = async () => {
        const { data } = await supabase.from('store_settings').select('ai_chat_rules, ai_chat_triggers, ai_auto_learning, ai_chat_memory').maybeSingle();
        if (data) {
          setAiSettings({
            rules: data.ai_chat_rules || '',
            memory: data.ai_chat_memory || '',
            triggers: data.ai_chat_triggers || 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?',
            autoLearning: !!data.ai_auto_learning
          });
        }
      };
      fetchAiSettings();

      // Subscription for real-time messages
      const msgSubscription = chatService.subscribeToMessages(session.user.id, (payload) => {
        const newMessage = payload.new;
        if (newMessage && newMessage.message) {
          setMessages(prev => {
            // Evitar duplicatas se a mensagem já foi adicionada localmente
            if (prev.some(m => m.content === newMessage.message && m.role === 'bot')) return prev;
            return [...prev, { role: 'bot', content: newMessage.message }];
          });
          setShowNotification(true);
        }
      });

      return () => {
        if (msgSubscription) msgSubscription.unsubscribe();
      };
    }
  }, [session?.user?.id]);

  useEffect(() => {
    // Mostrar notificação apenas uma vez após 10 segundos se o chat estiver fechado
    if (!isOpen) {
      const timer = setTimeout(() => {
        setShowNotification(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) setShowNotification(false);
  }, [isOpen]);

  useEffect(() => {
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        const isNewOpen = isOpen && !prevIsOpenRef.current;
        const isNewMessage = messages.length > prevMessagesLengthRef.current;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
        
        // Scroll to bottom if:
        // 1. User just opened the chat
        // 2. It's the first message
        // 3. A new message arrived AND user is already near bottom
        // 4. A new message arrived AND it was sent by the user
        
        const lastMessage = messages[messages.length - 1];
        const sentByMe = lastMessage && lastMessage.role === 'user';

        if (isNewOpen || messages.length <= 1 || (isNewMessage && (isNearBottom || sentByMe))) {
          messagesEndRef.current.scrollIntoView({ behavior: isNewOpen ? 'auto' : 'smooth' });
        }
      }
    }
    prevIsOpenRef.current = isOpen;
    prevMessagesLengthRef.current = messages.length;
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    if (!session) {
      toast.error('Você precisa estar logado para enviar mensagens.');
      navigate('/login');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    
    const updatedMessages = [...messages, { role: 'user' as const, content: userMessage }].slice(-40);
    setMessages(updatedMessages);
    localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(updatedMessages));
    
      // Save to DB
      try {
        console.log(`📤 Salvando mensagem do usuário (${session.user.email} - ${session.user.id}) no DB...`);
        await chatService.sendMessage({
          sender_id: session.user.id,
          receiver_id: null, // Mensagem do usuário para o sistema (admin/IA)
          message: userMessage,
          is_human: true,
          is_read: false
        });
        console.log('✅ Mensagem do usuário salva no DB.');
      } catch (e) {
        console.error('❌ Erro ao salvar mensagem no DB:', e);
      }
      
      // Marcar como lead morno ao interagir no chat (se não for admin)
      if (session.user.email !== 'pereira.itapema@gmail.com') {
        try {
          await leadService.updateStatus('morno');
        } catch (e) {
          console.warn('⚠️ Erro ao atualizar status do lead:', e);
        }
      }

      // Process AI response directly after sending
      processAiResponse(updatedMessages);
  };

  const processAiResponse = async (currentMessages: Message[]) => {
    if (loading) return;
    setLoading(true);

    let keys: any = null;
    let keysData: any[] | null = null;
    let context = '';
    let alternatingHistory: any[] = [];

    const maxLinesMatch = aiSettings.rules.match(/(\d+)\s*linhas/i);
    const maxLines = maxLinesMatch ? parseInt(maxLinesMatch[1]) : 4;

    try {
      // 0. Check if AI auto-reply is enabled for this lead or if it's an affiliate
      let leadData = null;
      let affiliateData = null;

      if (session?.user?.id) {
        const { data: lData } = await supabase
          .from('leads')
          .select('ai_auto_reply')
          .eq('id', session.user.id)
          .maybeSingle();
        leadData = lData;
        
        const { data: aData } = await supabase
          .from('affiliates')
          .select('id, code, commission_rate, ai_auto_reply')
          .eq('user_id', session.user.id)
          .maybeSingle();
        affiliateData = aData;
      }
      
      const isAffiliate = !!affiliateData;

      if (isAffiliate && affiliateData?.ai_auto_reply === false) {
        console.log('🤖 AI Auto-reply is disabled for this affiliate.');
        return;
      }

      if (!isAffiliate && leadData && leadData.ai_auto_reply === false) {
        console.log('🤖 AI Auto-reply is disabled for this lead.');
        return;
      }

      // 1. Fetch API Keys
      const { data: fetchedKeys } = await supabase
        .from('api_keys')
        .select('key_value')
        .eq('service', 'gemini')
        .eq('active', true);

      keysData = fetchedKeys;

      if (!keysData || keysData.length === 0) {
        throw new Error('Assistente indisponível no momento.');
      }

      // Use the first active key
      keys = keysData[0];

      // 2. Fetch Context for "Memory"
      const [
        { data: products, error: prodError },
        { data: settings, error: settingsError },
        { data: siteContent, error: contentError },
        { data: knowledge, error: knowledgeError }
      ] = await Promise.all([
        supabase.from('products').select('id, name, description, composition, price, discount_price, stock, quantity_info, usage_instructions, category:categories(name), tiers:product_tiers(*)').eq('active', true),
        supabase.from('store_settings').select('*').maybeSingle(),
        supabase.from('site_content').select('*'),
        supabase.from('ai_knowledge_base').select('*')
      ]);

      if (prodError) console.error('Error fetching products:', prodError);
      if (settingsError) console.error('Error fetching settings:', settingsError);
      if (contentError) console.error('Error fetching content:', contentError);
      if (knowledgeError) console.error('Error fetching knowledge:', knowledgeError);

      context = 'Informações da Loja:\n';
      if (settings) {
        context += `Nome: ${settings.company_name}\nEndereço: ${settings.address}\nWhatsApp: ${settings.whatsapp}\nHorário: ${settings.business_hours}\n`;
        
        // Determinar qual webhook usar (com fallback para o de vendas se o de afiliados não estiver definido)
        const webhookUrl = isAffiliate 
          ? (settings.affiliate_chat_webhook_url || settings.chat_webhook_url) 
          : settings.chat_webhook_url;

        // Se houver um webhook de chat configurado, usamos ele em vez do Gemini
        if (webhookUrl) {
          console.log(`🔗 Chamando Webhook de Chat (${isAffiliate ? 'Afiliados' : 'Vendas'}): ${webhookUrl}`);
          try {
            const payload = {
              event: 'chat_message',
              type: isAffiliate ? 'affiliate' : 'sales',
              lead_id: session?.user?.id || 'guest',
              email: session?.user?.email || 'guest@example.com',
              mensagem: currentMessages[currentMessages.length - 1].content,
              history: currentMessages,
              context: {
                company_name: settings.company_name,
                products: products?.map(p => ({ id: p.id, name: p.name, price: p.discount_price || p.price }))
              }
            };
            
            console.log('📤 Payload do Webhook:', payload);

            const response = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            console.log(`📥 Resposta do Webhook: ${response.status} ${response.statusText}`);

            if (response.ok) {
              const data = await response.json();
              console.log('📦 Dados recebidos do Webhook:', data);
              
              if (data && data.response) {
                const botMessage = data.response;
                setMessages(prev => [...prev, { role: 'bot', content: botMessage }]);
                
                if (session?.user?.id) {
                  localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify([...currentMessages, { role: 'bot', content: botMessage }]));
                  
                  await chatService.sendMessage({
                    sender_id: session.user.id,
                    receiver_id: session.user.id,
                    message: botMessage,
                    is_human: false,
                    is_read: true
                  });
                }
              }
              setLoading(false);
              return;
            } else {
              console.warn('⚠️ Webhook retornou erro, tentando fallback para Gemini...');
            }
          } catch (e) {
            console.error('❌ Erro ao chamar webhook de chat:', e);
            // Fallback para Gemini se o webhook falhar
          }
        }
      }
      
      context += `\nRegras do Agente:\n${aiSettings.rules}\n`;
      context += `\nMemória do Agente:\n${aiSettings.memory}\n`;

      if (siteContent) {
        context += 'Conteúdo do Site:\n' + siteContent.map(c => `${c.key}: ${c.value}`).join('\n') + '\n';
      }
      if (knowledge && knowledge.length > 0) {
        context += '\nConhecimento Adicional (Memória):\n' + knowledge.map(k => `${k.topic}: ${k.content}`).join('\n') + '\n';
      }

      context += '\nProdutos:\n' + (products && products.length > 0 
        ? Object.entries(products.reduce((acc, p) => {
            const cat = (p.category as any)?.name || 'Sem Categoria';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(p);
            return acc;
          }, {} as Record<string, any[]>)).map(([cat, prods]) => {
            return `Categoria: ${cat}\n\n` + prods.map(p => {
              const currentPrice = p.discount_price || p.price;
              const hasDiscount = p.discount_price && p.discount_price < p.price;
              const discountText = hasDiscount ? ` (EM PROMOÇÃO! De R$ ${p.price} por R$ ${p.discount_price})` : '';
              const stockText = p.stock <= 5 ? ` - APENAS ${p.stock} UNIDADES EM ESTOQUE!` : '';
              const productLink = `${window.location.origin}/?product=${p.id}`;
              const checkoutLink = `${window.location.origin}/checkout?product=${p.id}`;
              const tiersText = p.tiers && p.tiers.length > 0 
                ? `\nDescontos Progressivos: ${p.tiers.map((t: any) => `${t.quantity} unidades com ${t.discount_percentage}% de desconto`).join(', ')}`
                : '';
              
              return `Nome: [${p.name}](${productLink})\nPreço Atual: R$ ${currentPrice}${discountText}${stockText}${tiersText}\nLink Direto para Pagamento: [Comprar Agora](${checkoutLink})\nConteúdo: ${p.quantity_info || 'Não informado'}\nComo Tomar: ${p.usage_instructions || 'Não informado'}\nDescrição: ${p.description}\nComposição: ${p.composition}`;
            }).join('\n\n');
          }).join('\n\n---\n\n')
        : 'Nenhum produto encontrado no catálogo no momento.');

      // 3. Call Gemini
      const ai = new GoogleGenAI({ apiKey: keys.key_value });
      
      const saveKnowledge: FunctionDeclaration = {
        name: "save_knowledge",
        description: "Salva uma informação ou diferença entre produtos no banco de dados para uso futuro.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            topic: { type: Type.STRING, description: "O tópico ou nome do produto/comparação." },
            content: { type: Type.STRING, description: "A informação detalhada para salvar." }
          },
          required: ["topic", "content"]
        }
      };

      const getOrderDetails: FunctionDeclaration = {
        name: "get_order_details",
        description: "Busca detalhes de um pedido pelo número do pedido.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            orderId: { type: Type.NUMBER, description: "O número do pedido." }
          },
          required: ["orderId"]
        }
      };

      const rawHistory = currentMessages.map(msg => ({
        role: msg.role === 'bot' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));
      
      while (rawHistory.length > 0 && rawHistory[0].role === 'model') {
        rawHistory.shift();
      }
      
      alternatingHistory = [];
      for (const msg of rawHistory) {
        if (alternatingHistory.length === 0) {
          if (msg.role === 'user') alternatingHistory.push(msg);
        } else {
          const lastRole = alternatingHistory[alternatingHistory.length - 1].role;
          if (msg.role !== lastRole) {
            alternatingHistory.push(msg);
          } else {
            alternatingHistory[alternatingHistory.length - 1].parts[0].text += '\n\n' + msg.parts[0].text;
          }
        }
      }

      const affiliateRules = isAffiliate ? `
          REGRAS ESPECÍFICAS PARA AFILIADOS:
          1. Você está falando com um afiliado parceiro da G-FitLif.
          2. Responda dúvidas sobre comissões, uso de banners, regras de divulgação e links de afiliado.
          3. O código de afiliado deste usuário é: ${affiliateData.code}.
          4. A taxa de comissão atual deste afiliado é: ${affiliateData.commission_rate}%.
          5. Ensine o afiliado a usar o painel, pegar links e materiais de divulgação.
          6. NÃO tente vender produtos para o afiliado, foque em ajudá-lo a vender.
          7. Se o afiliado perguntar sobre chaves de API ou integrações, explique que o sistema já gerencia isso automaticamente para ele no painel, ou forneça instruções técnicas se disponíveis na base de conhecimento.
      ` : '';

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: alternatingHistory,
        tools: aiSettings.autoLearning ? [
          { googleSearch: {} },
          { functionDeclarations: [saveKnowledge, getOrderDetails] }
        ] : [{ functionDeclarations: [getOrderDetails] }],
        toolConfig: { 
          includeServerSideToolInvocations: true
        },
        config: {
          systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
          
          ${isAffiliate ? affiliateRules : `
          REGRAS OBRIGATÓRIAS DE VENDAS E ATENDIMENTO (EXECUÇÃO RÍGIDA):
          1. RESPONDA SEMPRE EM PORTUGUÊS.
          2. Responda com no máximo ${maxLines} linhas por mensagem.
          3. PADRÃO DE RESPOSTA HUMANIZADA:
             - Se o cliente perguntar sobre produtos ou opções, você DEVE seguir esta sequência usando [SPLIT]:
             - Mensagem 1: Liste TODOS os produtos relevantes de forma resumida (Nome e Preço).
             - Mensagens Seguintes: Explique UM produto de cada vez (uma mensagem para cada produto).
             - Para CADA produto explicado, você DEVE obrigatoriamente informar:
               a) O que é e para que serve.
               b) Como tomar (conforme usage_instructions).
               c) CÁLCULO DE DURAÇÃO E VALOR MENSAL ESPECÍFICO: 
                  - Leia o campo "Conteúdo" (quantity_info) e "Como Tomar" (usage_instructions).
                  - Calcule: Conteúdo / Dose Diária = Dias de duração.
                  - Exemplo MOOD SLIM: 120 cápsulas / 1 por dia = 120 dias = 4 meses.
                  - Exemplo MOOD SLIM (Dose 2/dia): 120 cápsulas / 2 por dia = 60 dias = 2 meses.
                  - NUNCA invente doses. Se o campo diz 1 por dia, use 1 por dia como base.
               d) REGRA DA INSULINA: Explique que sem resistência à insulina, a dose é menor (ex: 1 por dia) e o produto dura mais (ex: 4 meses para o MOOD SLIM). Mostre o valor mensal exato para esse cenário (Preço / 4).
               e) EXPLICAÇÃO DE EFICÁCIA: Se a pessoa tiver resistência à insulina, ela DEVE aumentar a dosagem conforme o limite máximo informado no campo "Como Tomar" (usage_instructions). Explique que esse aumento é necessário para que o produto faça efeito e traga resultados reais.
          4. NUNCA envie mais de ${maxLines} linhas em um único bloco de texto. Use [SPLIT] para separar os produtos.
          5. Use o separador [SPLIT] sempre que atingir o limite de ${maxLines} linhas ou para separar a explicação de cada produto.
          6. Finalize SEMPRE com uma pergunta para continuar a conversa.
          7. FONTES DE INFORMAÇÃO:
             - PRODUTOS DA LOJA (Catálogo): Use APENAS o contexto fornecido. É PROIBIDO inventar produtos.
             - INTERNET (Google Search): Use APENAS para detalhes técnicos de ingredientes ou benefícios científicos.
          8. APLIQUE RIGIDAMENTE as regras da memória:
             --- REGRAS DA MEMÓRIA ---
             ${aiSettings.rules || 'Siga as instruções padrão de atendimento.'}
             --- FIM DAS REGRAS ---
          
          LÓGICA DE OBJETIVOS E ESCOLHA:
          - Apresente TODOS os produtos que atendem ao objetivo do cliente.
          - Explique a diferença entre eles e deixe o cliente escolher.
          
          LÓGICA DE "COMO TOMAR" E DURAÇÃO:
          - Seja específico para cada produto. Se um pote tem 60 cápsulas e toma 1 por dia, dura 2 meses. Se toma 2, dura 1 mês.
          - Calcule o investimento mensal: "Sai por apenas R$ XX por mês no tratamento de X meses".
          `}
          
          LÓGICA DE MEMÓRIA E PESQUISA:
          ${aiSettings.autoLearning ? `
          - Use 'googleSearch' para composições não detalhadas no contexto.
          - Use 'save_knowledge' para salvar fatos relevantes.
          - Se a pergunta for fora de contexto (não relacionado a saúde/loja/afiliados), diga: "Esta informação não procede do produto/marca." e force o assunto principal.
          ` : `
          - Use APENAS o conhecimento fornecido.
          `}
          
          Contexto dos Produtos e Conhecimento da IA:\n${context}
          
          Lembre-se do histórico recente do usuário.`,
        }
      } as any);

      // Handle Function Calls
      if (response.functionCalls) {
        for (const call of response.functionCalls) {
          if (call.name === 'save_knowledge') {
            const { topic, content } = call.args as any;
            await supabase.from('ai_knowledge_base').upsert({ topic, content }, { onConflict: 'topic' });
            console.log('🧠 IA salvou novo conhecimento:', topic);
          } else if (call.name === 'get_order_details') {
            const { orderId } = call.args as any;
            try {
              const order = await orderService.getOrderById(orderId);
              console.log('📦 IA buscou pedido:', order);
              // O contexto do pedido será injetado na próxima chamada ou processado aqui
              // Para simplificar, vamos adicionar o resultado ao contexto da próxima chamada
              alternatingHistory.push({
                role: 'model',
                parts: [{ text: `Dados do Pedido ${orderId}: ${JSON.stringify(order)}` }]
              });
            } catch (e) {
              console.error('❌ Erro ao buscar pedido para IA:', e);
              alternatingHistory.push({
                role: 'model',
                parts: [{ text: `Erro ao buscar pedido ${orderId}: ${e instanceof Error ? e.message : 'Desconhecido'}` }]
              });
            }
          }
        }
      }

      const botResponse = response.text || 'Desculpe, não consegui processar sua solicitação.';

      // Split response into multiple messages if needed
      // First split by [SPLIT]
      const rawParts = botResponse.split('[SPLIT]').filter(p => p.trim());
      
      // Further split any part that has more than maxLines or is too long
      const parts: string[] = [];
      for (const part of rawParts) {
        const lines = part.split('\n').filter(l => l.trim());
        if (lines.length > maxLines) {
          // If the part is too long in terms of lines, split it into chunks of maxLines
          for (let i = 0; i < lines.length; i += maxLines) {
            const chunk = lines.slice(i, i + maxLines).join('\n').trim();
            if (chunk) parts.push(chunk);
          }
        } else if (part.length > 500) {
          // Fallback for very long single lines
          const chunks = part.match(/.{1,500}(\s|$)/g) || [part];
          chunks.forEach(c => parts.push(c.trim()));
        } else {
          parts.push(part.trim());
        }
      }
      
      let latestMessages = currentMessages;
      for (const part of parts) {
        const botPart = part.trim();
        latestMessages = [...latestMessages, { role: 'bot' as const, content: botPart }];
        setMessages(latestMessages);
        localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(latestMessages));
        
        // Salvar resposta da IA no banco
        try {
          console.log(`📤 Salvando resposta da IA para o usuário (${session.user.email} - ${session.user.id}) no DB...`);
          const { data, error } = await supabase.from('chat_messages').insert({
            sender_id: null, // AI sender
            receiver_id: session.user.id,
            message: botPart,
            is_human: false,
            is_read: true
          }).select();

          if (error) {
            console.error('❌ Erro ao salvar resposta da IA no DB:', error);
          } else {
            console.log('✅ Resposta da IA salva no DB:', data);
          }
        } catch (e) {
          console.error('❌ Erro de exceção ao salvar resposta da IA no DB:', e);
        }
        
        // Small delay between messages for more natural feel
        if (parts.indexOf(part) < parts.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } catch (error: any) {
      console.error('Chat Error:', error);
      
      // Fallback if tool hybrid mode fails or API key fails
      let retrySuccess = false;

      // Try with other keys if we have them
      if (keysData && keysData.length > 1) {
        console.log('🔄 Tentando com outra chave de API...');
        for (let i = 1; i < keysData.length; i++) {
          try {
            const fallbackKey = keysData[i].key_value;
            const fallbackAi = new GoogleGenAI({ apiKey: fallbackKey });
            
            const retryResponse = await fallbackAi.models.generateContent({
              model: "gemini-3.1-pro-preview",
              config: {
                systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
                (RETRY MODE - SEM FERRAMENTAS)
                Responda com base APENAS no contexto fornecido abaixo.
                
                REGRAS DE LINHAS:
                Responda com no máximo ${maxLines} linhas por mensagem.
                
                Contexto:\n${context}`,
              },
              contents: alternatingHistory
            });
            
            const botResponse = retryResponse.text || 'Desculpe, tive um problema ao processar sua pergunta.';
            const finalMessages = [...currentMessages, { role: 'bot' as const, content: botResponse }].slice(-40);
            setMessages(finalMessages);
            localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(finalMessages));
            
            // Salvar resposta da IA no banco (Retry Mode)
            try {
              console.log(`📤 Salvando resposta da IA (Retry) para o usuário (${session.user.email} - ${session.user.id}) no DB...`);
              const { data, error: dbError } = await supabase.from('chat_messages').insert({
                sender_id: null,
                receiver_id: session.user.id,
                message: botResponse,
                is_human: false,
                is_read: true
              }).select();

              if (dbError) {
                console.error('❌ Erro ao salvar resposta da IA (Retry) no DB:', dbError);
              } else {
                console.log('✅ Resposta da IA (Retry) salva no DB:', data);
              }
            } catch (e) {
              console.error('❌ Erro de exceção ao salvar resposta da IA (Retry) no DB:', e);
            }

            retrySuccess = true;
            break; // Stop trying if successful
          } catch (fallbackError) {
            console.error(`Fallback Error with key ${i}:`, fallbackError);
          }
        }
      }

      // If still failed, try without tools using the first key
      if (!retrySuccess && (error.message?.includes('include_server_side_tool_invocations') || error.message?.includes('INVALID_ARGUMENT') || error.message?.includes('tool_config'))) {
        try {
          const ai = new GoogleGenAI({ apiKey: keys.key_value });
          const retryResponse = await ai.models.generateContent({
            model: "gemini-3.1-pro-preview",
            config: {
              systemInstruction: `Você é o assistente inteligente de ELITE da G-FitLif.
              (RETRY MODE - SEM FERRAMENTAS)
              Responda com base APENAS no contexto fornecido abaixo.
              
              REGRAS DE LINHAS:
              Responda com no máximo ${maxLines} linhas por mensagem.
              
              Contexto:\n${context}`,
            },
            contents: alternatingHistory
          });
          
          const botResponse = retryResponse.text || 'Desculpe, tive um problema ao processar sua pergunta.';
          const finalMessages = [...currentMessages, { role: 'bot' as const, content: botResponse }].slice(-40);
          setMessages(finalMessages);
          localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(finalMessages));
          
          // Salvar resposta da IA no banco (Retry Mode)
          try {
            console.log(`📤 Salvando resposta da IA (Retry) para o usuário (${session.user.email} - ${session.user.id}) no DB...`);
            await chatService.sendMessage({
              sender_id: 'AI', // Ou null, dependendo da convenção
              receiver_id: session.user.id,
              message: botResponse,
              is_human: false,
              is_read: true
            });
            console.log('✅ Resposta da IA (Retry) salva no DB.');
          } catch (e) {
            console.error('❌ Erro ao salvar resposta da IA (Retry) no DB:', e);
          }

          retrySuccess = true;
        } catch (retryError) {
          console.error('Retry Error:', retryError);
        }
      }

      if (!retrySuccess) {
        const errorMessages = [...currentMessages, { role: 'bot' as const, content: 'Ops! Tive um problema técnico. Pode tentar novamente?' }].slice(-40);
        setMessages(errorMessages);
        localStorage.setItem(`gfitlif_chat_history_${session.user.id}`, JSON.stringify(errorMessages));
        
        // Salvar mensagem de erro no banco para que o CRM também veja
        try {
          await chatService.sendMessage({
            sender_id: 'AI',
            receiver_id: session.user.id,
            message: 'Ops! Tive um problema técnico. Pode tentar novamente?',
            is_human: false,
            is_read: true
          });
        } catch (e) {
          console.error('Erro ao salvar mensagem de erro no DB:', e);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const isInternalLink = (url: string) => {
    try {
      if (!url) return false;
      const parsed = new URL(url, window.location.origin);
      return parsed.origin === window.location.origin;
    } catch (e) {
      return url.startsWith('/') || url.startsWith('?');
    }
  };

  const handleInternalLink = (url: string) => {
    try {
      const parsed = new URL(url, window.location.origin);
      const path = parsed.pathname + parsed.search;
      navigate(path);
    } catch (e) {
      navigate(url);
    }
  };

  return (
    <div className="fixed bottom-36 left-6 md:bottom-12 md:left-12 z-[9999]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="chat-window"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="bg-white w-[350px] md:w-[400px] h-[500px] rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden mb-4"
          >
            {/* Header */}
            <div className="bg-emerald-600 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center overflow-hidden border-2 border-emerald-400">
                  {agentPhoto ? (
                    <img 
                      src={agentPhoto} 
                      alt="Agente" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Bot className="text-white" size={20} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-sm">G-FitLif AI</h3>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[10px] opacity-80">Online agora</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.slice(-20).map((msg, idx) => (
                <div key={`${idx}-${msg.role}-${msg.content.substring(0, 10)}`} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                  {msg.role !== 'user' && (
                    <div className="flex-shrink-0 mr-2 mt-auto">
                      {agentPhoto ? (
                        <img 
                          src={agentPhoto} 
                          alt="Agente" 
                          className="w-8 h-8 rounded-full object-cover shadow-sm border-2 border-emerald-500"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs shadow-sm">
                          <Bot size={16} />
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-600 text-white rounded-br-none' 
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                  }`}>
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown 
                        components={{
                          a: ({node, ...props}) => {
                            const isInternal = isInternalLink(props.href || '');
                            if (isInternal) {
                              return (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleInternalLink(props.href || '');
                                  }}
                                  className="text-emerald-700 underline font-bold hover:text-emerald-800 transition-colors inline-block"
                                >
                                  {props.children}
                                </button>
                              );
                            }
                            return <a {...props} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline font-bold" />;
                          }
                        }}
                      >
                        {msg.content || ''}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 ml-2 mt-auto">
                      {session?.user?.user_metadata?.avatar_url ? (
                        <img 
                          src={session.user.user_metadata.avatar_url} 
                          alt="Você" 
                          className="w-8 h-8 rounded-full object-cover shadow-sm"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs shadow-sm">
                          {(session?.user?.user_metadata?.full_name || session?.user?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 rounded-tl-none flex gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100">
              {loadingSession ? (
                <div className="flex items-center justify-center gap-2 py-3 bg-slate-50 text-slate-400 rounded-xl text-xs">
                  <div className="w-4 h-4 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin" />
                  Verificando conexão...
                </div>
              ) : !session ? (
                <button 
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                >
                  <LogIn size={18} />
                  Entre para conversar
                </button>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Tire suas dúvidas..."
                    className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-slate-400 text-center mt-2 flex items-center justify-center gap-1">
                <Sparkles size={10} /> Powered by G-FitLif Intelligence
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group relative"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && (
          <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] font-black px-2 py-1 rounded-full animate-bounce">
            IA ON
          </span>
        )}
        {showNotification && !isOpen && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute right-20 bottom-2 bg-white p-3 rounded-2xl shadow-xl border border-slate-100 w-48 text-left"
          >
            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-1">Novidade!</p>
            <p className="text-xs text-slate-600 font-medium leading-tight">{aiSettings.triggers || 'Olá! Tenho uma oferta especial para você hoje. Vamos conversar?'}</p>
            <div className="absolute right-[-8px] top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-r border-b border-slate-100 rotate-[-45deg]"></div>
          </motion.div>
        )}
      </button>
    </div>
  );
}
