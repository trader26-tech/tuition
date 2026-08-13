# Tuition Center Dashboard

A web app for running a tuition center. A **teacher** (admin) posts assignments,
**students** upload their answers (PDF or photo), and the teacher **marks them
right on the document** with a red pen, ticks, crosses and notes — then gives a
score and feedback. It also has a **schedule** for planning tuitions, meetings
and exams, and who attends.

Built with **React + Vite + Tailwind** and a small **Express** API, backed by
**Supabase** (Postgres database + file storage). Login is a simple **username +
password** — no email, no confirmation. It deploys to **Railway** as a single
service.

> **Architecture in one line:** the browser talks only to our Express API; the
> Express API talks to Supabase using the service_role key (server-side only)
> and issues signed login tokens. So there's one thing to deploy, and no secrets
> in the browser.

---

## ✨ Features

- **Dead-simple login** — just a name and a password. Pick Teacher or Student at
  sign-up. No email, no confirmation, no rate limits.
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
- **Secure by default** — the Express API enforces access (passwords are bcrypt
  hashed; students only ever see their own submissions and the events they're
  invited to). The Supabase key never reaches the browser.

---

## 🚀 Quick start

### 1. Create a Supabase project
Go to [supabase.com](https://supabase.com) → **New project**. Once ready, open
**SQL Editor → New query**, paste the contents of
[`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates the
tables and the storage bucket.

> No Supabase Auth settings to touch — we don't use Supabase Auth at all. No
> email provider, no "confirm email", nothing.

### 2. Get your key
In Supabase → **Settings → API**, copy:
- **Project URL**
- the **`service_role`** key — this stays on the **server only** and is never
  sent to the browser.

### 3. Run locally
```bash
cp .env.example .env       # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET
npm install
npm run build              # build the frontend once
npm start                  # server + app together → http://localhost:3000
```
Prefer hot-reload while developing? Run `npm start` in one terminal and
`npm run dev` in another (Vite proxies `/api` to the server) → http://localhost:5173.

### 4. First login (create the teacher account)
On the sign-up screen pick **Teacher**, type your mom's **name** and a
**password**, and you're in. Everyone else picks **Student** and does the same.
No email, no confirmation.

> If a name is already taken, the app asks you to add a number (e.g. "Rahul 2").
> To flip anyone's role later: Supabase → **Table editor → `app_users`** → set
> `role` to `teacher` or `student`.

---

## 🚂 Deploy to Railway

1. Push this repo to GitHub (already done if you're reading this there).
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo** →
   pick this repo → deploy the **`main`** branch.
3. Railway auto-detects Nixpacks and runs `npm run build` then `npm start`.
4. Add these **Variables** in the service settings:
   ```
   SUPABASE_URL                = https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY   = your-service_role-key
   SESSION_SECRET              = any-long-random-string
   ```
5. Deploy. The health check is at `/healthz`. Open the URL and sign up.

---

## 🧱 How it works

| Piece | What it does |
|------|---------------|
| `server/auth.js` | Username + password signup/login. Passwords are **bcrypt** hashed; a signed **JWT** is returned as the session token. |
| `server/api.js` | All data endpoints (assignments, submissions, schedule, file upload + signed URLs), each guarded by the session token and role. |
| `server/db.js` | Server-side Supabase client using the **service_role** key. |
| `server/index.js` | Ties it together: mounts the API, serves the built app, health check for Railway. |
| `supabase/schema.sql` | Tables (`app_users`, `assignments`, `submissions`, `schedule_events`, `schedule_attendees`) and the `submissions` storage bucket. |
| `src/lib/api.js` | Tiny frontend client that sends the token and calls the API. |
| `src/pages/GradePage.jsx` + `src/components/AnnotationCanvas.jsx` | The annotation grading experience. PDFs are rendered to images with `pdfjs-dist`; marks are stored as normalized coordinates so they scale cleanly. |

Uploaded files live in a **private** storage bucket. The browser never gets the
Supabase key — it asks the API for a short-lived signed URL when it needs to
show a file, and the API checks you're allowed to see it first.

---

## 🔐 Security notes
- The **service_role** key lives only on the server (in env vars). It is never
  bundled into the frontend or sent to the browser.
- Passwords are stored as **bcrypt hashes**, never plaintext.
- Access is enforced by the API: students can only see their own submissions and
  the events they attend; only teachers can create/grade/schedule.
- `.env` is gitignored; only `.env.example` (with blank values) is committed.
- Set a strong random `SESSION_SECRET` in production.

---

## 📜 Scripts
```bash
npm run dev      # Vite dev server with hot reload (proxies /api to :3000)
npm run build    # build the frontend → dist/
npm start        # run the Express server (API + built app) — what Railway uses
```
