-- ============================================================================
--  Tuition Center Dashboard — Supabase schema
--  Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--  Safe to re-run (idempotent where practical).
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
--  1. PROFILES
--  One row per auth user. role = 'teacher' (mom/admin) or 'student'.
--  A trigger creates a profile automatically when a user signs up.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        text not null default 'student' check (role in ('teacher', 'student')),
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current user a teacher? (SECURITY DEFINER avoids RLS recursion.)
create or replace function public.is_teacher()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'teacher'
  );
$$;

-- Everyone can read profiles (needed to show names on submissions/schedule).
drop policy if exists "profiles readable by authenticated" on public.profiles;
create policy "profiles readable by authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- A user can update their own profile (but not escalate role — see trigger note).
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid());

-- Auto-create a profile on signup. The desired role is passed in user metadata
-- as { role: 'teacher' | 'student' }; defaults to 'student'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case
      when new.raw_user_meta_data ->> 'role' = 'teacher' then 'teacher'
      else 'student'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────
--  2. ASSIGNMENTS  (created by the teacher)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.assignments (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text default '',
  subject      text default '',
  due_date     timestamptz,
  max_score    numeric default 100,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.assignments enable row level security;

-- All authenticated users can read assignments (students need to see them).
drop policy if exists "assignments readable" on public.assignments;
create policy "assignments readable"
  on public.assignments for select
  to authenticated
  using (true);

-- Only teachers can create / modify / delete assignments.
drop policy if exists "teacher manages assignments" on public.assignments;
create policy "teacher manages assignments"
  on public.assignments for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- ─────────────────────────────────────────────────────────────────────────
--  3. SUBMISSIONS  (a student's uploaded answer for an assignment)
--  file_path points into the 'submissions' storage bucket.
--  annotations = JSON overlay of the teacher's marks (re-editable).
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.submissions (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.assignments(id) on delete cascade,
  student_id     uuid not null references public.profiles(id) on delete cascade,
  file_path      text not null,
  file_name      text,
  file_type      text,               -- e.g. application/pdf, image/png
  status         text not null default 'submitted'
                   check (status in ('submitted', 'graded')),
  score          numeric,
  feedback       text default '',
  annotations    jsonb not null default '[]'::jsonb,
  submitted_at   timestamptz not null default now(),
  graded_at      timestamptz,
  unique (assignment_id, student_id)  -- one submission per student per assignment
);

alter table public.submissions enable row level security;

-- Teacher sees all submissions; a student sees only their own.
drop policy if exists "read own or teacher-all submissions" on public.submissions;
create policy "read own or teacher-all submissions"
  on public.submissions for select
  to authenticated
  using (student_id = auth.uid() or public.is_teacher());

-- A student can insert their own submission.
drop policy if exists "student inserts own submission" on public.submissions;
create policy "student inserts own submission"
  on public.submissions for insert
  to authenticated
  with check (student_id = auth.uid());

-- A student can update their own submission ONLY while it is not yet graded
-- (e.g. re-upload). Teacher can update any submission (to grade / annotate).
drop policy if exists "update own ungraded or teacher-any" on public.submissions;
create policy "update own ungraded or teacher-any"
  on public.submissions for update
  to authenticated
  using (
    public.is_teacher()
    or (student_id = auth.uid() and status = 'submitted')
  )
  with check (
    public.is_teacher()
    or (student_id = auth.uid() and status = 'submitted')
  );

-- Deletes: teacher any; student own (ungraded).
drop policy if exists "delete own ungraded or teacher-any" on public.submissions;
create policy "delete own ungraded or teacher-any"
  on public.submissions for delete
  to authenticated
  using (
    public.is_teacher()
    or (student_id = auth.uid() and status = 'submitted')
  );


-- ─────────────────────────────────────────────────────────────────────────
--  4. SCHEDULE  (tuition sessions & meetings — who / when)
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
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.schedule_events enable row level security;

-- Which students are attached to an event (many-to-many).
create table if not exists public.schedule_attendees (
  event_id    uuid not null references public.schedule_events(id) on delete cascade,
  student_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (event_id, student_id)
);

alter table public.schedule_attendees enable row level security;

-- Teacher sees/manages all events. A student sees events they attend.
drop policy if exists "read events teacher or attendee" on public.schedule_events;
create policy "read events teacher or attendee"
  on public.schedule_events for select
  to authenticated
  using (
    public.is_teacher()
    or exists (
      select 1 from public.schedule_attendees a
      where a.event_id = schedule_events.id and a.student_id = auth.uid()
    )
  );

drop policy if exists "teacher manages events" on public.schedule_events;
create policy "teacher manages events"
  on public.schedule_events for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());

-- Attendees: readable by teacher or the attendee themself; managed by teacher.
drop policy if exists "read attendees teacher or self" on public.schedule_attendees;
create policy "read attendees teacher or self"
  on public.schedule_attendees for select
  to authenticated
  using (public.is_teacher() or student_id = auth.uid());

drop policy if exists "teacher manages attendees" on public.schedule_attendees;
create policy "teacher manages attendees"
  on public.schedule_attendees for all
  to authenticated
  using (public.is_teacher())
  with check (public.is_teacher());


-- ─────────────────────────────────────────────────────────────────────────
--  5. STORAGE BUCKET for uploaded answer documents
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- File path convention: <student_id>/<assignment_id>/<filename>
-- A student may upload/read/update/delete files under their own folder.
-- The teacher may read every file.

drop policy if exists "student rw own files" on storage.objects;
create policy "student rw own files"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'submissions'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "teacher reads all files" on storage.objects;
create policy "teacher reads all files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'submissions' and public.is_teacher());

-- ============================================================================
--  DONE. Next: create your teacher (mom) account — see README "First login".
-- ============================================================================
