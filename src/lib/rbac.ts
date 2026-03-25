import { supabase } from '../lib/supabase';

export const checkPermission = async (userId: string, requiredRole: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();
  
  if (error || !data) return false;
  
  // Define hierarchy: sales < stock < manager < admin
  const roles = ['sales', 'stock', 'manager', 'admin'];
  return roles.indexOf(data.role) >= roles.indexOf(requiredRole);
};
