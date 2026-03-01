-- Tabela para armazenar chaves de API de forma dinâmica
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    service TEXT NOT NULL, -- 'gemini', 'openai', etc.
    key_value TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (apenas admins podem ver/editar)
-- Assumindo que o admin tem role 'admin' no profiles ou email específico
CREATE POLICY "Admins can manage api_keys" ON public.api_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Inserir chave inicial se houver uma no ambiente (opcional, mas bom para migração)
-- Nota: Não temos acesso direto às env vars aqui no SQL, então deixamos vazio ou para o app preencher.
