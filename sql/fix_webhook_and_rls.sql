-- Create webhook_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text,
    payload jsonb,
    status text DEFAULT 'pending',
    error text,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS for webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything in webhook_logs
CREATE POLICY "Service role full access" ON public.webhook_logs FOR ALL USING (true);

-- Ensure admins can update orders
DROP POLICY IF EXISTS "Admins can update all orders" ON public.orders;
CREATE POLICY "Admins can update all orders" ON public.orders
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- Ensure anyone can update their own order (for the approved -> paid sync in frontend)
DROP POLICY IF EXISTS "Users can update their own orders" ON public.orders;
CREATE POLICY "Users can update their own orders" ON public.orders
    FOR UPDATE USING (auth.uid() = user_id);
