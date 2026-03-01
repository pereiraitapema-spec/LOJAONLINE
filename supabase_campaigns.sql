CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT,
    rules_text TEXT,
    link_url TEXT,
    active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Campaigns are viewable by everyone."
    ON public.campaigns FOR SELECT
    USING (true);

CREATE POLICY "Campaigns are insertable by authenticated users."
    ON public.campaigns FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Campaigns are updatable by authenticated users."
    ON public.campaigns FOR UPDATE
    USING (auth.role() = 'authenticated');

CREATE POLICY "Campaigns are deletable by authenticated users."
    ON public.campaigns FOR DELETE
    USING (auth.role() = 'authenticated');
