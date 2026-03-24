-- Function to prune chat messages for a specific conversation to keep only the last 100 messages
CREATE OR REPLACE FUNCTION public.prune_chat_messages()
RETURNS TRIGGER AS $$
BEGIN
    -- Delete messages for the same conversation if count > 100
    -- We consider a conversation as messages between two specific IDs
    DELETE FROM public.chat_messages
    WHERE id IN (
        SELECT id
        FROM public.chat_messages
        WHERE (sender_id = NEW.sender_id AND (receiver_id = NEW.receiver_id OR (NEW.receiver_id IS NULL AND receiver_id IS NULL)))
           OR (sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id)
        ORDER BY created_at DESC
        OFFSET 100
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to prune after insert
DROP TRIGGER IF EXISTS on_chat_message_inserted ON public.chat_messages;
CREATE TRIGGER on_chat_message_inserted
    AFTER INSERT ON public.chat_messages
    FOR EACH ROW EXECUTE PROCEDURE public.prune_chat_messages();
