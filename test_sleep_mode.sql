-- テスト3：睡眠時間中は hunger/mood が減少しないことを確認

-- 現在の値を記録
SELECT id, hunger, mood, sleep_start_at, sleep_end_at 
FROM public.hangyodon 
WHERE id = 1;

-- 睡眠時間を現在時刻を含む時間に設定
-- 例：22:00 ～ 06:00
UPDATE public.hangyodon
SET
  sleep_start_at = now() - interval '2 hours',
  sleep_end_at = now() + interval '4 hours'
WHERE id = 1;

-- 状態確認
SELECT id, hunger, mood, sleep_start_at, sleep_end_at, now() AS current_time
FROM public.hangyodon 
WHERE id = 1;

-- Cron と同じ UPDATE を実行（睡眠中なので減少しないはず）
UPDATE public.hangyodon
SET
  hunger = greatest(0, hunger - 1),
  mood = greatest(-100, mood - 1),
  last_updated = now()
WHERE 
  id = 1
  AND NOT (sleep_start_at IS NOT NULL AND sleep_end_at IS NOT NULL AND now() >= sleep_start_at AND now() < sleep_end_at);

-- 更新結果を確認（hunger/mood が変わらないはず）
SELECT id, hunger, mood, sleep_start_at, sleep_end_at
FROM public.hangyodon 
WHERE id = 1;
