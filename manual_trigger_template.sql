select net.http_post(
  url := 'https://PROJECT_REF.supabase.co/functions/v1/send-hangyodon-push',
  headers := '{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY","apikey":"SERVICE_ROLE_KEY"}'::jsonb,
  body := '{"pet_id":1,"type":"admin_test","title":"LIVE TEST","body":"manual edge function smoke test"}'::jsonb
);
