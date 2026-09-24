-- 共有育成用テーブル
create table if not exists public.hangyodon (
  id bigint primary key,
  hunger integer not null default 100,
  mood integer not null default 100,
  level integer not null default 1,
  exp integer not null default 0,
  money integer not null default 100,
  last_updated timestamptz not null default now()
);

-- 共有データとして 1 匹のみ使用
insert into public.hangyodon (id, hunger, mood, level, exp, money, last_updated)
values (1, 100, 100, 1, 0, 100, now())
on conflict (id) do nothing;

-- RLS を有効化
alter table public.hangyodon enable row level security;

-- すべての読み書きを許可（公開前提の簡易構成）
create policy if not exists "Allow all access to hangyodon"
  on public.hangyodon
  for all
  using (true)
  with check (true);

-- Realtime を有効化
alter publication supabase_realtime add table public.hangyodon;
