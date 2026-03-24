-- Remover restrições de chave estrangeira que impedem o uso de IDs de leads na tabela chat_messages
DO $$ 
BEGIN 
    -- Remover restrição de sender_id se existir
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chat_messages_sender_id_fkey') THEN
        ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_sender_id_fkey;
    END IF;

    -- Remover restrição de receiver_id se existir
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chat_messages_receiver_id_fkey') THEN
        ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_receiver_id_fkey;
    END IF;
END $$;

-- Garantir que as colunas necessárias existam
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_human') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_human boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_read') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_read boolean DEFAULT false;
    END IF;
END $$;

-- Atualizar políticas de RLS para serem mais abrangentes para o admin
DROP POLICY IF EXISTS "Admin full access messages" ON public.chat_messages;
CREATE POLICY "Admin full access messages" ON public.chat_messages 
  FOR ALL USING (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

-- Permitir que usuários autenticados (admins) leiam mensagens
DROP POLICY IF EXISTS "Authenticated read messages" ON public.chat_messages;
CREATE POLICY "Authenticated read messages" ON public.chat_messages 
  FOR SELECT USING (auth.role() = 'authenticated');

-- Permitir que usuários autenticados (admins) insiram mensagens
DROP POLICY IF EXISTS "Authenticated insert messages" ON public.chat_messages;
CREATE POLICY "Authenticated insert messages" ON public.chat_messages 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Permitir que usuários autenticados (admins) atualizem mensagens (ex: marcar como lida)
DROP POLICY IF EXISTS "Authenticated update messages" ON public.chat_messages;
CREATE POLICY "Authenticated update messages" ON public.chat_messages 
  FOR UPDATE USING (auth.role() = 'authenticated');
