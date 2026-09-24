$ErrorActionPreference = 'Stop'

$json = & "$env:APPDATA\npm\supabase.cmd" secrets list --project-ref otyfyfucfqbdboltelsw --output json 2>$null
$secrets = $json | ConvertFrom-Json
$serviceRole = ($secrets | Where-Object { $_.name -eq 'SUPABASE_SERVICE_ROLE_KEY' }).value
$projectRef = 'otyfyfucfqbdboltelsw'
$template = Get-Content .\live_cron_template.sql -Raw
$finalSql = $template.Replace('PROJECT_REF', $projectRef).Replace('SERVICE_ROLE_KEY', $serviceRole)
$finalSql | Set-Content .\live_cron_apply.sql

Write-Host '---DB QUERY---'
& "$env:APPDATA\npm\supabase.cmd" db query --linked --file .\live_cron_apply.sql

Write-Host '---JOB CHECK---'
& "$env:APPDATA\npm\supabase.cmd" db query --linked --file .\live_cron_check.sql

Write-Host '---MANUAL EDGE FUNCTION TEST---'
$url = "https://$projectRef.supabase.co/functions/v1/send-hangyodon-push"
$body = '{"pet_id":1,"type":"admin_test","title":"LIVE TEST","body":"manual edge function smoke test"}'
$resp = Invoke-WebRequest -Uri $url -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $serviceRole"; apikey = $serviceRole } -Body $body
Write-Host "HTTP $($resp.StatusCode)"
Write-Host $resp.Content
