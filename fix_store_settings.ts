import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase credentials missing in process.env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixStoreSettings() {
  console.log('📦 Iniciando correção das configurações da loja...');
  
  // 1. Buscar todas as configurações
  const { data: settings, error: fetchError } = await supabase
    .from('store_settings')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (fetchError) {
    console.error('❌ Erro ao buscar configurações:', fetchError);
    return;
  }

  if (!settings || settings.length === 0) {
    console.log('⚠️ Nenhuma configuração encontrada. Criando uma nova...');
    const { error: insertError } = await supabase
      .from('store_settings')
      .insert([{
        store_name: 'G-FitLife',
        origin_zip_code: '01001000'
      }]);
    if (insertError) console.error('❌ Erro ao inserir:', insertError);
    else console.log('✅ Configuração inicial criada!');
    return;
  }

  console.log(`📊 Encontradas ${settings.length} linhas de configuração.`);

  // 2. Manter apenas a mais recente e deletar as outras
  const [latest, ...others] = settings;
  
  if (others.length > 0) {
    console.log(`🗑️ Deletando ${others.length} duplicatas...`);
    const { error: deleteError } = await supabase
      .from('store_settings')
      .delete()
      .in('id', others.map(s => s.id));
    
    if (deleteError) console.error('❌ Erro ao deletar duplicatas:', deleteError);
    else console.log('✅ Duplicatas removidas!');
  }

  // 3. Garantir que a mais recente tenha o CEP de origem
  if (!latest.origin_zip_code) {
    console.log('📍 CEP de origem ausente. Definindo padrão: 01001000');
    const { error: updateError } = await supabase
      .from('store_settings')
      .update({ origin_zip_code: '01001000' })
      .eq('id', latest.id);
    
    if (updateError) console.error('❌ Erro ao atualizar CEP:', updateError);
    else console.log('✅ CEP de origem atualizado!');
  } else {
    console.log(`✅ CEP de origem já configurado: ${latest.origin_zip_code}`);
  }
}

fixStoreSettings();
