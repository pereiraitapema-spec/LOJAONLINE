import React from 'react';
import { orderService } from '../services/orderService';
import { toast } from 'react-hot-toast';
import { Play } from 'lucide-react';

export const PurchaseSimulator = ({ userId }: { userId: string }) => {
  const runSimulation = async () => {
    try {
      const dummyOrder = {
        total: 199.90,
        billing_data: { name: 'Cliente Teste Fictício', email: 'teste@exemplo.com' },
        payment_data: { method: 'pix' },
        payment_code: 'PIX-TEST-' + Math.random().toString(36).substr(2, 9)
      };
      
      const dummyItems = [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1, price: 199.90 }];
      
      await orderService.createOrder(userId, dummyOrder, dummyItems);
      toast.success('Compra fictícia gerada com sucesso!');
    } catch (error) {
      toast.error('Erro no simulador.');
    }
  };

  return (
    <button onClick={runSimulation} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
      <Play size={18} /> Simular Compra Fictícia
    </button>
  );
};
