import https from 'https';

const req = https.request('https://www.cepcerto.com/ws/json-frete/01001000/20010010/1/20/20/20/teste', {
  method: 'GET',
  headers: {
    'Origin': 'https://example.com'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
});
req.end();
