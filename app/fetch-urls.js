import fs from 'fs';
import https from 'https';

https.get('https://www.cepcerto.com/api-calculo-frete-correios', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/https:\/\/www\.cepcerto\.com\/ws\/json-frete\/[^\"]+/g);
    fs.writeFileSync('cepcerto-urls.txt', matches ? matches.join('\n') : 'no matches');
  });
});
