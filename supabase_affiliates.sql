-- Migration for Affiliate System Enhancements

-- 1. Add missing columns to affiliates table
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'whatsapp') then
        alter table public.affiliates add column whatsapp text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'social_media') then
        alter table public.affiliates add column social_media text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'website') then
        alter table public.affiliates add column website text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'other_media') then
        alter table public.affiliates add column other_media text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'observation') then
        alter table public.affiliates add column observation text;
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'affiliates' and column_name = 'status') then
        alter table public.affiliates add column status text default 'pending';
    end if;
end $$;

-- 2. Create affiliate_coupons table
create table if not exists public.affiliate_coupons (
    id uuid default gen_random_uuid() primary key,
    affiliate_id uuid references public.affiliates(id) on delete cascade,
    code text not null unique,
    discount_percentage numeric not null check (discount_percentage > 0 and discount_percentage <= 10),
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS for affiliate_coupons
alter table public.affiliate_coupons enable row level security;

drop policy if exists "Enable read access for all users" on public.affiliate_coupons;
create policy "Enable read access for all users" on public.affiliate_coupons for select using (true);

drop policy if exists "Enable insert for affiliates" on public.affiliate_coupons;
create policy "Enable insert for affiliates" on public.affiliate_coupons for insert with check (
    auth.uid() in (select user_id from public.affiliates where id = affiliate_id)
);

drop policy if exists "Enable update for affiliates" on public.affiliate_coupons;
create policy "Enable update for affiliates" on public.affiliate_coupons for update using (
    auth.uid() in (select user_id from public.affiliates where id = affiliate_id)
);

drop policy if exists "Enable delete for affiliates" on public.affiliate_coupons;
create policy "Enable delete for affiliates" on public.affiliate_coupons for delete using (
    auth.uid() in (select user_id from public.affiliates where id = affiliate_id)
);

-- 4. Add affiliate_id to orders table
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'orders' and column_name = 'affiliate_id') then
        alter table public.orders add column affiliate_id uuid references public.affiliates(id);
    end if;
end $$;
