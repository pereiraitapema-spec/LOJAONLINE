import https from 'https';

https.get('https://www.cepcerto.com/api-calculo-frete-correios', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/json-frete[^\"]+/g);
    console.log(matches);
  });
});
