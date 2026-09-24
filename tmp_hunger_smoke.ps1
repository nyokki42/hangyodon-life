$json = & "$env:APPDATA\npm\supabase.cmd" secrets list --project-ref otyfyfucfqbdboltelsw --output json 2>$null
$secrets = $json | ConvertFrom-Json
$serviceRole = ($secrets | Where-Object { $_.name -eq 'SUPABASE_SERVICE_ROLE_KEY' }).value
$anonKey = ($secrets | Where-Object { $_.name -eq 'SUPABASE_ANON_KEY' }).value

& "$env:APPDATA\npm\supabase.cmd" db query --linked --file .\tmp_hunger_test.sql

Write-Host '---STATE---'
& "$env:APPDATA\npm\supabase.cmd" db query --linked "select id, hunger, mood, sleep_start_at, sleep_end_at, sleep_schedule_date, last_hunger_push_at from public.hangyodon where id = 1;"

Write-Host '---CALL---'
curl.exe -sS -D - -X POST "https://otyfyfucfqbdboltelsw.supabase.co/functions/v1/send-hangyodon-push" -H "Authorization: Bearer $serviceRole" -H "apikey: $anonKey" -H "Content-Type: application/json" --data '{"pet_id":1,"type":"hunger_low"}'

Write-Host ''
Write-Host '---RECENT HISTORY---'
& "$env:APPDATA\npm\supabase.cmd" db query --linked "select id, pet_id, endpoint, notification_type, sent_at, payload from public.push_notification_history order by sent_at desc limit 10;"
