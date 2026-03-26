import fs from 'fs';

const html = fs.readFileSync('cepcerto-doc-full.html', 'utf8');
const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
console.log(text.substring(0, 4000));
