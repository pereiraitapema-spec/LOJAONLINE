import fs from 'fs';

function replaceCurrency(filePath: string) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace R$ ${value.toFixed(2)} with {formatCurrency(value)}
  // Handle cases like R$ {(value).toFixed(2)}
  // Handle cases like R$ {value.toFixed(2)}
  
  // Regex to match R$ ${...toFixed(2)}
  const regex1 = /R\$\s*\{\s*\(([^)]+)\)\.toFixed\(2\)\s*\}/g;
  content = content.replace(regex1, '{formatCurrency($1)}');
  
  const regex2 = /R\$\s*\{\s*([^}]+)\.toFixed\(2\)\s*\}/g;
  content = content.replace(regex2, '{formatCurrency($1)}');
  
  // Also handle cases like `R$ ${value.toFixed(2)}` in template strings
  const regex3 = /R\$\s*\$\{\s*\(([^)]+)\)\.toFixed\(2\)\s*\}/g;
  content = content.replace(regex3, '${formatCurrency($1)}');
  
  const regex4 = /R\$\s*\$\{\s*([^}]+)\.toFixed\(2\)\s*\}/g;
  content = content.replace(regex4, '${formatCurrency($1)}');

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`Replaced currency in ${filePath}`);
}

replaceCurrency('src/pages/Store.tsx');
replaceCurrency('src/pages/Checkout.tsx');
replaceCurrency('src/pages/Orders.tsx');
