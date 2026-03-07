import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, Save, AlertCircle } from 'lucide-react';
import { Loading } from '../components/Loading';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sessionValid, setSessionValid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        // Tentar pegar a sessão atual
        let { data: { session } } = await supabase.auth.getSession();
        
        // Se não houver sessão, aguardar um pouco para o Supabase processar o hash
        if (!session) {
          await new Promise(resolve => setTimeout(resolve, 800));
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          session = retrySession;
        }

        if (session) {
          setSessionValid(true);
        } else {
          // Se ainda não houver sessão, verificar se há hash de recovery na URL
          if (window.location.hash.includes('type=recovery')) {
            // O Supabase ainda está processando, vamos aguardar mais um pouco
            await new Promise(resolve => setTimeout(resolve, 1000));
            const { data: { session: lastTry } } = await supabase.auth.getSession();
            if (lastTry) {
              setSessionValid(true);
              return;
            }
          }
          toast.error('Sessão inválida ou expirada. Por favor, solicite um novo link.');
          setSessionValid(false);
        }
      } catch (error) {
        console.error('Error checking session:', error);
        setSessionValid(false);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      toast.success('Senha redefinida com sucesso!');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar senha.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Verificando sessão..." />;

  if (!sessionValid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Sessão Inválida</h1>
          <p className="text-slate-600 mb-8">
            O link de redefinição de senha expirou ou é inválido. Por favor, tente novamente.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-colors"
          >
            Voltar para Login
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      {saving && <Loading message="Salvando nova senha..." />}
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Senha</h1>
          <p className="text-slate-500 mt-2">Defina sua nova senha de acesso.</p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
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
              Confirmar Nova Senha
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={20} />
            Salvar nova senha
          </button>
        </form>
      </motion.div>
    </div>
  );
}
