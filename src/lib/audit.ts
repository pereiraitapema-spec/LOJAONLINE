import { supabase } from '../lib/supabase';

export const logAction = async (action: string, tableName: string, recordId: string, oldData: any, newData: any) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from('audit_logs').insert({
    user_id: session.user.id,
    action,
    table_name: tableName,
    record_id: recordId,
    old_data: oldData,
    new_data: newData
  });
};
