-- Add affiliate_id to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.affiliates(id);

-- Enable RLS for leads
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Policy for affiliates to see their own leads
DROP POLICY IF EXISTS "Affiliates can view their own leads" ON public.leads;
CREATE POLICY "Affiliates can view their own leads" ON public.leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.affiliates 
            WHERE id = leads.affiliate_id AND user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for anyone to insert a lead (needed for the store)
DROP POLICY IF EXISTS "Anyone can insert a lead" ON public.leads;
CREATE POLICY "Anyone can insert a lead" ON public.leads
    FOR INSERT WITH CHECK (true);

-- Policy for admins to manage leads
DROP POLICY IF EXISTS "Admins can manage leads" ON public.leads;
CREATE POLICY "Admins can manage leads" ON public.leads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );
