# GETEK setup (short version)
1. Supabase > SQL Editor: run supabase/migrations/002_update.sql (001_schema.sql only if the database is brand new).
2. Make yourself manager (SQL Editor):
   update public.profiles set role='admin', full_name='Avinash' where email='avinashsalipindi120@gmail.com';
3. Supabase > Edge Functions: deploy create-engineer and manager-signup (paste code from supabase/functions/*/index.ts).
   manager-signup: turn OFF "Verify JWT". Add secret MANAGER_SIGNUP_CODE = your long private code.
4. GitHub: upload the contents of this folder to your repository (replace existing files). Add public/logo.png.
5. Vercel: needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. It redeploys after each commit.
