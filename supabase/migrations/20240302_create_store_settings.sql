CREATE TABLE IF NOT EXISTS store_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name TEXT DEFAULT 'MAGNIFIQUE 4LIFE',
  cnpj TEXT DEFAULT '33.499.263/0001-46',
  address TEXT DEFAULT 'R: Prefeito Manoel Evaldo Muller - Nº: 4250 - Navegantes/SC',
  cep TEXT DEFAULT '88371-79058',
  phone TEXT DEFAULT '(47) 996609618',
  whatsapp TEXT DEFAULT '(47) 984748124',
  email TEXT DEFAULT 'contato@magnifique4life.com.br',
  instagram TEXT DEFAULT '',
  facebook TEXT DEFAULT '',
  business_hours TEXT DEFAULT 'Segunda a Sexta - 8h ás 18h',
  business_hours_details TEXT DEFAULT 'Segunda a Sexta - das 8h ás 18h com agendamento prévio. Sábados, Domingos e Feriados, mediante disponibilidade.',
  payment_methods JSONB DEFAULT '[]'::jsonb,
  institutional_links JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Insert default row if not exists
INSERT INTO store_settings (id)
SELECT uuid_generate_v4()
WHERE NOT EXISTS (SELECT 1 FROM store_settings);

-- Add RLS policies
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to store_settings"
  ON store_settings FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to update store_settings"
  ON store_settings FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to insert store_settings"
  ON store_settings FOR INSERT
  USING (auth.role() = 'authenticated');
