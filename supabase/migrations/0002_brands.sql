-- Brands within a client (franchisees, sister brands). A review link can belong to one brand,
-- in which case it only shows that brand's work. Safe to run more than once.
alter table public.review_links add column if not exists brand_id text;
create index if not exists review_links_brand_idx on public.review_links(client_id, brand_id);
