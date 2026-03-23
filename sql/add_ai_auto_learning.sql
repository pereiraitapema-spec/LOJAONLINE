-- Adicionar coluna ai_auto_learning na tabela store_settings
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'store_settings' and column_name = 'ai_auto_learning') then
        alter table public.store_settings add column ai_auto_learning boolean default false;
    end if;
end $$;
