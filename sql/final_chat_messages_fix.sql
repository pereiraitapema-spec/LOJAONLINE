-- Final fix for chat_messages table to ensure all messages are saved and visible
-- This script relaxes constraints and ensures policies allow AI and user messages

-- 1. Ensure columns exist and have correct types/nullability
DO $$ 
BEGIN
    -- receiver_id should be nullable (for messages to AI or system)
    ALTER TABLE public.chat_messages ALTER COLUMN receiver_id DROP NOT NULL;
    
    -- sender_id should be nullable (for AI responses)
    ALTER TABLE public.chat_messages ALTER COLUMN sender_id DROP NOT NULL;

    -- Ensure is_human and is_read exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_human') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_human boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_messages' AND column_name='is_read') THEN
        ALTER TABLE public.chat_messages ADD COLUMN is_read boolean DEFAULT false;
    END IF;
END $$;

-- 2. Remove restrictive foreign key constraints that might block lead IDs or nulls
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chat_messages_sender_id_fkey') THEN
        ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_sender_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='chat_messages_receiver_id_fkey') THEN
        ALTER TABLE public.chat_messages DROP CONSTRAINT chat_messages_receiver_id_fkey;
    END IF;
END $$;

-- 3. Reset and simplify RLS policies
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin can read all messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin full access messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated read messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated insert messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Authenticated update messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Admin delete messages" ON public.chat_messages;

-- Policy for Admin (Full Access)
CREATE POLICY "Admin full access messages" ON public.chat_messages 
FOR ALL USING (
    auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

-- Policy for Users (Read their own messages)
CREATE POLICY "Users read own messages" ON public.chat_messages 
FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id OR receiver_id IS NULL
);

-- Policy for Users (Insert messages)
-- Allows any authenticated user to insert (this covers both their messages and AI responses triggered by them)
CREATE POLICY "Users insert messages" ON public.chat_messages 
FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
);

-- Policy for Users (Update messages - e.g. mark as read)
CREATE POLICY "Users update own messages" ON public.chat_messages 
FOR UPDATE USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);

-- 4. Ensure the table is in the realtime publication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END $$;
