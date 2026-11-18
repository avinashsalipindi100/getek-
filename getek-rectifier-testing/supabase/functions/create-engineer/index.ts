// Admin-only account actions: create | reset_password. Service role key stays server-side.
import { createClient } from 'npm:@supabase/supabase-js@2'
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = Deno.env.get('SUPABASE_URL')!
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await caller.auth.getUser()
  if (!user) return json({ error: 'Not signed in' }, 401)
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: me } = await admin.from('profiles').select('role,is_active').eq('id', user.id).single()
  if (me?.role !== 'admin' || !me.is_active) return json({ error: 'Managers only' }, 403)
  const b = await req.json()
  if (!b.password || b.password.length < 8) return json({ error: 'Password must be at least 8 characters' }, 400)
  if (b.action === 'reset_password') {
    const { error } = await admin.auth.admin.updateUserById(b.user_id, { password: b.password })
    return error ? json({ error: error.message }, 400) : json({ ok: true })
  }
  if (!b.email || !b.full_name) return json({ error: 'Name and email are required' }, 400)
  const { error } = await admin.auth.admin.createUser({
    email: b.email, password: b.password, email_confirm: true,
    user_metadata: { full_name: b.full_name, employee_id: b.employee_id ?? '', department: b.department ?? 'Testing' },
  })
  return error ? json({ error: error.message }, 400) : json({ ok: true })
})
