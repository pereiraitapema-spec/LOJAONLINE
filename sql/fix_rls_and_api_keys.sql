-- 1. Fix RLS for leads table
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access leads" ON public.leads;
CREATE POLICY "Admin full access leads" ON public.leads
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

DROP POLICY IF EXISTS "Users can view own lead" ON public.leads;
CREATE POLICY "Users can view own lead" ON public.leads
FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own lead" ON public.leads;
CREATE POLICY "Users can insert own lead" ON public.leads
FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own lead" ON public.leads;
CREATE POLICY "Users can update own lead" ON public.leads
FOR UPDATE USING (auth.uid() = id);

-- 2. Fix api_keys table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='api_keys' AND column_name='status') THEN
        ALTER TABLE public.api_keys ADD COLUMN status text DEFAULT 'online';
    END IF;
END $$;

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access api_keys" ON public.api_keys;
CREATE POLICY "Admin full access api_keys" ON public.api_keys
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);

DROP POLICY IF EXISTS "Authenticated read api_keys" ON public.api_keys;
CREATE POLICY "Authenticated read api_keys" ON public.api_keys
FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Ensure profiles RLS allows admin access
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access profiles" ON public.profiles;
CREATE POLICY "Admin full access profiles" ON public.profiles
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) OR auth.jwt() ->> 'email' = 'pereira.itapema@gmail.com'
);
