import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';
import { withTimeout } from '../lib/utils';

export default function Callback() {
  const navigate = useNavigate();
  const [siteLogo, setSiteLogo] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem('cache_site_content');
      if (cached) {
        const data = JSON.parse(cached);
        return data.find((item: any) => item.key === 'site_logo')?.value || null;
      }
    } catch (e) {}
    return null;
  });
  
  const [siteName, setSiteName] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem('cache_site_content');
      if (cached) {
        const data = JSON.parse(cached);
        return data.find((item: any) => item.key === 'site_name')?.value || null;
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        const { data } = await withTimeout(supabase
          .from('site_content')
          .select('key, value')
          .in('key', ['site_logo', 'site_name']), 3000);
          
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
    // Tenta extrair o código da URL (para o fluxo PKCE)
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    // Tenta avisar a janela pai
    try {
      if (window.opener) {
        if (code) {
          console.log('✅ Code found, sending to opener');
          window.opener.postMessage({ type: 'AUTH_CODE', code }, '*');
        } else if (error) {
          console.error('❌ Auth error found:', error);
          window.opener.postMessage({ 
            type: 'AUTH_ERROR', 
            error, 
            description: errorDescription 
          }, '*');
        } else {
          // Fallback para fluxos sem PKCE ou se o código não estiver na URL
          window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
        }
        
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
