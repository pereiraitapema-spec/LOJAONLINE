const https = require('https');

https.get('https://www.cepcerto.com/api-calculo-frete-correios', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data.match(/https:\/\/www\.cepcerto\.com\/ws\/json-frete\/[^\"]+/g)));
});
