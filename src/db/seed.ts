import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log('Iniciando seed...');

  // 1. Categorias
  const categories = [
    { name: 'Eletrônicos', slug: 'eletronicos', active: true },
    { name: 'Roupas', slug: 'roupas', active: true },
    { name: 'Casa', slug: 'casa', active: true },
  ];

  for (const cat of categories) {
    const { data, error } = await supabase
      .from('categories')
      .upsert(cat, { onConflict: 'slug' })
      .select();
    
    if (error) console.error(`Erro ao inserir categoria ${cat.name}:`, error.message);
    else console.log(`Categoria inserida: ${cat.name}`);
  }

  // 2. Produtos (Exemplo)
  const { data: catData } = await supabase.from('categories').select('id').eq('slug', 'eletronicos').single();
  
  if (catData) {
    const products = [
      {
        name: 'Smartphone X',
        slug: 'smartphone-x',
        category_id: catData.id,
        price: 2999.90,
        stock: 50,
        description: 'O melhor smartphone do mercado.',
        active: true
      },
      {
        name: 'Fone Bluetooth',
        slug: 'fone-bluetooth',
        category_id: catData.id,
        price: 199.90,
        stock: 100,
        description: 'Som de alta qualidade.',
        active: true
      }
    ];

    for (const prod of products) {
      const { error } = await supabase
        .from('products')
        .upsert(prod, { onConflict: 'slug' });
      
      if (error) console.error(`Erro ao inserir produto ${prod.name}:`, error.message);
      else console.log(`Produto inserido: ${prod.name}`);
    }
  }

  console.log('Seed concluído!');
}

seed();
