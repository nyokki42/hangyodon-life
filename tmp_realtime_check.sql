select pubname, schemaname, tablename
from pg_publication pp
join pg_publication_tables ppt on pp.oid = ppt.pubid
where schemaname = 'public' and tablename = 'hangyodon';
