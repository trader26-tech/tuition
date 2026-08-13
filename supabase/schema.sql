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
  created_at     timestamptz not null default now()
);

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
  created_by   uuid references public.app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

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
--  SCHEDULE  (tuition sessions & meetings — who / when)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.schedule_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  kind         text not null default 'tuition'
                 check (kind in ('tuition', 'meeting', 'exam', 'other')),
  subject      text default '',
  location     text default '',
  notes        text default '',
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  created_by   uuid references public.app_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table if not exists public.schedule_attendees (
  event_id    uuid not null references public.schedule_events(id) on delete cascade,
  student_id  uuid not null references public.app_users(id) on delete cascade,
  primary key (event_id, student_id)
);

-- ─────────────────────────────────────────────────────────────────────────
--  STORAGE BUCKET for uploaded answer documents (private).
--  The server uploads/reads with the service_role key, so no storage RLS
--  policies are needed.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- ============================================================================
--  DONE. All access is enforced by the Express API using the service_role key.
--  Create your teacher (mom) account from the app's sign-up screen.
-- ============================================================================
