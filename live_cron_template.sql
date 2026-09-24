create extension if not exists pg_cron;

select cron.schedule(
  'hangyodon-hunger-push-every-5m',
  '*/5 * * * *',
  'select net.http_post(
      url := ''https://PROJECT_REF.supabase.co/functions/v1/send-hangyodon-push'',
      headers := ''{"Content-Type":"application/json","Authorization":"Bearer SERVICE_ROLE_KEY"}''::jsonb,
      body := ''{"pet_id":1,"type":"hunger_low"}''::jsonb
    );'
)
where not exists (
  select 1
  from cron.job
  where jobname = 'hangyodon-hunger-push-every-5m'
);
