
const apiKey = 'abdea1be3be8aadf98fdd941455e9db03f39bb5d19c6ff77bbb7533fa81f0e5a3d27c5e081a86d6de11e92b906a6c3ec77896001b2ce1232e1bd64916f5fb485';

async function testCotacao() {
  const body = {
    token_cliente_postagem: apiKey,
    cep_remetente: '88240000',
    cep_destinatario: '01001000',
    peso: '1',
    altura: '20',
    largura: '20',
    comprimento: '20',
    valor_encomenda: '100'
  };

  console.log('Testing api-cotacao...');
  try {
    const res = await fetch('https://cepcerto.com/api-cotacao/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log('Response api-cotacao:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error api-cotacao:', e);
  }

  console.log('\nTesting api-cotacao-frete...');
  try {
    const res = await fetch('https://cepcerto.com/api-cotacao-frete/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    console.log('Response api-cotacao-frete:', JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error api-cotacao-frete:', e);
  }
}

testCotacao();
