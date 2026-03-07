import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loading } from '../components/Loading';

export default function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Loading message="Redirecionando para acesso unificado..." />
    </div>
  );
}
