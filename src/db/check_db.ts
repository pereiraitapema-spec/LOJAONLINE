import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  console.log('Verificando conexão com Supabase...');
  
  const tables = ['products', 'categories', 'orders', 'profiles', 'product_tiers', 'product_media', 'api_keys', 'banners'];
  let missingTables = [];

  for (const table of tables) {
    const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
    if (error && error.code === '42P01') { // undefined_table
      missingTables.push(table);
    } else if (error) {
      console.error(`Erro ao verificar tabela ${table}:`, error.message);
    } else {
      console.log(`✅ Tabela '${table}' encontrada.`);
    }
  }

  if (missingTables.length > 0) {
    console.warn('\n⚠️  ATENÇÃO: As seguintes tabelas não foram encontradas no banco de dados:');
    missingTables.forEach(t => console.warn(`   - ${t}`));
    console.warn('\nPor favor, copie o conteúdo de "src/db/schema.sql" e execute no Editor SQL do Supabase.');
  } else {
    console.log('\n🎉 Todas as tabelas essenciais foram encontradas!');
  }
}

checkTables();
