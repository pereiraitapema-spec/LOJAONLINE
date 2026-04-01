import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function Callback() {
  const navigate = useNavigate();
  const [siteLogo, setSiteLogo] = useState<string | null>(null);
  const [siteName, setSiteName] = useState<string | null>(null);

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        const { data } = await supabase
          .from('site_content')
          .select('key, value')
          .in('key', ['site_logo', 'site_name']);
          
        if (data) {
          const logo = data.find(item => item.key === 'site_logo')?.value;
          const name = data.find(item => item.key === 'site_name')?.value;
          if (logo) setSiteLogo(logo);
          if (name) setSiteName(name);
        }
      } catch (err) {
        console.error('Erro ao buscar dados do site:', err);
      }
    };
    fetchSiteData();
  }, []);

  useEffect(() => {
    // Tenta avisar a janela pai que o login foi um sucesso
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
        // Dá um tempo para a mensagem ser processada antes de fechar
        setTimeout(() => {
          window.close();
        }, 1500);
      } else {
        // Se não for popup, volta para a home após um breve delay
        setTimeout(() => {
          navigate('/');
        }, 2000);
      }
    } catch (e) {
      console.error('Erro no callback:', e);
      navigate('/');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center">
        {siteLogo ? (
          <img src={siteLogo} alt={siteName || 'Logo'} className="h-20 mb-6 object-contain" />
        ) : (
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
            <span className="text-emerald-600 font-bold text-2xl">{siteName ? siteName.charAt(0) : 'L'}</span>
          </div>
        )}
        
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Autenticação Concluída!</h2>
        <p className="text-slate-500 mb-6">
          {window.opener 
            ? 'Esta janela fechará automaticamente em instantes...' 
            : 'Redirecionando você para a loja...'}
        </p>
        
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-emerald-700 font-medium animate-pulse">Processando...</p>
        </div>
        
        {window.opener && (
          <button 
            onClick={() => window.close()} 
            className="mt-8 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Fechar Janela
          </button>
        )}
      </div>
    </div>
  );
}
