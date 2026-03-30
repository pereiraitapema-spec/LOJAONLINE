-- Script para corrigir o erro de recursão infinita nas políticas da tabela profiles
-- Este erro ocorre quando uma política da tabela profiles tenta consultar a própria tabela profiles

-- 1. Criar uma função SECURITY DEFINER para verificar se o usuário é admin
-- O SECURITY DEFINER faz com que a função execute com os privilégios do criador (superusuário),
-- ignorando o RLS da tabela consultada e quebrando a recursão.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Corrigir as políticas da tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remover políticas problemáticas (todas as variações possíveis de nomes)
DROP POLICY IF EXISTS "Perfis são visíveis pelos próprios usuários" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios perfis" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
DROP POLICY IF EXISTS "Perfis visíveis por todos" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

-- Criar novas políticas seguras e sem recursão
-- Usuários podem ver e editar seus próprios perfis
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Admins podem fazer tudo (usando a função is_admin() ou o email master)
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL USING (
        (auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com')
        OR public.is_admin()
    );

-- 3. (Opcional) Atualizar outras tabelas para usar a função is_admin() por performance e clareza
-- Exemplo para orders:
-- DROP POLICY IF EXISTS "Usuários podem ver seus próprios pedidos" ON public.orders;
-- CREATE POLICY "Usuários podem ver seus próprios pedidos" ON public.orders
--     FOR SELECT USING (auth.uid() = user_id OR public.is_admin() OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com');
