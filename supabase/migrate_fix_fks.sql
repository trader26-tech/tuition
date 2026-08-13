-- ============================================================================
--  MIGRATION: repoint all user foreign keys to app_users
--
--  WHY: The app originally used Supabase Auth with a `profiles` table. When it
--  moved to username/password (app_users), tables that already existed
--  (assignments, schedule_events, submissions, schedule_attendees) kept their
--  OLD foreign keys pointing at `profiles`. That causes:
--    insert or update ... violates foreign key constraint ..._created_by_fkey
--    Key (created_by)=(...) is not present in table "profiles"
--
--  This migration drops every foreign key on the user-referencing columns and
--  recreates it pointing at public.app_users. Idempotent — safe to run again.
--
--  RUN THIS in Supabase → SQL Editor → New query → paste → Run.
-- ============================================================================

do $$
declare
  r record;
  -- (table, column, target-behaviour) for every user-referencing FK.
  fks constant text[][] := array[
    ['assignments',        'created_by', 'set null'],
    ['schedule_events',    'created_by', 'set null'],
    ['student_groups',     'created_by', 'set null'],
    ['submissions',        'student_id', 'cascade'],
    ['schedule_attendees', 'student_id', 'cascade']
  ];
  f text[];
begin
  foreach f slice 1 in array fks loop
    -- Skip if the table or column doesn't exist yet.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = f[1] and column_name = f[2]
    ) then
      raise notice 'skip %(%): table/column missing', f[1], f[2];
      continue;
    end if;

    -- Drop whatever FK currently constrains this column (any name, any target).
    for r in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public'
        and con.contype = 'f'
        and rel.relname = f[1]
        and con.conkey = (
          select array_agg(attnum)
          from pg_attribute
          where attrelid = rel.oid and attname = f[2]
        )
    loop
      execute format('alter table public.%I drop constraint %I', f[1], r.conname);
      raise notice 'dropped % on %', r.conname, f[1];
    end loop;

    -- Recreate pointing at app_users.
    execute format(
      'alter table public.%I add constraint %I foreign key (%I)
         references public.app_users(id) on delete %s',
      f[1], f[1] || '_' || f[2] || '_fkey', f[2], f[3]
    );
    raise notice 'repointed %(%) -> app_users', f[1], f[2];
  end loop;
end $$;

-- The old Supabase-Auth `profiles` table is no longer used. Kept (harmless).
-- If you're sure you don't need it: drop table if exists public.profiles cascade;

-- ============================================================================
--  DONE. Creating assignments and schedule events will now work.
-- ============================================================================
