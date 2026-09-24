-- 共有育成用テーブル
create table if not exists public.hangyodon (
  id bigint primary key,
  hunger integer not null default 100,
  mood integer not null default 100,
  level integer not null default 1,
  exp integer not null default 0,
  money integer not null default 100,
  inventory jsonb not null default '{}'::jsonb,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  sleep_schedule_date text,
  last_updated timestamptz not null default now(),
  last_hunger_push_at timestamptz
);

-- 既存の行があれば壊さない
insert into public.hangyodon (id, hunger, mood, level, exp, money, inventory, sleep_start_at, sleep_end_at, sleep_schedule_date, last_updated)
values (1, 100, 100, 1, 0, 100, '{}'::jsonb, null, null, null, now())
on conflict (id) do nothing;

-- 既存レコードに sleep 系列がなければ追加
alter table public.hangyodon
  add column if not exists sleep_start_at timestamptz,
  add column if not exists sleep_end_at timestamptz,
  add column if not exists sleep_schedule_date text;

-- 既存レコードに inventory 列がなければ追加
alter table public.hangyodon
  add column if not exists inventory jsonb not null default '{}'::jsonb;

-- 既存のデータに対して inventory を安全に埋める
update public.hangyodon
set inventory = coalesce(inventory, '{}'::jsonb)
where inventory is null;

-- RLS を有効化
alter table public.hangyodon enable row level security;

-- id=1 のみ許可する最小ポリシー
create policy if not exists "hangyodon_select_id_1"
  on public.hangyodon
  for select
  using (id = 1);

create policy if not exists "hangyodon_insert_id_1"
  on public.hangyodon
  for insert
  with check (id = 1);

create policy if not exists "hangyodon_update_id_1"
  on public.hangyodon
  for update
  using (id = 1)
  with check (id = 1);

-- Web Push で使う購読情報
create table if not exists public.push_subscriptions (
  id bigserial primary key,
  pet_id bigint not null default 1,
  endpoint text not null unique,
  p256dh text,
  auth text,
  is_active boolean not null default true,
  platform text not null default 'browser',
  device_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_notification_history (
  id bigserial primary key,
  pet_id bigint not null default 1,
  endpoint text not null,
  notification_type text not null default 'hunger_low',
  sent_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (pet_id, endpoint, notification_type, (date(sent_at)))
);

alter table public.push_subscriptions enable row level security;
alter table public.push_notification_history enable row level security;

create policy if not exists "push_subscriptions_select_id_1"
  on public.push_subscriptions
  for select
  using (pet_id = 1);

create policy if not exists "push_subscriptions_insert_id_1"
  on public.push_subscriptions
  for insert
  with check (pet_id = 1);

create policy if not exists "push_subscriptions_update_id_1"
  on public.push_subscriptions
  for update
  using (pet_id = 1)
  with check (pet_id = 1);

create policy if not exists "push_subscriptions_delete_id_1"
  on public.push_subscriptions
  for delete
  using (pet_id = 1);

create policy if not exists "push_history_select_id_1"
  on public.push_notification_history
  for select
  using (pet_id = 1);

create policy if not exists "push_history_insert_id_1"
  on public.push_notification_history
  for insert
  with check (pet_id = 1);

create index if not exists push_subscriptions_pet_active_idx
  on public.push_subscriptions (pet_id, is_active);

create index if not exists push_notification_history_pet_type_idx
  on public.push_notification_history (pet_id, notification_type, sent_at desc);

-- Realtime を有効化（存在する場合のみ）
alter publication supabase_realtime add table public.hangyodon;
