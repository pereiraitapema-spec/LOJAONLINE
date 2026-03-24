-- Função para unificar leads pelo email
CREATE OR REPLACE FUNCTION public.unify_leads_by_email()
RETURNS void AS $$
DECLARE
    r RECORD;
    main_lead_id UUID;
BEGIN
    -- Loop por todos os emails que aparecem em mais de um lead
    FOR r IN (
        SELECT email, COUNT(*) 
        FROM public.leads 
        WHERE email IS NOT NULL AND email != ''
        GROUP BY email 
        HAVING COUNT(*) > 1
    ) LOOP
        -- Pegar o ID do lead mais antigo para este email
        SELECT id INTO main_lead_id 
        FROM public.leads 
        WHERE email = r.email 
        ORDER BY created_at ASC 
        LIMIT 1;

        -- Atualizar todas as mensagens para apontarem para o lead principal
        UPDATE public.chat_messages 
        SET sender_id = main_lead_id 
        WHERE sender_id IN (SELECT id FROM public.leads WHERE email = r.email AND id != main_lead_id);

        UPDATE public.chat_messages 
        SET receiver_id = main_lead_id 
        WHERE receiver_id IN (SELECT id FROM public.leads WHERE email = r.email AND id != main_lead_id);

        -- Deletar os leads duplicados
        DELETE FROM public.leads 
        WHERE email = r.email AND id != main_lead_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário: Execute 'SELECT unify_leads_by_email();' no console do Supabase para limpar duplicatas existentes.
