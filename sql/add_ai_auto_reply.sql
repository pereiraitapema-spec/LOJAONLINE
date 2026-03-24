-- Adicionar coluna ai_auto_reply à tabela leads
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='leads' AND column_name='ai_auto_reply') THEN
        ALTER TABLE public.leads ADD COLUMN ai_auto_reply boolean DEFAULT true;
    END IF;
END $$;

-- Adicionar coluna is_human à tabela chat_messages se não existir (garantia)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_human') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_human boolean DEFAULT false;
    END IF;
END $$;
