import https from 'https';

https.get('https://www.cepcerto.com/ws/json-frete/01001000/20010010/300/2/11/16/dummy_token', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Body:', data));
});
