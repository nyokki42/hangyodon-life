create extension if not exists pg_cron;

select cron.schedule(
  'hangyodon-hunger-push-every-5m',
  '*/5 * * * *',
  'select net.http_post(
      url := ''https://otyfyfucfqbdboltelsw.supabase.co/functions/v1/send-hangyodon-push'',
      headers := ''{"Content-Type":"application/json","Authorization":"Bearer edb7a260885ba5c9de2c759f14b0c5d452b05201e284303623c7cda3e39c037a"}''::jsonb,
      body := ''{"pet_id":1,"type":"hunger_low"}''::jsonb
    );'
)
where not exists (
  select 1
  from cron.job
  where jobname = 'hangyodon-hunger-push-every-5m'
);

