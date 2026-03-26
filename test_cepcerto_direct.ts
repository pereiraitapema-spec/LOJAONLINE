const originZip = '88240000';
const destZipCode = '01001000';
const totalWeightInGrams = 300;
const maxDim = { h: 2, w: 11, l: 16 };
const apiKey = 'qtymObObUhsL7yNthdDsY7aa-7erCKKaMLCGO6CbGxLXYNPmf92sBFg';

const baseUrl = `https://www.cepcerto.com/ws/json-frete/${originZip}/${destZipCode}/${totalWeightInGrams}/${maxDim.h}/${maxDim.w}/${maxDim.l}/${apiKey}`;

async function testCepCerto() {
  console.log('🔗 URL CepCerto:', baseUrl);
  try {
    const response = await fetch(baseUrl);
    if (response.ok) {
      const text = await response.text();
      console.log('📦 Resposta CepCerto (Text):', text);
      try {
        const data = JSON.parse(text);
        console.log('📦 Resposta CepCerto (JSON):', JSON.stringify(data, null, 2));
      } catch (e) {
        console.error('❌ Erro ao fazer parse da resposta do CepCerto:', text);
      }
    } else {
      console.error('❌ Erro na resposta do CepCerto:', response.status, response.statusText);
    }
  } catch (err) {
    console.error('CepCerto API Error:', err);
  }
}

testCepCerto();
