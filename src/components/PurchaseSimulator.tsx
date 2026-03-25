import React, { useState } from 'react';
import { orderService } from '../services/orderService';
import { toast } from 'react-hot-toast';
import { Play, ArrowLeft, CheckCircle } from 'lucide-react';

export const PurchaseSimulator = ({ userId }: { userId: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [success, setSuccess] = useState(false);

  const runSimulation = async () => {
    setIsSimulating(true);
    try {
      const dummyOrder = {
        total: 199.90,
        billing_data: { name: 'Cliente Teste Fictício', email: 'teste@exemplo.com' },
        payment_data: { method: 'pix' },
        payment_code: 'PIX-TEST-' + Math.random().toString(36).substr(2, 9)
      };
      
      const dummyItems = [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1, price: 199.90 }];
      
      await orderService.createOrder(userId, dummyOrder, dummyItems);
      setSuccess(true);
      toast.success('Compra fictícia gerada com sucesso!');
    } catch (error) {
      console.error('Erro detalhado no simulador:', error);
      toast.error('Erro no simulador. Verifique o console.');
    } finally {
      setIsSimulating(false);
    }
  };

  if (isOpen) {
    return (
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm w-full">
          <h2 className="text-xl font-bold mb-4">Simulador de Compra</h2>
          {success ? (
            <div className="text-center">
              <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
              <p className="mb-6">Compra fictícia gerada com sucesso!</p>
              <button onClick={() => { setIsOpen(false); setSuccess(false); }} className="w-full bg-slate-600 text-white py-2 rounded-lg">Voltar</button>
              <button onClick={() => window.location.href = '/'} className="w-full bg-slate-100 text-slate-700 py-2 rounded-lg mt-2">Voltar para a Loja</button>
            </div>
          ) : (
            <div className="space-y-4">
              <p>Deseja gerar uma compra fictícia para testes?</p>
              <div className="flex gap-2">
                <button onClick={() => setIsOpen(false)} className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg flex items-center justify-center gap-2">
                  <ArrowLeft size={18} /> Voltar
                </button>
                <button onClick={runSimulation} disabled={isSimulating} className="flex-1 bg-blue-600 text-white py-2 rounded-lg">
                  {isSimulating ? 'Simulando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <button onClick={() => setIsOpen(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
      <Play size={18} /> Simular Compra Fictícia
    </button>
  );
};
