const https = require('https');
https.get('https://html.duckduckgo.com/html/?q=cepcerto+api+json-frete', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const matches = data.match(/href="([^"]+)"/g);
    console.log(matches.slice(0, 20));
  });
});
