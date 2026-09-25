-- テスト4：睡眠を解除して通常状態に戻す
-- その後、複数端末で同時にアクセスしても値が競合しないことを確認

-- 睡眠時間を解除（または未来の時刻に設定）
UPDATE public.hangyodon
SET
  sleep_start_at = '2026-09-25 23:00:00+00',
  sleep_end_at = '2026-09-26 07:00:00+00'
WHERE id = 1;

-- 状態確認
SELECT id, hunger, mood, started_at, sleep_start_at, sleep_end_at 
FROM public.hangyodon 
WHERE id = 1;

-- Cron を 3 度実行（複数端末が同時にアクセスしたことをシミュレート）
UPDATE public.hangyodon
SET
  hunger = greatest(0, hunger - 1),
  mood = greatest(-100, mood - 1),
  last_updated = now()
WHERE id = 1 AND NOT (sleep_start_at IS NOT NULL AND sleep_end_at IS NOT NULL AND now() >= sleep_start_at AND now() < sleep_end_at);

-- 最終状態確認
SELECT id, hunger, mood, started_at 
FROM public.hangyodon 
WHERE id = 1;
