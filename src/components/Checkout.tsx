import React, { useState } from 'react';
import { orderService } from '../services/orderService';
import { toast } from 'react-hot-toast';

export const Checkout = ({ cartItems, total, userId }: any) => {
  const [billing, setBilling] = useState({ name: '', address: '', city: '', state: '', neighborhood: '' });
  const [payment, setPayment] = useState({ method: 'pix', cardName: '', cardNumber: '', expiry: '', cv: '', brand: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const order = await orderService.createOrder(userId, {
        total,
        billing_data: billing,
        payment_data: payment,
        carrier: 'Correios'
      }, cartItems);
      toast.success(`Pedido ${order.id} criado com sucesso!`);
    } catch (error) {
      toast.error('Erro ao finalizar pedido.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-slate-50 rounded-lg">
      <section>
        <h3 className="font-bold text-lg mb-3">Faturamento</h3>
        <input placeholder="Nome Completo" onChange={e => setBilling({...billing, name: e.target.value})} className="w-full p-2 border rounded" />
      </section>
      <section>
        <h3 className="font-bold text-lg mb-3">Forma de Pagamento</h3>
        <select onChange={e => setPayment({...payment, method: e.target.value})} className="w-full p-2 border rounded">
          <option value="pix">PIX</option>
          <option value="credit_card">Cartão de Crédito</option>
          <option value="boleto">Boleto</option>
        </select>
        {payment.method === 'pix' && (
          <div className="mt-4 p-4 bg-emerald-50 text-emerald-800 rounded text-sm">
            <p className="font-bold">Chave PIX: 123.456.789-00</p>
            <p>Banco: Banco do Brasil</p>
          </div>
        )}
        {payment.method === 'boleto' && (
          <div className="mt-4 p-4 bg-amber-50 text-amber-800 rounded text-sm">
            <p>O boleto será gerado após finalizar o pedido.</p>
          </div>
        )}
      </section>
      <button type="submit" className="w-full bg-emerald-600 text-white p-3 rounded font-bold">Finalizar Pedido</button>
    </form>
  );
};
