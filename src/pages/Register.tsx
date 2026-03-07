import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Mail, Lock, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: 'user'
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        // Se o Supabase retornar uma sessão, significa que a confirmação de e-mail está DESATIVADA
        if (data.session) {
          toast.success('Cadastro realizado com sucesso! Bem-vindo.');
          // Pequeno delay para garantir que o estado do auth seja atualizado
          setTimeout(() => navigate('/'), 1000);
        } else {
          // Se não retornar sessão, a confirmação de e-mail está ATIVADA no Supabase
          toast.success('Cadastro realizado! Verifique seu e-mail para confirmar a conta. (Dica: Você pode desativar a confirmação de e-mail no painel do Supabase para entrar direto)');
          navigate('/login');
        }
      }
    } catch (error: any) {
      console.error('❌ Registration error:', error);
      
      let errorMessage = error.message || 'Erro ao realizar cadastro.';
      
      if (errorMessage.includes('Database error saving new user')) {
        errorMessage = 'Erro interno no servidor de banco de dados. Por favor, peça ao administrador para rodar o script de reparo SQL no Supabase.';
      } else if (errorMessage.includes('already registered')) {
        errorMessage = 'Este e-mail já possui uma conta cadastrada. Tente fazer login.';
      }
      
      toast.error(errorMessage, { duration: 6000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 relative"
      >
        <button 
          onClick={() => navigate('/login')}
          className="absolute top-6 left-6 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-indigo-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Crie sua conta</h1>
          <p className="text-slate-500">Preencha os dados abaixo para começar.</p>
        </div>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nome Completo
            </label>
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="Seu Nome"
                required
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              E-mail
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="seu@email.com"
                required
              />
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Confirmar Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4"
          >
            {loading ? 'Criando conta...' : 'Cadastrar'}
          </button>

          <p className="text-sm text-center text-slate-400 mt-6">
            Já tem uma conta? <Link to="/login" className="text-indigo-600 font-semibold hover:underline">Fazer Login</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
