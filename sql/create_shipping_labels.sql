-- Migration to create shipping_labels table and ensure unique constraint on codigo_objeto
CREATE TABLE IF NOT EXISTS public.shipping_labels (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id),
    codigo_objeto text UNIQUE NOT NULL,
    nome_destinatario text,
    whatsapp_destinatario text,
    cidade_destinatario text,
    estado_destinatario text,
    cep_destinatario text,
    email_destinatario text,
    valor numeric DEFAULT 0,
    prazo text,
    status text DEFAULT 'ativa',
    pdf_url_etiqueta text,
    pdf_url_declaracao text,
    id_recibo text,
    id_string_correios text,
    token text,
    transportadora text DEFAULT 'Correios',
    tipo_entrega text DEFAULT 'PAC',
    data_postagem timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.shipping_labels ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Admins can do everything with shipping labels" ON public.shipping_labels;
CREATE POLICY "Admins can do everything with shipping labels" ON public.shipping_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        ) OR (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com')
    );

DROP POLICY IF EXISTS "Users can view their own labels" ON public.shipping_labels;
CREATE POLICY "Users can view their own labels" ON public.shipping_labels
    FOR SELECT USING (auth.uid() = user_id);
