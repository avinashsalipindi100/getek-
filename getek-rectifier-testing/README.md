# GETEK Rectifier Testing Management System

React + TypeScript + Tailwind + Recharts on the front end; Supabase (Auth, Postgres, RLS, Storage, Realtime) on the back end; deployed on Vercel.

## 1. Supabase setup
1. Create a project at supabase.com.
2. **SQL Editor** → paste and run `supabase/migrations/001_schema.sql`. It creates tables, indexes, constraints, RLS policies, audit triggers, the private `problem-images` bucket with storage policies, and enables Realtime.
3. **Authentication → Users → Add user**: create the manager (tick *Auto Confirm User*). Then in the SQL Editor run:
   `update public.profiles set role='admin', full_name='Testing Manager' where email='manager@getek.com';`
4. **Authentication → URL Configuration**: set *Site URL* to your Vercel URL (needed for password-reset emails). Add `http://localhost:5173` as a redirect URL for local work.
5. **Edge Function** (creates engineer accounts; the service role key never reaches the browser):
   ```
   npm i -g supabase
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy create-engineer
   ```
   Supabase injects `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` into the function automatically.
6. Add the logo: save the company logo as `public/logo.png` (used in the sidebar, login, PDF and print reports).

## 2. Run locally
```
cp .env.example .env     # fill in Project URL and anon key (Settings → API)
npm install
npm run dev
```

## 3. Deploy on Vercel
1. Push this folder to a GitHub repo.
2. vercel.com → *Add New Project* → import the repo (framework: Vite, build `npm run build`, output `dist`).
3. Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Use the **anon** key only.
4. Deploy. `vercel.json` already rewrites all routes to `index.html`.

## Security notes
- All access control is enforced by RLS in Postgres, not just the UI. Engineers can only read/write their own rows; only active admins can delete records, manage profiles, ratings and settings.
- New accounts always start as `engineer`; promoting to admin is a manual SQL step.
- Engineers can edit a submitted report only inside the admin-set window (Settings). Admin edits and deletions are written to `audit_logs`.
- Problem images live in a private bucket under `<user_id>/…` and are shown through short-lived signed URLs.

## Update 2 (role login, manager sign-up, FO progress)
1. Run `supabase/migrations/002_update.sql` in the SQL Editor.
2. Deploy functions:
   ```
   supabase functions deploy create-engineer
   supabase secrets set MANAGER_SIGNUP_CODE=choose-a-long-secret-code
   supabase functions deploy manager-signup --no-verify-jwt
   ```
   Only people who know `MANAGER_SIGNUP_CODE` can register as managers.
