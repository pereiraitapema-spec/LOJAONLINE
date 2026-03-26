import https from 'https';

const req = https.request('https://www.cepcerto.com/ws/json-frete/01001000/20010010/500/10/11/16/teste', {
  method: 'GET',
  headers: {
    'Origin': 'https://example.com'
  }
}, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', res.headers);
});
req.end();
