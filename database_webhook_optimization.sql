-- 1. Criar índice para performance
create index if not exists idx_webhook_event on webhook_logs(event_type);

-- 2. Função para limitar a 100 registros
create or replace function limit_webhook_logs()
returns trigger as $$
begin
  delete from webhook_logs
  where id in (
    select id
    from webhook_logs
    order by created_at asc
    offset 100
  );
  return new;
end;
$$ language plpgsql;

-- 3. Trigger para executar a limpeza após cada inserção
drop trigger if exists trigger_limit_webhook_logs on webhook_logs;
create trigger trigger_limit_webhook_logs
after insert on webhook_logs
for each statement
execute function limit_webhook_logs();
