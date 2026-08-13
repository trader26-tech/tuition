-- ============================================================================
--  Tuition Center Dashboard — database schema
--  Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--  Safe to re-run.
--
--  Auth is simple username + password, handled by our own Express API
--  (server/). We do NOT use Supabase Auth, emails, or confirmations.
--  The server talks to this database with the service_role key and enforces
--  who can see/do what, so these tables don't rely on Supabase RLS.
-- ============================================================================

-- Needed for gen_random_uuid() and crypt()/hashing helpers if used.
create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
--  USERS  (username + password login)
--  password_hash is a bcrypt hash created by the server — never plaintext.
--  username is stored lowercased & unique; full_name is what we show.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.app_users (
  id             uuid primary key default gen_random_uuid(),
  username       text not null unique,
  full_name      text not null,
  password_hash  text not null,
  role           text not null default 'student' check (role in ('teacher', 'student')),
  grade          text default '',   -- class the student studies in, e.g. "Class 10"
  school         text default '',   -- school name
  created_at     timestamptz not null default now()
);

-- Add the student-property columns if this table already existed.
alter table public.app_users add column if not exists grade text default '';
alter table public.app_users add column if not exists school text default '';

-- ─────────────────────────────────────────────────────────────────────────
--  ASSIGNMENTS  (created by the teacher)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text default '',
  subject      text default '',
  due_date     timestamptz,
  max_score    numeric default 100,
  -- Optional attachment: the question paper / worksheet the teacher hands out.
  attachment_path  text,
  attachment_name  text,
  attachment_type  text,
  created_by   uuid references public.app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Add attachment columns if this table already existed.
alter table public.assignments add column if not exists attachment_path text;
alter table public.assignments add column if not exists attachment_name text;
alter table public.assignments add column if not exists attachment_type text;

-- ─────────────────────────────────────────────────────────────────────────
--  SUBMISSIONS  (a student's uploaded answer for an assignment)
--  annotations = JSON overlay of the teacher's marks (re-editable).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  student_id     uuid not null references public.app_users(id) on delete cascade,
  file_path      text not null,
  file_name      text,
  file_type      text,
  status         text not null default 'submitted'
                   check (status in ('submitted', 'graded')),
  score          numeric,
  feedback       text default '',
  annotations    jsonb not null default '[]'::jsonb,
  submitted_at   timestamptz not null default now(),
  graded_at      timestamptz,
  unique (assignment_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────
--  GROUPS  (teacher-created groups of students, e.g. "Class 10 - DAV")
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.student_groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  created_by   uuid references public.app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id     uuid not null references public.student_groups(id) on delete cascade,
  student_id   uuid not null references public.app_users(id) on delete cascade,
  primary key (group_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────
--  ASSIGNMENT TARGETS  (who an assignment is for)
--  If an assignment has NO target rows, it is visible to everyone (back-compat).
--  Otherwise a student sees it only if they are targeted directly, or via a
--  group they belong to.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.assignment_targets (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id    uuid references public.app_users(id) on delete cascade,
  group_id      uuid references public.student_groups(id) on delete cascade,
  check (student_id is not null or group_id is not null)
);

create index if not exists assignment_targets_assignment_idx
  on public.assignment_targets (assignment_id);

-- ─────────────────────────────────────────────────────────────────────────
--  SCHEDULE  (tuition sessions & meetings — who / when)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.schedule_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null default 'tuition'
                 check (kind in ('tuition', 'meeting', 'exam', 'other')),
  subject      text default '',
  location     text default '',
  meet_link    text default '',   -- optional online meeting link (Zoom/Meet/…)
  notes        text default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  -- Recurrence: weekly rule. repeat_weekdays holds ISO weekday numbers
  -- (1=Mon … 7=Sun). Empty = one-off on starts_at. When set, the event rolls
  -- forward automatically (the API expands occurrences a few months ahead), so
  -- no explicit end date is needed. starts_at/ends_at carry the time-of-day.
  repeat_weekdays  int[] default '{}',
  repeat_until     timestamptz,   -- legacy/optional; unused by the current UI
  created_by   uuid references public.app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Add columns if this table already existed.
alter table public.schedule_events add column if not exists repeat_weekdays int[] default '{}';
alter table public.schedule_events add column if not exists repeat_until timestamptz;
alter table public.schedule_events add column if not exists meet_link text default '';

-- Attendees are attached individually (kept for back-compat) …
create table if not exists public.schedule_attendees (
  event_id    uuid not null references public.schedule_events(id) on delete cascade,
  student_id  uuid not null references public.app_users(id) on delete cascade,
  primary key (event_id, student_id)
);

-- … and by group. An event assigned to a group includes everyone in it.
create table if not exists public.schedule_event_groups (
  event_id    uuid not null references public.schedule_events(id) on delete cascade,
  group_id    uuid not null references public.student_groups(id) on delete cascade,
  primary key (event_id, group_id)
);

-- ─────────────────────────────────────────────────────────────────────────
--  STORAGE BUCKET for uploaded answer documents (private).
--  The server uploads/reads with the service_role key, so no storage RLS
--  policies are needed.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
--  SELF-HEAL: make sure every user-referencing foreign key points at
--  app_users. Tables created under the old Supabase-Auth design referenced a
--  `profiles` table; this repoints them. Idempotent — safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────
do $$
declare
  r record;
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
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = f[1] and column_name = f[2]
    ) then
      continue;
    end if;

    for r in
      select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
      where nsp.nspname = 'public' and con.contype = 'f' and rel.relname = f[1]
        and con.conkey = (
          select array_agg(attnum) from pg_attribute
          where attrelid = rel.oid and attname = f[2]
        )
    loop
      execute format('alter table public.%I drop constraint %I', f[1], r.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I)
         references public.app_users(id) on delete %s',
      f[1], f[1] || '_' || f[2] || '_fkey', f[2], f[3]
    );
  end loop;
end $$;

-- ============================================================================
--  DONE. All access is enforced by the Express API using the service_role key.
--  Create your teacher (mom) account from the app's sign-up screen.
-- ============================================================================
