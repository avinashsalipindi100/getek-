// Public manager registration, protected by a secret company code.
// Deploy with: supabase functions deploy manager-signup --no-verify-jwt
// Set code:    supabase secrets set MANAGER_SIGNUP_CODE=your-long-secret
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const b = await req.json()
  const code = Deno.env.get('MANAGER_SIGNUP_CODE')
  if (!code || b.code !== code) return json({ error: 'Invalid manager registration code' }, 403)
  if (!b.email || !b.full_name || !b.password || b.password.length < 8) return json({ error: 'Name, email and a password of 8+ characters are required' }, 400)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data, error } = await admin.auth.admin.createUser({ email: b.email, password: b.password, email_confirm: true, user_metadata: { full_name: b.full_name, department: 'Management' } })
  if (error || !data.user) return json({ error: error?.message ?? 'Could not create account' }, 400)
  await admin.from('profiles').update({ role: 'admin' }).eq('id', data.user.id)
  return json({ ok: true })
})
