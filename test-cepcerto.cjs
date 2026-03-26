const http = require('http');
http.get('http://www.cepcerto.com/ws/json-frete/88240000/88240000/1/16/16/11/0/todos/chave', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(data));
});
