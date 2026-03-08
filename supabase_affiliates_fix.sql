-- Fix affiliates table structure
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.affiliates ADD COLUMN IF NOT EXISTS email text;

-- Make code nullable because it is generated on approval
ALTER TABLE public.affiliates ALTER COLUMN code DROP NOT NULL;

-- Create affiliate_payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.affiliate_payments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    affiliate_id uuid REFERENCES public.affiliates(id) ON DELETE CASCADE,
    amount decimal(10,2) NOT NULL,
    status text DEFAULT 'pending', -- pending, paid, rejected
    pix_key text,
    receipt_url text,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for affiliates
DROP POLICY IF EXISTS "Users can insert their own affiliate profile" ON public.affiliates;
CREATE POLICY "Users can insert their own affiliate profile" ON public.affiliates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own affiliate profile" ON public.affiliates;
CREATE POLICY "Users can view their own affiliate profile" ON public.affiliates
    FOR SELECT USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Users can update their own affiliate profile" ON public.affiliates;
CREATE POLICY "Users can update their own affiliate profile" ON public.affiliates
    FOR UPDATE USING (auth.uid() = user_id OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

-- RLS Policies for affiliate_payments
DROP POLICY IF EXISTS "Users can view their own payments" ON public.affiliate_payments;
CREATE POLICY "Users can view their own payments" ON public.affiliate_payments
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM public.affiliates WHERE id = affiliate_id AND user_id = auth.uid()
    ) OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));

DROP POLICY IF EXISTS "Admins can manage payments" ON public.affiliate_payments;
CREATE POLICY "Admins can manage payments" ON public.affiliate_payments
    FOR ALL USING (EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    ));
