-- Adicionar coluna is_human se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_human') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_human boolean DEFAULT false;
    END IF;
END $$;

-- Garantir que receiver_id seja opcional ou que o placeholder exista
-- Como receiver_id é NOT NULL e referencia auth.users, precisamos garantir que o placeholder exista
-- Ou mudar para opcional. Vamos mudar para opcional para evitar erros de FK em chats de IA.
ALTER TABLE public.chat_messages ALTER COLUMN receiver_id DROP NOT NULL;

-- Atualizar políticas de RLS para permitir receiver_id nulo
DROP POLICY IF EXISTS "Users can read their own messages" ON public.chat_messages;
CREATE POLICY "Users can read their own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR receiver_id IS NULL);

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
CREATE POLICY "Users can insert their own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
