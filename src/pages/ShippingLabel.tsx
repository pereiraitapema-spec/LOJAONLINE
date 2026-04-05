import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Printer } from 'lucide-react';
import { Loading } from '../components/Loading';

export default function ShippingLabel() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [descricao, setDescricao] = useState('Frasco');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!orderId) return;
      try {
        const [orderRes, settingsRes, configRes] = await Promise.all([
          supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single(),
          supabase
            .from('store_settings')
            .select('*')
            .maybeSingle(),
          supabase
            .from('shipping_label_config')
            .select('descricao')
            .eq('id', '0000000000000000000000000001')
            .maybeSingle()
        ]);
        
        if (orderRes.error) throw orderRes.error;
        setOrder(orderRes.data);
        setSettings(settingsRes.data);
        if (configRes.data) setDescricao(configRes.data.descricao);
      } catch (err) {
        console.error('Error fetching data for label:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  const salvarConfiguracao = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("shipping_label_config")
        .upsert({
          id: "0000000000000000000000000001",
          descricao: descricao,
          tipo_doc_fiscal: "declaracao",
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
      alert("Configuração salva com sucesso!");
    } catch (err) {
      console.error('Error saving config:', err);
      alert("Erro ao salvar configuração.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading message="Carregando etiqueta..." />;
  if (!order) return <div className="p-8 text-center text-rose-600 font-bold">Pedido não encontrado.</div>;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-8 print:p-0 print:bg-white">
      {/* Controles (Não aparecem na impressão) */}
      <div className="max-w-3xl mx-auto mb-8 print:hidden">
        <div className="bg-white p-6 rounded-xl shadow-sm mb-6 border border-slate-200">
          <h3 className="font-bold text-lg mb-4">Configuração da Declaração</h3>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-bold text-slate-600 mb-1">Descrição Produto:</label>
              <input 
                type="text" 
                value={descricao} 
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              />
            </div>
            <button 
              onClick={salvarConfiguracao}
              disabled={saving}
              className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-700 transition-colors"
            >
              {saving ? 'Salvando...' : 'Salvar Configuração'}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button 
            onClick={() => {
              const params = new URLSearchParams(window.location.search);
              if (params.get('from') === 'cepcerto') {
                navigate('/shipping/cepcerto');
              } else {
                navigate('/orders');
              }
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold"
          >
            <ArrowLeft size={20} /> 
            {new URLSearchParams(window.location.search).get('from') === 'cepcerto' ? 'Voltar para Logística CepCerto' : 'Voltar para Pedidos'}
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
          >
            <Printer size={20} /> Imprimir Etiqueta
          </button>
        </div>
      </div>

      {/* Etiqueta (Aparece na impressão) */}
      <div className="max-w-[10cm] mx-auto bg-white border-2 border-black p-4 print:border-none print:m-0 print:w-[10cm] print:h-[15cm]">
        
        {/* Cabeçalho Correios */}
        <div className="flex justify-between items-start border-b-2 border-black pb-2 mb-2">
          <div className="w-1/3">
            <svg viewBox="0 0 200 50" className="w-full h-auto fill-black">
              <path d="M40 10 L60 10 L50 30 Z M70 10 L90 10 L80 30 Z" />
              <text x="10" y="45" fontFamily="Arial" fontSize="24" fontWeight="bold">Correios</text>
            </svg>
          </div>
          <div className="w-1/3 flex justify-center">
            {/* Mock QR Code */}
            <div className="w-16 h-16 bg-black" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #fff 25%, #fff 75%, #000 75%, #000)', backgroundPosition: '0 0, 4px 4px', backgroundSize: '8px 8px' }}></div>
          </div>
          <div className="w-1/3 flex justify-end">
            <div className="w-12 h-12 rounded-full border-4 border-black border-t-transparent transform rotate-45"></div>
          </div>
        </div>

        {/* Info Contrato */}
        <div className="flex justify-between text-[10px] font-bold mb-2">
          <span>Contrato: {order.shipping_config?.contract || '9912632293'}</span>
          <span className="uppercase">{order.shipping_method || 'SEDEX'}</span>
          <span>Peso(g): {order.total_weight || '1000'}</span>
        </div>

        {/* Código de Rastreio */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-black tracking-widest">{order.tracking_code || 'BR123456789BR'}</h2>
          {/* Barcode Simulado */}
          <div className="h-16 w-full bg-white border border-black flex items-end justify-around px-1 py-1 mt-1 overflow-hidden">
            {Array.from({ length: 60 }).map((_, i) => (
              <div 
                key={i} 
                className="bg-black" 
                style={{ 
                  width: Math.random() > 0.7 ? '3px' : '1px',
                  height: `${70 + Math.random() * 30}%`
                }}
              ></div>
            ))}
          </div>
        </div>

        {/* Recebedor */}
        <div className="border-t border-black pt-2 mb-2 text-[9px]">
          <div className="flex justify-between mb-1">
            <span className="w-20">Recebedor:</span>
            <div className="flex-1 border-b border-black"></div>
          </div>
          <div className="flex justify-between mb-1">
            <span className="w-20">Assinatura:</span>
            <div className="flex-1 border-b border-black mr-2"></div>
            <span className="w-20">Documento:</span>
            <div className="flex-1 border-b border-black"></div>
          </div>
        </div>

        {/* Destinatário */}
        <div className="border-t-2 border-black pt-2">
          <div className="bg-black text-white text-[10px] font-bold px-2 py-0.5 inline-block mb-1">DESTINATÁRIO</div>
          <div className="text-sm font-black uppercase">{order.customer_name}</div>
          <div className="text-[11px] leading-tight">
            {order.shipping_address?.street}, {order.shipping_address?.number}
            {order.shipping_address?.complement && ` - ${order.shipping_address.complement}`}
          </div>
          <div className="text-[11px] leading-tight">
            {order.shipping_address?.neighborhood}
          </div>
          <div className="text-sm font-black mt-1">
            {order.shipping_address?.zipCode} {order.shipping_address?.city}/{order.shipping_address?.state}
          </div>
          
          {/* Barcode CEP Simulado */}
          <div className="h-10 w-2/3 bg-white border border-black flex items-end justify-around px-1 py-1 mt-2 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div 
                key={i} 
                className="bg-black" 
                style={{ 
                  width: Math.random() > 0.7 ? '3px' : '1px',
                  height: `${60 + Math.random() * 40}%`
                }}
              ></div>
            ))}
          </div>
        </div>

        {/* Remetente */}
        <div className="mt-4 border-t border-dashed border-black pt-2 text-[9px]">
          <div className="font-bold uppercase mb-1">Remetente:</div>
          <div className="font-bold uppercase">{settings?.company_name || 'Magnifique4Life'}</div>
          <div>{settings?.address || 'Rua Exemplo, 123 - Centro'}</div>
          <div>{settings?.cep || '88330-000'} {settings?.city || 'Balneário Camboriú'}/{settings?.state || 'SC'}</div>
        </div>

      </div>
    </div>
  );
}
