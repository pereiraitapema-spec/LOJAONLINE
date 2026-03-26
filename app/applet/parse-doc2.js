import fs from 'fs';

const html = fs.readFileSync('cepcerto-doc-full.html', 'utf8');
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const idx = text.indexOf('Como Funciona?');
console.log(text.substring(idx, idx + 2000));
