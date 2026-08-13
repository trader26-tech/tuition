# Tuition Center Dashboard

A web app for running a tuition center. A **teacher** (admin) posts assignments,
**students** upload their answers (PDF or photo), and the teacher **marks them
right on the document** with a red pen, ticks, crosses and notes — then gives a
score and feedback. It also has a **schedule** for planning tuitions, meetings
and exams, and who attends.

Built with **React + Vite + Tailwind**, backed by **Supabase** (auth, database,
file storage), and served by a small **Express** server so it deploys to
**Railway** as a single service.

---

## ✨ Features

- **Two roles** — Teacher (mom/admin) and Student, chosen at sign-up.
- **Assignments** — teacher creates them (title, subject, due date, max score,
  instructions); students see them and upload one answer file each.
- **Document annotation grading** — the main feature. Open any submitted PDF or
  image and mark it up:
  - ✍️ Freehand pen (adjustable colour & thickness)
  - ✓ Tick and ✗ cross stamps
  - 📝 Text notes anywhere on the page
  - 🧽 Erase individual marks
  - Marks are saved as a **re-editable overlay** — the student's original file is
    never modified.
  - Enter a **score** and **written feedback**; students see everything.
- **Schedule / timeline** — tuitions, meetings, exams and other events grouped by
  day, with time, subject, location, notes and attendee list.
- **Secure by default** — Supabase Row Level Security means students only ever
  see their own submissions and the events they're invited to.

---

## 🚀 Quick start

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → **New project**. Once ready, open
**SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates all
tables, the storage bucket, and the security rules.

> **Required for the simple name-only login:** In **Authentication → Providers
> → Email**, turn **OFF** "Confirm email". Users sign up with just a name and
> password and are logged straight in — no email is ever asked for or sent.

### 2. Get your keys
In Supabase → **Settings → API**, copy:
- **Project URL**
- the **`anon` / `public`** key  ← this one (NOT `service_role`)

### 3. Run locally
```bash
cp .env.example .env       # then fill in the two values
npm install
npm run dev                # http://localhost:5173
```

### 4. First login (create the teacher account)
On the sign-up screen just pick **Teacher**, type your mom's **name** and a
**password**, and you're in. Everyone else picks **Student** and does the same.
No email, no confirmation.

> Names are unique per type. If a name is already taken, the app asks you to add
> a number (e.g. "Rahul 2"). Behind the scenes each name maps to a hidden
> internal login — users never see it.
>
> Want to be certain an account is a teacher? In Supabase → **Table editor →
> `profiles`**, set that user's `role` to `teacher`.

---

## 🚂 Deploy to Railway

1. Push this repo to GitHub (already done if you're reading this there).
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo** →
   pick this repo.
3. Railway auto-detects Nixpacks and runs `npm run build` then `npm start`.
4. Add two **Variables** in the service settings:
   ```
   VITE_SUPABASE_URL       = https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY  = your-anon-public-key
   ```
5. Deploy. The health check is at `/healthz`.

The server reads those variables at runtime and injects the public config into
the page, so you can change environments without rebuilding.

---

## 🧱 How it works

| Piece | What it does |
|------|---------------|
| `server/index.js` | Express server: serves the built app, injects runtime Supabase config, health check for Railway. |
| `supabase/schema.sql` | Tables (`profiles`, `assignments`, `submissions`, `schedule_events`, `schedule_attendees`), the `submissions` storage bucket, and all RLS policies. |
| `src/pages/GradePage.jsx` + `src/components/AnnotationCanvas.jsx` | The annotation grading experience. PDFs are rendered to images with `pdfjs-dist`; marks are stored as normalized coordinates so they scale cleanly. |
| `src/context/AuthContext.jsx` | Supabase auth + the current user's role. |

Uploaded files live in a **private** storage bucket. The app fetches them with
short-lived signed URLs, and RLS ensures a student can only touch files inside
their own folder.

---

## 🔐 Security notes
- Only the **anon** key is ever used in the browser. Never expose the
  `service_role` key.
- All data access is guarded by Row Level Security in `schema.sql`.
- `.env` is gitignored; only `.env.example` (with blank values) is committed.

---

## 📜 Scripts
```bash
npm run dev      # local dev server (Vite)
npm run build    # production build → dist/
npm start        # run the production Express server (what Railway uses)
```
