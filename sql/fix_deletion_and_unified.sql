-- Habilitar DELETE para Leads e Chat Messages
DROP POLICY IF EXISTS "Admin delete leads" ON public.leads;
CREATE POLICY "Admin delete leads" ON public.leads 
  FOR DELETE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin delete messages" ON public.chat_messages;
CREATE POLICY "Admin delete messages" ON public.chat_messages 
  FOR DELETE USING (auth.role() = 'authenticated');

-- Garantir que o admin (email específico) tenha acesso total
DROP POLICY IF EXISTS "Admin full access leads" ON public.leads;
CREATE POLICY "Admin full access leads" ON public.leads 
  FOR ALL USING (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

DROP POLICY IF EXISTS "Admin full access messages" ON public.chat_messages;
CREATE POLICY "Admin full access messages" ON public.chat_messages 
  FOR ALL USING (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');

-- Adicionar coluna para marcar mensagens como deletadas (opcional, mas útil para o que o usuário relatou)
-- Se eles querem deletar e não voltar, o DELETE acima resolve. 
-- Mas se eles estão deletando no front e não no banco, precisamos do DELETE.
