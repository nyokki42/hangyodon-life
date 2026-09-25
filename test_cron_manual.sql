-- Cron テスト: 手動で hunger/mood 減少処理を実行
-- 本来は5分ごとに自動実行されるが、テスト用に手動実行

-- 現在の状態を記録
SELECT id, hunger, mood, started_at, last_updated, sleep_start_at, sleep_end_at 
FROM public.hangyodon 
WHERE id = 1;

-- Cron と同じ UPDATE を実行（睡眠中でない場合）
UPDATE public.hangyodon
SET
  hunger = greatest(0, hunger - 1),
  mood = greatest(-100, mood - 1),
  last_updated = now()
WHERE 
  id = 1
  AND NOT (sleep_start_at IS NOT NULL AND sleep_end_at IS NOT NULL AND now() >= sleep_start_at AND now() < sleep_end_at);

-- 更新後を確認
SELECT id, hunger, mood, started_at, last_updated, sleep_start_at, sleep_end_at 
FROM public.hangyodon 
WHERE id = 1;
