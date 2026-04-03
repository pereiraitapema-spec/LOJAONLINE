import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { Leaf, User, Mail, Phone, Globe, MessageSquare, ArrowRight, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';

export default function AffiliateRegister() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [step, setStep] = useState(1); // 1: Dados Pessoais, 2: Divulgação, 3: Sucesso
  const [session, setSession] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    confirmEmail: '',
    password: '',
    confirmPassword: '',
    whatsapp: '',
    confirmWhatsapp: '',
    commissionRate: 10,
    socialMedia: '',
    website: '',
    otherMedia: '',
    observation: ''
  });

  React.useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession) {
          // Se já estiver logado, preencher dados básicos e pular para o que falta
          setFormData(prev => ({
            ...prev,
            name: currentSession.user.user_metadata.full_name || '',
            email: currentSession.user.email || '',
            confirmEmail: currentSession.user.email || '',
            password: 'EXISTING_USER', // Placeholder para passar na validação
            confirmPassword: 'EXISTING_USER'
          }));
        }
      } catch (err) {
        console.error('Erro ao verificar sessão:', err);
      } finally {
        setCheckingSession(false);
      }
    };
    checkSession();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const validateStep1 = () => {
    if (!formData.name || !formData.email || !formData.whatsapp) {
      toast.error('Preencha todos os campos obrigatórios.');
      return false;
    }
    if (!session && !formData.password) {
      toast.error('A senha é obrigatória para novos usuários.');
      return false;
    }
    if (formData.email !== formData.confirmEmail) {
      toast.error('Os e-mails não coincidem.');
      return false;
    }
    if (!session && formData.password !== formData.confirmPassword) {
      toast.error('As senhas não coincidem.');
      return false;
    }
    if (formData.whatsapp !== formData.confirmWhatsapp) {
      toast.error('Os números de WhatsApp não coincidem.');
      return false;
    }
    if (!session && formData.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId = session?.user?.id;

      // 1. Se NÃO estiver logado, criar conta
      if (!session) {
        console.log('🚀 Iniciando signUp para:', formData.email);
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.name,
              role: 'affiliate_pending'
            }
          }
        });

        if (authError) {
          console.error('❌ Erro no signUp:', authError);
          // Se o usuário já existe mas não está logado, podemos tentar avisar
          if (authError.message.includes('already registered') || authError.status === 422) {
            throw new Error('Este e-mail já possui uma conta. Por favor, faça login antes de se cadastrar como afiliado.');
          }
          throw authError;
        }
        
        userId = authData.user?.id;
        
        // Em alguns casos o signUp retorna sucesso mas sem usuário (se precisar confirmar email)
        if (!userId && authData.session === null) {
           toast.success('Cadastro realizado! Verifique seu e-mail para confirmar a conta antes de prosseguir.');
           setStep(3);
           return;
        }
      }

      if (userId) {
        // 2. Verificar se já existe um registro de afiliado para este usuário
        let { data: existingAffiliate } = await supabase
          .from('affiliates')
          .select('id, status')
          .eq('user_id', userId)
          .maybeSingle();

        // Se não encontrou por user_id, tentar por e-mail
        if (!existingAffiliate && formData.email) {
          const { data: byEmail } = await supabase
            .from('affiliates')
            .select('id, status')
            .eq('email', formData.email)
            .maybeSingle();
          existingAffiliate = byEmail;
        }

        if (existingAffiliate) {
          // Se encontrou por e-mail mas não tinha user_id, vincular agora
          await supabase.from('affiliates').update({ user_id: userId }).eq('id', existingAffiliate.id).is('user_id', null);
          
          if (existingAffiliate.status === 'approved') {
            toast.success('Você já é um afiliado aprovado!');
            navigate('/afiliados/dashboard');
          } else {
            toast.error('Você já possui uma solicitação em análise.');
            setStep(3); // Pular para tela de sucesso/análise
          }
          return;
        }

        // 3. Criar registro na tabela affiliates
        const tempCode = `PENDING-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
        
        const { error: affiliateError } = await supabase
          .from('affiliates')
          .insert([
            {
              user_id: userId,
              name: formData.name,
              email: formData.email,
              whatsapp: formData.whatsapp,
              social_media: formData.socialMedia,
              website: formData.website,
              other_media: formData.otherMedia,
              observation: formData.observation,
              status: 'pending',
              commission_rate: formData.commissionRate,
              code: tempCode // Código temporário para evitar erro de NOT NULL
            }
          ]);

        if (affiliateError) {
          console.error('Erro ao criar perfil de afiliado:', affiliateError);
          throw new Error(`Erro ao salvar dados de afiliado: ${affiliateError.message}. Verifique se você já possui um cadastro.`);
        }

        setStep(3); // Sucesso
      }
    } catch (error: any) {
      console.error('❌ Erro detalhado no cadastro de afiliado:', error);
      
      let errorMessage = error.message || 'Erro ao realizar cadastro.';
      
      if (errorMessage.includes('Database error saving new user')) {
        errorMessage = 'Erro interno no servidor de banco de dados. Por favor, peça ao administrador para rodar o script de reparo SQL no Supabase.';
      } else if (errorMessage.includes('already registered')) {
        errorMessage = 'Este e-mail já possui uma conta cadastrada. Tente fazer login antes de se tornar afiliado.';
      }
      
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header Simplificado */}
      <header className="bg-white shadow-sm py-4">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-1 font-black text-2xl tracking-tighter cursor-pointer" onClick={() => navigate('/')}>
            <Leaf size={24} className="text-emerald-600" />
            <span className="text-emerald-800">G-Fit</span>
            <span className="text-cyan-700">Life</span>
            <span className="ml-2 text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full uppercase tracking-widest">Afiliados</span>
          </div>
          <button onClick={() => navigate('/login')} className="text-sm font-bold text-slate-600 hover:text-emerald-600">
            Já sou afiliado
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl overflow-hidden flex flex-col md:flex-row">
          
          {/* Lado Esquerdo (Info) - Escondido em mobile se não for passo 3 */}
          <div className={`bg-emerald-900 p-8 md:w-1/3 flex flex-col justify-between text-white ${step === 3 ? 'hidden md:flex' : ''}`}>
            <div>
              <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-4">Seja um Parceiro</h2>
              <p className="text-emerald-100 text-sm mb-6">
                Junte-se ao nosso time de sucesso e lucre divulgando produtos de alta qualidade.
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Comissões atrativas</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Material de apoio</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  <span>Pagamentos pontuais</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 text-xs text-emerald-400 opacity-60">
              © 2024 G-Fit Life
            </div>
          </div>

          {/* Lado Direito (Form) */}
          <div className="p-8 md:w-2/3 bg-white">
            {step === 1 && (
              <form onSubmit={(e) => { e.preventDefault(); if(validateStep1()) setStep(2); }}>
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
                  Dados Pessoais
                </h3>

                {session && (
                  <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                      <User size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-900">Você está logado!</p>
                      <p className="text-xs text-emerald-700">Usaremos sua conta atual ({session.user.email}) para o cadastro.</p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome Completo</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Seu nome"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-mail</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="seu@email.com"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar E-mail</label>
                      <input 
                        type="email"
                        name="confirmEmail"
                        value={formData.confirmEmail}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Repita o e-mail"
                        required
                      />
                    </div>
                  </div>

                  {!session && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Senha</label>
                        <input 
                          type="password"
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="Mínimo 6 caracteres"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar Senha</label>
                        <input 
                          type="password"
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="Repita a senha"
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">WhatsApp</label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          name="whatsapp"
                          value={formData.whatsapp}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="(00) 00000-0000"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Taxa de Comissão Sugerida (%)</label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                          type="number"
                          name="commissionRate"
                          value={formData.commissionRate}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                          placeholder="10"
                          min="1"
                          max="100"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Confirmar WhatsApp</label>
                      <input 
                        name="confirmWhatsapp"
                        value={formData.confirmWhatsapp}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                        placeholder="Repita o número"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end">
                  <button type="submit" className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2">
                    Próximo Passo <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={handleSubmit}>
                <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <span className="bg-emerald-100 text-emerald-800 w-8 h-8 rounded-full flex items-center justify-center text-sm">2</span>
                  Divulgação
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Redes Sociais</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 text-slate-400" size={18} />
                      <textarea 
                        name="socialMedia"
                        value={formData.socialMedia}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-20 resize-none"
                        placeholder="Instagram, Facebook, TikTok (coloque os links ou @)"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Site de Divulgação (Opcional)</label>
                    <input 
                      name="website"
                      value={formData.website}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="https://seu-site.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Outros Meios (Opcional)</label>
                    <input 
                      name="otherMedia"
                      value={formData.otherMedia}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="Email marketing, tráfego pago, etc."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Observações</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-3 text-slate-400" size={18} />
                      <textarea 
                        name="observation"
                        value={formData.observation}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none h-20 resize-none"
                        placeholder="Conte um pouco sobre sua estratégia de vendas..."
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-between">
                  <button 
                    type="button" 
                    onClick={() => setStep(1)}
                    className="text-slate-500 font-bold hover:text-slate-700"
                  >
                    Voltar
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {loading ? 'Enviando...' : 'Finalizar Cadastro'}
                  </button>
                </div>
              </form>
            )}

            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-4">Cadastro Recebido!</h2>
                <p className="text-slate-600 mb-8">
                  Seus dados foram enviados para análise. Nossa equipe entrará em contato via WhatsApp ou E-mail assim que sua conta for aprovada.
                </p>
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8 text-left">
                  <h4 className="font-bold text-amber-800 flex items-center gap-2 mb-2">
                    <AlertCircle size={18} /> Importante
                  </h4>
                  <p className="text-sm text-amber-700">
                    Enquanto sua conta está em análise, você não terá acesso ao painel de afiliado. Aguarde a notificação de aprovação.
                  </p>
                </div>
                <button 
                  onClick={() => navigate('/')}
                  className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                  Voltar para a Loja
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
