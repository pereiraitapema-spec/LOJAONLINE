import https from 'https';
import fs from 'fs';

https.get('https://www.cepcerto.com/api-calculo-frete-correios', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('cepcerto-doc-full.html', data);
  });
});
