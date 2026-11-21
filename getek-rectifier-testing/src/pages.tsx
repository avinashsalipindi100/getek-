import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Cpu, Download, Factory, Plus, Printer, ShieldCheck, Trash2, UserCog, Wrench } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useAuth, supabase, toast, Btn, Card, Spinner, Stat, Badge, Table, Modal, Logo, SignedImg, Hero, TEST_STATUSES, CATEGORIES, SEVERITIES, PROBLEM_STATUSES, label, iso, today, addDays, monthRange, weekStart, finalStatus, STAGES, spanMins, testMinutes, busyMinutes, fmtDur, fmtDT, dtLocal, nowDT, SHIFT_MINUTES, useRealtime, RECORD_SELECT, stats, toCSV, toPDF, toXLSX } from './lib'
import type { Profile, Problem, RecordRow, Tbl } from './lib'


// ===== Login =====

type Role = 'admin' | 'engineer'
// Edge Function URL names, exactly as shown in Supabase > Edge Functions (the last part of each function's URL)
const FN_MANAGER_SIGNUP = 'rapid-function'
const FN_CREATE_ENGINEER = 'engineer'

export function Login({ recovery, onDone }: { recovery: boolean; onDone: () => void }) {
  const [role, setRole] = useState<Role>('engineer'); const [signup, setSignup] = useState(false)
  const [f, setF] = useState({ name: '', email: '', pw: '', code: '' }); const [busy, setBusy] = useState(false)
  const set = (k: string, v: string) => setF(s => ({ ...s, [k]: v }))
  const field = (k: keyof typeof f, l: string, type = 'text') => <div><label className="lbl">{l}</label><input className="inp" type={type} required value={f[k]} onChange={e => set(k, e.target.value)} /></div>

  const signIn = async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.pw })
    if (error) return toast(error.message, 'err')
    const { data: p } = await supabase.from('profiles').select('role, is_active').eq('id', data.user.id).single()
    const actual: Role = p?.role === 'admin' ? 'admin' : 'engineer'
    if (actual !== role) { await supabase.auth.signOut(); return toast(`This is a ${actual === 'admin' ? 'Manager' : 'Engineer'} account. Select "${actual === 'admin' ? 'Manager' : 'Engineer'}" above and sign in again.`, 'err') }
  }
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      if (recovery) {
        if (f.pw.length < 8) return toast('Use at least 8 characters', 'err')
        const { error } = await supabase.auth.updateUser({ password: f.pw }); if (error) return toast(error.message, 'err'); toast('Password updated'); onDone()
      } else if (signup) {
        const { data, error } = await supabase.functions.invoke(FN_MANAGER_SIGNUP, { body: { full_name: f.name, email: f.email.trim(), password: f.pw, code: f.code } })
        if (error || data?.error) return toast(data?.error ?? error?.message ?? 'Sign-up failed', 'err')
        toast('Manager account created'); await signIn()
      } else await signIn()
    } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-900 p-10 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full border-[40px] border-amber-500/20" /><div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full border-[50px] border-white/5" />
        <div className="relative flex items-center gap-3 rounded-lg bg-white p-3 text-brand-900 w-fit"><Logo size={36} /><b>GETEK Electronics Pvt. Ltd.</b></div>
        <div className="relative"><h1 className="text-4xl font-semibold leading-tight">Rectifier testing,<br />tracked from bench to dispatch.</h1>
          <p className="mt-4 max-w-md text-slate-300">Daily test reports, FO progress and engineer performance in one place.</p>
          <div className="mt-8 grid max-w-md gap-4 text-sm">{[[Cpu, 'No load, short circuit and load tests recorded per unit'], [Factory, 'FO-wise progress against ordered quantity'], [ShieldCheck, 'Role-based access: engineers see only their own work']].map(([I, t]: any) =>
            <div key={t} className="flex items-center gap-3"><span className="rounded-md bg-amber-500 p-2 text-slate-900"><I size={16} /></span>{t}</div>)}</div></div>
        <p className="relative text-xs text-slate-400">GETEK Rectifier Testing Management System</p>
      </div>
      <div className="flex items-center justify-center bg-slate-50 p-4">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="text-center lg:hidden"><div className="flex justify-center"><Logo size={48} /></div><h1 className="mt-2 font-semibold text-brand-900">GETEK Rectifier Testing</h1></div>
          {recovery ? <><h2 className="text-lg font-semibold">Set a new password</h2>{field('pw', 'New password', 'password')}</> : <>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-200 p-1">{([['engineer', 'Engineer', Wrench], ['admin', 'Manager', UserCog]] as const).map(([r, l, I]) =>
              <button type="button" key={r} onClick={() => { setRole(r); if (r === 'engineer') setSignup(false) }} className={`flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium ${role === r ? 'bg-white text-brand-700 shadow' : 'text-slate-600'}`}><I size={15} />{l}</button>)}</div>
            <h2 className="text-lg font-semibold">{signup ? 'Create manager account' : `${role === 'admin' ? 'Manager' : 'Engineer'} sign in`}</h2>
            {signup && field('name', 'Full name')}{field('email', 'Email', 'email')}{field('pw', 'Password', 'password')}
            {signup && <div>{field('code', 'Manager registration code', 'password')}<p className="mt-1 text-xs text-slate-500">Ask your company administrator for this code.</p></div>}</>}
          <Btn className="w-full" disabled={busy}>{recovery ? 'Save new password' : signup ? 'Create account' : 'Sign in'}</Btn>
          {!recovery && <div className="flex justify-between text-xs text-brand-600">
            <button type="button" className="hover:underline" onClick={() => f.email ? supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: window.location.origin }).then(r => r.error ? toast(r.error.message, 'err') : toast('Reset link sent. Check your email.')) : toast('Enter your email first', 'err')}>Forgot password?</button>
            {role === 'admin' && <button type="button" className="hover:underline" onClick={() => setSignup(!signup)}>{signup ? 'Back to sign in' : 'New manager? Sign up'}</button>}</div>}
        </form>
      </div>
    </div>
  )
}


// ===== EngineerDashboard =====

export function EngineerDashboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<RecordRow[] | null>(null)
  const load = useCallback(async () => {
    const [m0] = monthRange(today())
    const from = addDays(today(), -13) < m0 ? addDays(today(), -13) : m0
    const { data } = await supabase.from('rectifier_records').select(RECORD_SELECT).eq('engineer_id', profile.id).gte('testing_date', from).order('created_at', { ascending: false })
    setRows((data ?? []) as RecordRow[])
  }, [profile.id])
  useEffect(() => { load() }, [load]); useRealtime(['rectifier_records', 'technical_problems'], load)
  if (!rows) return <Spinner />

  const t = rows.filter(r => r.testing_date === today())
  const sum = (a: RecordRow[]) => a.reduce((s, r) => s + r.quantity, 0)
  const done = (k: 'no_load_status' | 'short_circuit_status' | 'load_test_status' | 'functional_status') => t.filter(r => r[k] === 'completed').length
  const problems = rows.flatMap(r => (r.technical_problems ?? []).map(p => ({ ...p, rec: r })))
  const pending = rows.filter(r => ['Pending', 'In Progress'].includes(finalStatus(r))).length
  const monthQty = sum(rows.filter(r => r.testing_date >= monthRange(today())[0]))
  const chart = Array.from({ length: 14 }, (_, i) => { const d = addDays(today(), i - 13); return { day: d.slice(5), qty: sum(rows.filter(r => r.testing_date === d)) } })

  return (
    <div className="space-y-5">
      <Hero title={`Hello, ${profile.full_name}`} sub={`This month: ${monthQty} units ordered across your tests`} right={<Link to="/report/new"><Btn kind="amber" className="!px-4 !py-2.5 text-base shadow-lg">+ Add New Testing Report</Btn></Link>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Rectifiers tested today" value={t.length} />
        <Stat label="Order quantity today" value={sum(t)} />
        <Stat label="FO (orders) completed" value={new Set(t.filter(r => finalStatus(r) === 'Completed').map(r => r.fo_number)).size} tone="green" />
        <Stat label="No load tests completed" value={done('no_load_status')} tone="green" />
        <Stat label="Short circuit tests completed" value={done('short_circuit_status')} tone="green" />
        <Stat label="Load tests completed" value={done('load_test_status')} tone="green" />
        <Stat label="Functional checks completed" value={done('functional_status')} tone="green" />
        <Stat label="Testing time today" value={fmtDur(busyMinutes(t))} />
        <Stat label="8-hour shift used" value={Math.round(busyMinutes(t) / SHIFT_MINUTES * 100) + '%'} tone="amber" />
        <Stat label="Rectifiers with problems" value={t.filter(r => (r.technical_problems ?? []).length).length} tone="red" />
        <Stat label="Pending testing activities" value={pending} tone="amber" /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Daily productivity (last 14 days)"><div className="h-56"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Bar dataKey="qty" name="Quantity" fill="#1f5f99" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
        <Card title="Reported technical problems">
          <Table head={['Category', 'FO', 'Severity', 'Status']} empty={!problems.length}>{problems.slice(0, 6).map(p => <tr key={p.id}><td className="td">{p.category}</td><td className="td">{p.rec.fo_number}</td><td className="td"><Badge v={p.severity} /></td><td className="td"><Badge v={p.problem_status} /></td></tr>)}</Table></Card></div>
      <Card title="Today's submitted work and recent records">
        <Table head={['Date', 'FO', 'Series', 'Rating', 'Qty', 'No load', 'Short circuit', 'Load', 'Functional', 'Test time', 'Status', 'Saved as', '']} empty={!rows.length}>
          {rows.slice(0, 12).map(r => <tr key={r.id}><td className="td">{r.testing_date}</td><td className="td">{r.fo_number}</td><td className="td">{r.series_number}</td><td className="td">{r.rectifier_rating}</td><td className="td">{r.quantity}</td>
            <td className="td"><Badge v={r.no_load_status} /></td><td className="td"><Badge v={r.short_circuit_status} /></td><td className="td"><Badge v={r.load_test_status} /></td><td className="td"><Badge v={r.functional_status} /></td><td className="td">{fmtDur(testMinutes(r))}</td>
            <td className="td"><Badge v={finalStatus(r)} /></td><td className="td"><Badge v={r.submission_status} /></td><td className="td"><Link className="text-brand-600 hover:underline" to={`/report/${r.id}`}>Open</Link></td></tr>)}</Table></Card>
    </div>
  )
}


// ===== AdminDashboard =====

export function AdminDashboard() {
  const [engs, setEngs] = useState<Profile[]>([]); const [rows, setRows] = useState<RecordRow[] | null>(null); const [open, setOpen] = useState(0); const [day, setDay] = useState(today()); const [fo, setFo] = useState<any[]>([])
  const load = useCallback(async () => {
    const [p, r, o, a] = await Promise.all([
      supabase.from('profiles').select('*').eq('role', 'engineer').order('full_name'),
      supabase.from('rectifier_records').select(RECORD_SELECT).gte('testing_date', addDays(today(), -13)),
      supabase.from('technical_problems').select('id', { count: 'exact', head: true }).neq('problem_status', 'resolved'),
      supabase.from('rectifier_records').select('fo_number, ordered_quantity, quantity, no_load_status, short_circuit_status, load_test_status, functional_status, profiles:engineer_id(full_name)').eq('submission_status', 'submitted').limit(5000)])
    setEngs((p.data ?? []) as Profile[]); setRows((r.data ?? []) as RecordRow[]); setOpen(o.count ?? 0); setFo(a.data ?? [])
  }, [])
  useEffect(() => { load() }, [load]); useRealtime(['rectifier_records', 'technical_problems', 'profiles'], load)
  if (!rows) return <Spinner />
  const t = rows.filter(r => r.testing_date === today()); const s = stats(t)
  const chart = Array.from({ length: 14 }, (_, i) => { const d = addDays(today(), i - 13); const x = stats(rows.filter(r => r.testing_date === d)); return { day: d.slice(5), Quantity: x.qty, Failed: x.failed } })
  const fm: Record<string, { ordered: number; done: number; failed: number; by: Set<string> }> = {}
  fo.forEach((r: any) => { const m = (fm[r.fo_number] ??= { ordered: 0, done: 0, failed: 0, by: new Set() }); m.ordered = Math.max(m.ordered, r.ordered_quantity ?? 0); m.by.add(r.profiles?.full_name)
    const st = [r.no_load_status, r.short_circuit_status, r.load_test_status, r.functional_status]; if (st.includes('failed')) m.failed += r.quantity; else if (st.every(x => x === 'completed')) m.done += r.quantity })
  const foRows = Object.entries(fm).sort((a, b) => (b[1].ordered - b[1].done) - (a[1].ordered - a[1].done))
  const pie = ['Completed', 'Pending', 'Failed'].map(n => ({ name: n, value: rows.filter(r => finalStatus(r) === n).length }))
  const pc: Record<string, string> = { Completed: '#059669', Pending: '#f2a900', Failed: '#dc2626' }
  return (
    <div className="space-y-5">
      <Hero title="Testing department overview" sub={`Live for ${today()}. Updates as engineers submit.`} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <Stat label="Total engineers" value={engs.filter(e => e.is_active).length} />
        <Stat label="Active engineers today" value={new Set(t.map(r => r.engineer_id)).size} tone="green" />
        <Stat label="Rectifiers tested today" value={s.records} />
        <Stat label="Order quantity today" value={s.qty} />
        <Stat label="FO (orders) processed" value={s.fos} />
        <Stat label="Completed test activities" value={s.nl + s.sc + s.lt + s.fc} tone="green" />
        <Stat label="Failed test activities" value={s.failed} tone="red" />
        <Stat label="Problems reported today" value={s.problems} tone="amber" />
        <Stat label="Pending problem resolution" value={open} tone="red" /></div>
      <div className="grid gap-4 lg:grid-cols-3"><Card title="Test outcome, last 14 days"><div className="h-60"><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>{pie.map(x => <Cell key={x.name} fill={pc[x.name]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></div></Card>
      <Card title="FO progress against ordered quantity" className="lg:col-span-2 !p-0"><div className="max-h-72 overflow-y-auto"><Table head={['FO number', 'Ordered', 'Completed', 'Failed', 'Progress', 'Engineers']} empty={!foRows.length}>{foRows.map(([k, m]) => { const pct = m.ordered ? Math.min(100, Math.round(m.done / m.ordered * 100)) : 0
        return <tr key={k}><td className="td font-medium">{k}</td><td className="td">{m.ordered || 'Not set'}</td><td className="td">{m.done}</td><td className="td">{m.failed}</td><td className="td w-40"><div className="h-2 rounded bg-slate-200"><div className={`h-2 rounded ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: pct + '%' }} /></div><span className="text-xs text-slate-500">{m.ordered ? pct + '%' : ''}</span></td><td className="td">{[...m.by].join(', ')}</td></tr> })}</Table></div></Card></div>
      <Card title="Quantity and failures, last 14 days"><div className="h-60"><ResponsiveContainer><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="Quantity" fill="#1f5f99" radius={[3, 3, 0, 0]} /><Bar dataKey="Failed" fill="#dc2626" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>
      <Card title="Engineer performance today" className="!p-0">
        <Table head={['Engineer name', 'FO numbers', 'Rectifiers tested', 'No load', 'Short circuit', 'Load test', 'Functional', 'Problems', 'Testing time today', '8h shift used', 'Status']} empty={!engs.length}>
          {engs.map(e => { const er = t.filter(r => r.engineer_id === e.id); const x = stats(er); const bm = busyMinutes(er); return <tr key={e.id}>
            <td className="td"><Link className="font-medium text-brand-600 hover:underline" to={`/engineers/${e.id}`}>{e.full_name}</Link></td><td className="td">{x.fos}</td><td className="td">{x.records}</td><td className="td">{x.nl}</td><td className="td">{x.sc}</td><td className="td">{x.lt}</td><td className="td">{x.fc}</td><td className="td">{x.problems}</td><td className="td">{fmtDur(bm)}</td><td className="td w-36"><div className="h-2 rounded bg-slate-200"><div className={`h-2 rounded ${bm >= SHIFT_MINUTES ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: Math.min(100, bm / SHIFT_MINUTES * 100) + '%' }} /></div><span className="text-xs text-slate-500">{Math.round(bm / SHIFT_MINUTES * 100)}%</span></td>
            <td className="td">{!e.is_active ? <Badge v="Inactive" /> : x.records ? <Badge v={t.filter(r => r.engineer_id === e.id).every(r => finalStatus(r) === 'Completed') ? 'Completed' : 'In progress'} /> : <Badge v="Pending" />}</td></tr> })}</Table></Card>
      <Card title="Daily work reports from all engineers" className="!p-0" right={<input type="date" className="inp !w-auto" value={day} max={today()} min={addDays(today(), -13)} onChange={e => setDay(e.target.value)} />}>
        <Table head={['Engineer', 'FO (order no.)', 'Series no.', 'Rating', 'Order qty', 'No load', 'Short circuit', 'Load', 'Functional', 'Test time', 'Problems', 'Saved as']} empty={!rows.some(r => r.testing_date === day)}>
          {rows.filter(r => r.testing_date === day).sort((a, b) => (a.profiles?.full_name ?? '').localeCompare(b.profiles?.full_name ?? '')).map(r => <tr key={r.id}>
            <td className="td"><Link className="font-medium text-brand-600 hover:underline" to={`/engineers/${r.engineer_id}`}>{r.profiles?.full_name}</Link></td><td className="td">{r.fo_number}</td><td className="td">{r.series_number}</td><td className="td">{r.rectifier_rating}</td><td className="td font-semibold">{r.quantity}</td>
            <td className="td"><Badge v={r.no_load_status} /></td><td className="td"><Badge v={r.short_circuit_status} /></td><td className="td"><Badge v={r.load_test_status} /></td><td className="td"><Badge v={r.functional_status} /></td><td className="td">{fmtDur(testMinutes(r))}</td><td className="td">{r.technical_problems?.length || 'None'}</td><td className="td"><Badge v={r.submission_status} /></td></tr>)}</Table></Card>
    </div>
  )
}


// ===== EngineerDetail =====

export function EngineerDetail() {
  const { id } = useParams(); const [p, setP] = useState<Profile | null>(null); const [rows, setRows] = useState<RecordRow[] | null>(null)
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', id!).single().then(({ data }) => setP(data as Profile))
    supabase.from('rectifier_records').select(RECORD_SELECT).eq('engineer_id', id!).gte('testing_date', addDays(monthRange(today())[0], -31)).then(({ data }) => setRows((data ?? []) as RecordRow[]))
  }, [id])
  if (!p || !rows) return <Spinner />
  const ws = weekStart(today()), ms = monthRange(today())[0]
  const periods = [['Today', rows.filter(r => r.testing_date === today())], ['This week', rows.filter(r => r.testing_date >= ws)], ['This month', rows.filter(r => r.testing_date >= ms)], ['Last 30 days', rows.filter(r => r.testing_date >= addDays(today(), -29))]] as const
  const cmp = periods.map(([n, r]) => { const s = stats(r); return { period: n, Quantity: s.qty, Rectifiers: s.records, Failed: s.failed } })
  const m = stats(periods[2][1])
  return (
    <div className="space-y-5">
      <div><Link to="/" className="text-xs text-brand-600 hover:underline">Back to dashboard</Link><h1 className="text-xl font-semibold">{p.full_name}</h1><p className="text-sm text-slate-500">{p.employee_id ?? 'No employee ID'} · {p.email}</p></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Quantity this month" value={m.qty} /><Stat label="FO numbers handled" value={m.fos} /><Stat label="Rectifiers tested" value={m.records} /><Stat label="Average daily output" value={m.avg} />
        <Stat label="No load completed" value={m.nl} tone="green" /><Stat label="Short circuit completed" value={m.sc} tone="green" /><Stat label="Load completed" value={m.lt} tone="green" /><Stat label="Failed tests / problems" value={`${m.failed} / ${m.problems}`} tone="red" /></div>
      <Card title="Daily, weekly and monthly comparison"><div className="h-56"><ResponsiveContainer><BarChart data={cmp}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="period" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><Tooltip /><Legend /><Bar dataKey="Quantity" fill="#1f5f99" /><Bar dataKey="Rectifiers" fill="#f2a900" /><Bar dataKey="Failed" fill="#dc2626" /></BarChart></ResponsiveContainer></div></Card>
      <Records fixedEngineer={id} />
    </div>
  )
}


// ===== Engineers =====

const empty = { full_name: '', employee_id: '', email: '', password: '', department: 'Testing' }
export function Engineers() {
  const [rows, setRows] = useState<Profile[] | null>(null); const [add, setAdd] = useState(false); const [edit, setEdit] = useState<Profile | null>(null)
  const [f, setF] = useState(empty); const [busy, setBusy] = useState(false); const [q, setQ] = useState('')
  const load = useCallback(async () => { const { data } = await supabase.from('profiles').select('*').order('full_name'); setRows((data ?? []) as Profile[]) }, [])
  useEffect(() => { load() }, [load])
  const call = async (body: any, ok: string) => {
    setBusy(true); const { data, error } = await supabase.functions.invoke(FN_CREATE_ENGINEER, { body }); setBusy(false)
    if (error || data?.error) { toast(data?.error ?? error?.message ?? 'Request failed', 'err'); return false }
    toast(ok); return true
  }
  const toggle = async (p: Profile) => {
    if (!confirm(`${p.is_active ? 'Deactivate' : 'Reactivate'} ${p.full_name}?`)) return
    const { error } = await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id); error ? toast(error.message, 'err') : load()
  }
  const reset = async (p: Profile) => {
    const pw = prompt(`New password for ${p.full_name} (8+ characters):`); if (!pw) return
    await call({ action: 'reset_password', user_id: p.id, password: pw }, 'Password reset')
  }
  const saveEdit = async () => {
    if (!edit || !edit.full_name.trim()) return toast('Name is required', 'err')
    const { error } = await supabase.from('profiles').update({ full_name: edit.full_name.trim(), employee_id: edit.employee_id || null, department: edit.department }).eq('id', edit.id)
    error ? toast(error.message, 'err') : (toast('Engineer updated'), setEdit(null), load())
  }
  const k = (n: keyof typeof f, l: string, type = 'text') => <div><label className="lbl">{l}</label><input className="inp" type={type} value={f[n]} onChange={e => setF({ ...f, [n]: e.target.value })} /></div>
  const shown = (rows ?? []).filter(p => (p.full_name + p.email + (p.employee_id ?? '')).toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">Engineers</h1><div className="flex gap-2"><input className="inp !w-56" placeholder="Search name, email, ID" value={q} onChange={e => setQ(e.target.value)} /><Btn onClick={() => setAdd(true)}>+ Add engineer</Btn></div></div>
      <Card className="!p-0">{!rows ? <Spinner /> : <Table head={['Name', 'Employee ID', 'Email', 'Department', 'Role', 'Status', 'Actions']} empty={!shown.length}>
        {shown.map(p => <tr key={p.id}><td className="td">{p.role === 'engineer' ? <Link className="text-brand-600 hover:underline" to={`/engineers/${p.id}`}>{p.full_name}</Link> : p.full_name}</td><td className="td">{p.employee_id}</td><td className="td">{p.email}</td><td className="td">{p.department}</td><td className="td">{p.role === 'admin' ? 'Manager' : 'Engineer'}</td>
          <td className="td"><Badge v={p.is_active ? 'Completed' : 'Failed'} /> {p.is_active ? 'Active' : 'Inactive'}</td>
          <td className="td space-x-3">{p.role === 'engineer' && <><button className="text-brand-600 hover:underline" onClick={() => setEdit(p)}>Edit</button><button className="text-brand-600 hover:underline" onClick={() => reset(p)}>Reset password</button><button className="text-brand-600 hover:underline" onClick={() => toggle(p)}>{p.is_active ? 'Deactivate' : 'Reactivate'}</button></>}</td></tr>)}</Table>}</Card>
      {add && <Modal title="Add testing engineer" onClose={() => setAdd(false)}><div className="space-y-3">{k('full_name', 'Full name')}{k('employee_id', 'Employee ID')}{k('email', 'Email (used to log in)', 'email')}{k('password', 'Password (8+ characters)', 'password')}{k('department', 'Department')}
        <Btn disabled={busy} onClick={async () => { if (await call({ action: 'create', ...f }, 'Engineer account created')) { setAdd(false); setF(empty); load() } }}>Create account</Btn></div></Modal>}
      {edit && <Modal title={`Edit ${edit.email}`} onClose={() => setEdit(null)}><div className="space-y-3">
        <div><label className="lbl">Full name</label><input className="inp" value={edit.full_name} onChange={e => setEdit({ ...edit, full_name: e.target.value })} /></div>
        <div><label className="lbl">Employee ID</label><input className="inp" value={edit.employee_id ?? ''} onChange={e => setEdit({ ...edit, employee_id: e.target.value })} /></div>
        <div><label className="lbl">Department</label><input className="inp" value={edit.department ?? ''} onChange={e => setEdit({ ...edit, department: e.target.value })} /></div><Btn onClick={saveEdit}>Save changes</Btn></div></Modal>}
    </div>
  )
}


// ===== ReportForm =====

type P = Partial<Problem> & { file?: File | null }
const blank: any = { testing_date: today(), fo_number: '', series_number: '', rectifier_rating: '', quantity: 1, ordered_quantity: '', no_load_status: 'not_started', short_circuit_status: 'not_started', load_test_status: 'not_started', functional_status: 'not_started', remarks: '',
  test_start_at: '', test_end_at: '', verified_by: '' }
const normTimes = (r: any) => ({ ...r, test_start_at: dtLocal(r.test_start_at), test_end_at: dtLocal(r.test_end_at), verified_by: r.verified_by ?? '' })
const newProblem = (): P => ({ category: CATEGORIES[0], description: '', severity: 'low', problem_status: 'open', file: null })

export function ReportForm() {
  const { profile } = useAuth(); const { id } = useParams(); const nav = useNavigate()
  const [f, setF] = useState<any>(blank); const [ratings, setRatings] = useState<string[]>([]); const [custom, setCustom] = useState(false)
  const [hasProblem, setHasProblem] = useState(false); const [problems, setProblems] = useState<P[]>([])
  const [dup, setDup] = useState(''); const [busy, setBusy] = useState(false); const [ready, setReady] = useState(!id); const [locked, setLocked] = useState(false)
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }))

  useEffect(() => {
    supabase.from('rating_options').select('rating_name').eq('is_active', true).order('rating_name').then(({ data }) => setRatings((data ?? []).map(r => r.rating_name)))
    if (!id) return
    supabase.from('rectifier_records').select('*, technical_problems(*)').eq('id', id).single().then(({ data, error }) => {
      if (error || !data) { toast('Record not found', 'err'); return nav('/') }
      const { technical_problems, ...rec } = data as any
      setF(normTimes(rec)); setProblems(technical_problems); setHasProblem(technical_problems.length > 0); setReady(true)
      setLocked(rec.engineer_id !== profile.id && profile.role !== 'admin')
    })
  }, [id])

  const checkDup = async () => {
    if (!f.fo_number || !f.series_number) return setDup('')
    let q = supabase.from('rectifier_records').select('id, testing_date').eq('fo_number', f.fo_number.trim()).eq('series_number', f.series_number.trim()).limit(1)
    if (id) q = q.neq('id', id)
    const { data } = await q
    setDup(data?.length ? `FO ${f.fo_number} with series ${f.series_number} was already recorded on ${data[0].testing_date}.` : '')
  }

  const save = async (status: 'draft' | 'submitted') => {
    if (!f.fo_number.trim() || !f.series_number.trim() || !f.rectifier_rating.trim() || !(f.quantity > 0)) return toast('FO number, series number, rating and a quantity above 0 are required', 'err')
    if (hasProblem && problems.some(p => !p.description?.trim())) return toast('Describe every reported problem', 'err')
    if (status === 'submitted') {
      const anyStarted = STAGES.some(st => f[`${st.key}_status`] !== 'not_started'), finished = finalStatus(f) !== 'Pending'
      if (anyStarted && !f.test_start_at) return toast('Enter the testing start date and time', 'err')
      if (finished && !f.test_end_at) return toast('Enter the testing end date and time', 'err')
      if (f.test_start_at && f.test_end_at && f.test_end_at <= f.test_start_at) return toast('End date/time must be after the start date/time', 'err')
      if (finished && !(f.verified_by || '').trim()) return toast('Enter the name of the in-charge / manager who verified the testing', 'err')
    }
    setBusy(true)
    try {
      const payload = { testing_date: f.testing_date, fo_number: f.fo_number.trim(), series_number: f.series_number.trim(), rectifier_rating: f.rectifier_rating.trim(), quantity: Number(f.quantity),
        no_load_status: f.no_load_status, short_circuit_status: f.short_circuit_status, load_test_status: f.load_test_status, functional_status: f.functional_status,
        test_start_at: f.test_start_at || null, test_end_at: f.test_end_at || null, verified_by: (f.verified_by || '').trim() || null, remarks: f.remarks || null, ordered_quantity: f.ordered_quantity ? Number(f.ordered_quantity) : null, submission_status: status }
      let rid = id
      if (id) { const { error } = await supabase.from('rectifier_records').update(payload).eq('id', id); if (error) throw error }
      else { const { data, error } = await supabase.from('rectifier_records').insert({ ...payload, engineer_id: profile.id }).select('id').single(); if (error) throw error; rid = data.id }
      for (const p of hasProblem && (!id || f.engineer_id === profile.id) ? problems : []) {
        let image_url = p.image_url ?? null
        if (p.file) {
          const path = `${profile.id}/${Date.now()}-${p.file.name.replace(/[^\w.]/g, '_')}`
          const up = await supabase.storage.from('problem-images').upload(path, p.file); if (up.error) throw up.error; image_url = path
        }
        const row = { category: p.category, description: p.description, severity: p.severity, problem_status: p.problem_status, image_url }
        const r = p.id ? await supabase.from('technical_problems').update(row).eq('id', p.id) : await supabase.from('technical_problems').insert({ ...row, record_id: rid, reported_by: profile.id })
        if (r.error) throw r.error
      }
      toast(status === 'draft' ? 'Draft saved' : 'Daily report submitted')
      nav('/')
    } catch (e: any) { toast(e.message ?? 'Could not save', 'err') } finally { setBusy(false) }
  }

  if (!ready) return <Spinner />
  const upd = (i: number, k: string, v: any) => setProblems(a => a.map((p, j) => j === i ? { ...p, [k]: v } : p))
  const ratingVal = custom ? '__custom' : f.rectifier_rating
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold">{id ? 'Edit testing report' : 'New testing report'}</h1>
      <Card title="Product information"><div className="grid gap-3 sm:grid-cols-2">
        <div><label className="lbl">Date</label><input className="inp bg-slate-50" type="date" value={f.testing_date} readOnly={!!id} onChange={e => set('testing_date', e.target.value)} /></div>
        <div><label className="lbl">Engineer</label><input className="inp bg-slate-50" value={profile.full_name} readOnly /></div>
        <div><label className="lbl">FO number (company order no.) *</label><input className="inp" value={f.fo_number} onChange={e => set('fo_number', e.target.value)} onBlur={checkDup} /></div>
        <div><label className="lbl">Series number *</label><input className="inp" value={f.series_number} onChange={e => set('series_number', e.target.value)} onBlur={checkDup} /></div>
        {dup && <p className="rounded bg-amber-100 p-2 text-sm text-amber-900 sm:col-span-2">Duplicate warning: {dup} You can still save if this is intended.</p>}
        <div><label className="lbl">Rectifier rating *</label>
          <select className="inp" value={ratingVal || ''} onChange={e => { if (e.target.value === '__custom') { setCustom(true); set('rectifier_rating', '') } else { setCustom(false); set('rectifier_rating', e.target.value) } }}>
            <option value="">Select rating</option>{ratings.map(r => <option key={r}>{r}</option>)}<option value="__custom">Custom rating…</option></select>
          {(custom || (f.rectifier_rating && !ratings.includes(f.rectifier_rating))) && <input className="inp mt-2" placeholder="e.g. 48V 2000A" value={f.rectifier_rating} onChange={e => set('rectifier_rating', e.target.value)} />}</div>
        <div><label className="lbl">Quantity tested in this entry *</label><input className="inp" type="number" min={1} value={f.quantity} onChange={e => set('quantity', e.target.value)} /></div>
        <div><label className="lbl">Order quantity (total ordered under this FO)</label><input className="inp" type="number" min={1} value={f.ordered_quantity ?? ''} onChange={e => set('ordered_quantity', e.target.value)} /></div>
        <div className="sm:col-span-2"><label className="lbl">Problems / observations (optional)</label><textarea className="inp" rows={2} value={f.remarks ?? ''} onChange={e => set('remarks', e.target.value)} /></div></div></Card>
      <Card title="Testing stages: status">
        <div className="grid gap-3 sm:grid-cols-4">{STAGES.map(st => (
          <div key={st.key}><label className="lbl">{st.label}</label><select className="inp" value={f[`${st.key}_status`]} onChange={e => set(`${st.key}_status`, e.target.value)}>{TEST_STATUSES.map(x => <option key={x.v} value={x.v}>{x.l}</option>)}</select></div>))}</div></Card>
      <Card title="Complete testing time and verification" right={<span className="text-sm font-semibold text-brand-900">Total test time: {fmtDur(spanMins(f.test_start_at, f.test_end_at))}</span>}>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="lbl">Testing start (date and time)</label><input type="datetime-local" className="inp" value={f.test_start_at ?? ''} onChange={e => set('test_start_at', e.target.value)} /><button type="button" className="mt-1 text-xs text-brand-600 hover:underline" onClick={() => set('test_start_at', nowDT())}>Set to now</button></div>
          <div><label className="lbl">Testing end (date and time)</label><input type="datetime-local" className="inp" value={f.test_end_at ?? ''} onChange={e => set('test_end_at', e.target.value)} /><button type="button" className="mt-1 text-xs text-brand-600 hover:underline" onClick={() => set('test_end_at', nowDT())}>Set to now</button></div>
          <div><label className="lbl">Verified by (In-charge / Manager name)</label><input className="inp" placeholder="Name of person who verified the testing" value={f.verified_by ?? ''} onChange={e => set('verified_by', e.target.value)} /></div></div>
        <p className="mt-3 text-xs text-slate-500">Enter when the full testing of this FO started and when it ended. End time and the verifier's name are required once all tests are completed (or any test fails).</p></Card>
      <Card title="Is there any problem identified during testing?">
        <div className="flex gap-6 text-sm">{[false, true].map(v => <label key={String(v)} className="flex items-center gap-2"><input type="radio" checked={hasProblem === v} onChange={() => { setHasProblem(v); if (v && !problems.length) setProblems([newProblem()]) }} />{v ? 'Yes' : 'No'}</label>)}</div>
        {hasProblem && <div className="mt-4 space-y-4">{problems.map((p, i) => (
          <div key={p.id ?? i} className="space-y-3 rounded-md border border-slate-200 p-3"><div className="grid gap-3 sm:grid-cols-3">
            <div><label className="lbl">Category</label><select className="inp" value={p.category} onChange={e => upd(i, 'category', e.target.value)}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
            <div><label className="lbl">Severity</label><select className="inp" value={p.severity} onChange={e => upd(i, 'severity', e.target.value)}>{SEVERITIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></div>
            <div><label className="lbl">Status</label><select className="inp" value={p.problem_status} onChange={e => upd(i, 'problem_status', e.target.value)}>{PROBLEM_STATUSES.map(c => <option key={c.v} value={c.v}>{c.l}</option>)}</select></div></div>
            <div><label className="lbl">Description *</label><textarea className="inp" rows={2} value={p.description} onChange={e => upd(i, 'description', e.target.value)} /></div>
            <div className="flex flex-wrap items-center gap-3"><input type="file" accept="image/*" className="text-xs" onChange={e => upd(i, 'file', e.target.files?.[0] ?? null)} />{p.image_url && <SignedImg path={p.image_url} />}
              {!p.id && <button className="ml-auto text-red-600" onClick={() => setProblems(a => a.filter((_, j) => j !== i))}><Trash2 size={16} /></button>}</div></div>))}
          <Btn kind="ghost" onClick={() => setProblems(a => [...a, newProblem()])}><Plus size={14} />Add another problem</Btn></div>}</Card>
      {!locked && <div className="flex flex-wrap gap-3 pb-6"><Btn kind="ghost" disabled={busy} onClick={() => save('draft')}>Save as Draft</Btn><Btn disabled={busy} onClick={() => save('submitted')}>Submit Daily Report</Btn></div>}
    </div>
  )
}


// ===== Records =====

const PAGE = 20
export function Records({ fixedEngineer }: { fixedEngineer?: string }) {
  const { profile } = useAuth(); const admin = profile.role === 'admin'
  const [f, setF] = useState<any>({ from: '', to: '', engineer: fixedEngineer ?? '', fo: '', series: '', pstatus: '' })
  const [sort, setSort] = useState('testing_date:desc'); const [page, setPage] = useState(0); const [rows, setRows] = useState<RecordRow[] | null>(null); const [count, setCount] = useState(0)
  const [engs, setEngs] = useState<{ id: string; full_name: string }[]>([])
  const [open, setOpen] = useState<RecordRow | null>(null)
  const set = (k: string, v: string) => { setF((s: any) => ({ ...s, [k]: v })); setPage(0) }

  useEffect(() => {
    if (admin) supabase.from('profiles').select('id, full_name').eq('role', 'engineer').order('full_name').then(({ data }) => setEngs(data ?? []))
  }, [admin])

  const load = useCallback(async () => {
    let q = supabase.from('rectifier_records').select(`*, profiles:engineer_id(full_name), technical_problems${f.pstatus ? '!inner' : ''}(*)`, { count: 'exact' })
    if (f.from) q = q.gte('testing_date', f.from); if (f.to) q = q.lte('testing_date', f.to)
    if (f.engineer) q = q.eq('engineer_id', f.engineer)
    if (f.fo) q = q.ilike('fo_number', `%${f.fo}%`); if (f.series) q = q.ilike('series_number', `%${f.series}%`)
    if (f.pstatus) q = q.eq('technical_problems.problem_status', f.pstatus)
    const [sc, sd] = sort.split(':')
    const { data, count, error } = await q.order(sc, { ascending: sd === 'asc' }).order('created_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (error) toast(error.message, 'err')
    setRows((data ?? []) as RecordRow[]); setCount(count ?? 0)
  }, [f, page, sort])
  useEffect(() => { load() }, [load]); useRealtime(['rectifier_records'], load)

  const del = async (r: RecordRow) => {
    if (!confirm(`Delete record FO ${r.fo_number} / ${r.series_number}? This cannot be undone (it is kept in the audit log).`)) return
    const { error } = await supabase.from('rectifier_records').delete().eq('id', r.id)
    error ? toast(error.message, 'err') : (toast('Record deleted'), load())
  }
  const pages = Math.max(1, Math.ceil(count / PAGE))
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{admin ? 'Testing records' : 'My records'}</h1>
      <Card><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <div><label className="lbl">From</label><input type="date" className="inp" value={f.from} onChange={e => set('from', e.target.value)} /></div>
        <div><label className="lbl">To</label><input type="date" className="inp" value={f.to} onChange={e => set('to', e.target.value)} /></div>
        {admin && !fixedEngineer && <div><label className="lbl">Engineer</label><select className="inp" value={f.engineer} onChange={e => set('engineer', e.target.value)}><option value="">All</option>{engs.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>}
        <div><label className="lbl">FO number</label><input className="inp" value={f.fo} onChange={e => set('fo', e.target.value)} /></div>
        <div><label className="lbl">Series number</label><input className="inp" value={f.series} onChange={e => set('series', e.target.value)} /></div>
        <div><label className="lbl">Problem status</label><select className="inp" value={f.pstatus} onChange={e => set('pstatus', e.target.value)}><option value="">All</option><option value="open">Open</option><option value="under_investigation">Under investigation</option><option value="resolved">Resolved</option></select></div><div><label className="lbl">Sort by</label><select className="inp" value={sort} onChange={e => { setSort(e.target.value); setPage(0) }}>{[['testing_date:desc', 'Date, newest'], ['testing_date:asc', 'Date, oldest'], ['fo_number:asc', 'FO number'], ['series_number:asc', 'Series number'], ['rectifier_rating:asc', 'Rating'], ['quantity:desc', 'Quantity, high to low']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div></div></Card>
      <Card className="!p-0">{!rows ? <Spinner /> :
        <Table head={['Date', 'Engineer', 'FO', 'Series', 'Rating', 'Qty', 'No load', 'Short circuit', 'Load', 'Functional', 'Test time', 'Problem', 'Final status', 'Actions']} empty={!rows.length}>
          {rows.map(r => <tr key={r.id}><td className="td">{r.testing_date}</td><td className="td">{r.profiles?.full_name}</td><td className="td">{r.fo_number}</td><td className="td">{r.series_number}</td><td className="td">{r.rectifier_rating}</td><td className="td">{r.quantity}</td>
            <td className="td"><Badge v={r.no_load_status} /></td><td className="td"><Badge v={r.short_circuit_status} /></td><td className="td"><Badge v={r.load_test_status} /></td><td className="td"><Badge v={r.functional_status} /></td><td className="td">{fmtDur(testMinutes(r))}</td>
            <td className="td">{r.technical_problems?.length ? <Badge v="open" /> : 'No'}</td><td className="td"><Badge v={r.submission_status === 'draft' ? 'draft' : finalStatus(r)} /></td>
            <td className="td space-x-3"><button className="text-brand-600 hover:underline" onClick={() => setOpen(r)}>View</button><Link className="text-brand-600 hover:underline" to={`/report/${r.id}`}>Edit</Link>{admin && <button className="text-red-600 hover:underline" onClick={() => del(r)}>Delete</button>}</td></tr>)}</Table>}
        <div className="flex items-center justify-between border-t p-3 text-sm"><span>{count} records</span><div className="flex items-center gap-2">
          <Btn kind="ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</Btn><span>Page {page + 1} of {pages}</span><Btn kind="ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</Btn></div></div></Card>
      {open && <Modal title={`FO ${open.fo_number} / ${open.series_number}`} onClose={() => setOpen(null)}>
        <dl className="grid grid-cols-2 gap-3 text-sm">{[['Date', open.testing_date], ['Engineer', open.profiles?.full_name], ['Rating', open.rectifier_rating], ['Quantity', open.quantity], ['Testing started', fmtDT(open.test_start_at)], ['Testing ended', fmtDT(open.test_end_at)], ['Total test time', fmtDur(testMinutes(open))], ['Verified by', open.verified_by || '-'], ['Saved as', open.submission_status], ['Remarks', open.remarks || 'None'], ['Last updated', new Date(open.updated_at).toLocaleString()]].map(([k, v]) => <div key={String(k)}><dt className="text-xs text-slate-500">{k}</dt><dd>{v}</dd></div>)}</dl>
        <h4 className="mb-2 mt-4 text-sm font-semibold">Testing stages</h4>
        <Table head={['Stage', 'Status']}>{STAGES.map(st => <tr key={st.key}><td className="td">{st.label}</td><td className="td"><Badge v={open[`${st.key}_status`]} /></td></tr>)}</Table>
        <h4 className="mb-2 mt-4 text-sm font-semibold">Problems ({open.technical_problems?.length ?? 0})</h4>
        {open.technical_problems?.map(p => <div key={p.id} className="mb-2 flex items-start gap-3 rounded border p-2 text-sm"><div className="flex-1"><b>{p.category}</b> <Badge v={p.severity} /> <Badge v={p.problem_status} /><p className="text-slate-600">{p.description}</p></div>{p.image_url && <SignedImg path={p.image_url} />}</div>)}</Modal>}
    </div>
  )
}



// ===== Problems =====

type Row = Problem & { rectifier_records: { fo_number: string; series_number: string; rectifier_rating: string; profiles: { full_name: string } | null } }
export function Problems() {
  const { profile } = useAuth(); const admin = profile.role === 'admin'
  const [rows, setRows] = useState<Row[] | null>(null); const [st, setSt] = useState(''); const [edit, setEdit] = useState<Row | null>(null)
  const load = useCallback(async () => {
    let q = supabase.from('technical_problems').select('*, rectifier_records(fo_number, series_number, rectifier_rating, profiles:engineer_id(full_name))').order('created_at', { ascending: false }).limit(300)
    if (st) q = q.eq('problem_status', st)
    const { data } = await q; setRows((data ?? []) as any)
  }, [st])
  useEffect(() => { load() }, [load]); useRealtime(['technical_problems'], load)

  const saveEdit = async () => {
    if (!edit) return
    const { error } = await supabase.from('technical_problems').update({ problem_status: edit.problem_status, assigned_to: edit.assigned_to || null, resolution_remarks: edit.resolution_remarks || null,
      resolved_at: edit.problem_status === 'resolved' ? (edit.resolved_at ?? new Date().toISOString()) : null }).eq('id', edit.id)
    error ? toast(error.message, 'err') : (toast('Problem updated'), setEdit(null), load())
  }
  const rowTone = (p: Problem) => p.problem_status === 'resolved' ? 'border-l-emerald-500' : ['critical', 'high'].includes(p.severity) ? 'border-l-red-500' : p.severity === 'medium' ? 'border-l-orange-400' : 'border-l-slate-300'
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-xl font-semibold">{admin ? 'Technical problem tracking' : 'My reported problems'}</h1>
        <select className="inp !w-auto" value={st} onChange={e => setSt(e.target.value)}><option value="">All statuses</option>{PROBLEM_STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
      <Card className="!p-0">{!rows ? <Spinner /> :
        <Table head={['ID', 'Reported', 'Engineer', 'FO', 'Series', 'Rating', 'Category', 'Description', 'Severity', 'Image', 'Status', 'Assigned to', 'Resolution remarks', 'Resolved', '']} empty={!rows.length}>
          {rows.map(p => <tr key={p.id} className={`border-l-4 ${rowTone(p)}`}><td className="td font-mono text-xs">{p.id.slice(0, 8)}</td><td className="td">{p.created_at.slice(0, 10)}</td><td className="td">{p.rectifier_records?.profiles?.full_name}</td>
            <td className="td">{p.rectifier_records?.fo_number}</td><td className="td">{p.rectifier_records?.series_number}</td><td className="td">{p.rectifier_records?.rectifier_rating}</td><td className="td">{p.category}</td>
            <td className="td max-w-xs truncate" title={p.description}>{p.description}</td><td className="td"><Badge v={p.severity} /></td><td className="td">{p.image_url && <SignedImg path={p.image_url} />}</td><td className="td"><Badge v={p.problem_status} /></td>
            <td className="td">{p.assigned_to}</td><td className="td max-w-[12rem] truncate">{p.resolution_remarks}</td><td className="td">{p.resolved_at?.slice(0, 10)}</td>
            <td className="td">{admin && <button className="text-brand-600 hover:underline" onClick={() => setEdit(p)}>Update</button>}</td></tr>)}</Table>}</Card>
      {edit && <Modal title="Update problem" onClose={() => setEdit(null)}><div className="space-y-3">
        <div><label className="lbl">Status</label><select className="inp" value={edit.problem_status} onChange={e => setEdit({ ...edit, problem_status: e.target.value as any })}>{PROBLEM_STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}</select></div>
        <div><label className="lbl">Assigned technician</label><input className="inp" value={edit.assigned_to ?? ''} onChange={e => setEdit({ ...edit, assigned_to: e.target.value })} /></div>
        <div><label className="lbl">Resolution remarks</label><textarea className="inp" rows={3} value={edit.resolution_remarks ?? ''} onChange={e => setEdit({ ...edit, resolution_remarks: e.target.value })} /></div>
        <Btn onClick={saveEdit}>Save changes</Btn></div></Modal>}
    </div>
  )
}


// ===== Reports =====

const TYPES = [['daily_one', 'Individual engineer daily report'], ['daily_all', 'All-engineer daily report'], ['weekly', 'Weekly productivity report'], ['monthly', 'Monthly productivity report'], ['rating', 'Rectifier rating-wise report'], ['utilisation', 'Engineer 8-hour work utilisation (daily)'], ['problems', 'Problem analysis report']]

export function Reports() {
  const [type, setType] = useState('daily_all'); const [date, setDate] = useState(today()); const [eng, setEng] = useState('')
  const [engs, setEngs] = useState<{ id: string; full_name: string }[]>([]); const [tbl, setTbl] = useState<Tbl | null>(null); const [busy, setBusy] = useState(false)
  useEffect(() => { supabase.from('profiles').select('id, full_name').eq('role', 'engineer').order('full_name').then(({ data }) => setEngs(data ?? [])) }, [])

  const build = async () => {
    if (type === 'daily_one' && !eng) return toast('Choose an engineer', 'err')
    setBusy(true)
    const [from, to] = type.startsWith('daily') || type === 'utilisation' ? [date, date] : type === 'weekly' ? [weekStart(date), addDays(weekStart(date), 6)] : monthRange(date)
    const period = from === to ? from : `${from} to ${to}`
    let q = supabase.from('rectifier_records').select(RECORD_SELECT).gte('testing_date', from).lte('testing_date', to).eq('submission_status', 'submitted').order('testing_date')
    if (type === 'daily_one') q = q.eq('engineer_id', eng)
    const { data, error } = await q; setBusy(false)
    if (error) return toast(error.message, 'err')
    const rs = (data ?? []) as RecordRow[]; const name = (r: RecordRow) => r.profiles?.full_name ?? ''
    const sub = type === 'daily_one' ? `${engs.find(e => e.id === eng)?.full_name} | ${period}` : period
    const probs = rs.flatMap(r => (r.technical_problems ?? []).map(p => ({ ...p, r })))
    if (type.startsWith('daily')) {
      const total = rs.reduce((a, r) => a + r.quantity, 0)
      setTbl({ title: type === 'daily_one' ? 'Engineer Daily Report' : 'All Engineers Daily Report', subtitle: sub,
        columns: ['Engineer', 'FO No.', 'Series No.', 'Rating', 'Qty', 'No Load', 'Short Circuit', 'Load Test', 'Functional / Program Check', 'Testing Start', 'Testing End', 'Total Test Time', 'Verified By', 'Problems', 'Remarks'],
        rows: [...rs.map(r => [name(r), r.fo_number, r.series_number, r.rectifier_rating, r.quantity, label(r.no_load_status), label(r.short_circuit_status), label(r.load_test_status), label(r.functional_status), fmtDT(r.test_start_at), fmtDT(r.test_end_at), fmtDur(testMinutes(r)), r.verified_by ?? '', (r.technical_problems ?? []).map((p: Problem) => `${p.category} (${p.severity})`).join('; ') || 'None', r.remarks ?? '']), ['TOTAL', '', '', '', total, '', '', '', '', '', '', fmtDur(rs.reduce((a, r) => a + testMinutes(r), 0)), '', '', '']] })
    } else if (type === 'utilisation') {
      const ids = [...new Set(rs.map(r => r.engineer_id))]
      setTbl({ title: 'Engineer 8-hour Work Utilisation', subtitle: sub, columns: ['Engineer', 'Records', 'Total qty', 'Sum of stage times', 'Actual testing time', '8h shift used', 'Balance of 8h'],
        rows: ids.map(i => { const x = rs.filter(r => r.engineer_id === i); const s = stats(x); const b = busyMinutes(x); return [name(x[0]), s.records, s.qty, fmtDur(s.testMins), fmtDur(b), Math.round(b / SHIFT_MINUTES * 100) + '%', fmtDur(Math.max(0, SHIFT_MINUTES - b))] }) })
    } else if (type === 'weekly' || type === 'monthly') {
      const ids = [...new Set(rs.map(r => r.engineer_id))]
      setTbl({ title: type === 'weekly' ? 'Weekly Productivity Report' : 'Monthly Productivity Report', subtitle: sub,
        columns: ['Engineer', 'Days worked', 'FO numbers', 'Rectifiers', 'Total qty', 'Avg daily qty', 'No Load done', 'Short Circuit done', 'Load done', 'Functional done', 'Failed tests', 'Problems', 'Testing time'],
        rows: ids.map(i => { const x = rs.filter(r => r.engineer_id === i); const s = stats(x); return [name(x[0]), s.days, s.fos, s.records, s.qty, s.avg, s.nl, s.sc, s.lt, s.fc, s.failed, s.problems, fmtDur(busyMinutes(x))] }) })
    } else if (type === 'rating') {
      const rt = [...new Set(rs.map(r => r.rectifier_rating))].sort()
      setTbl({ title: 'Rating-wise Testing Report', subtitle: sub, columns: ['Rating', 'Records', 'Total qty', 'FO numbers', 'No Load done', 'Short Circuit done', 'Load done', 'Functional done', 'Fully completed', 'Failed tests'],
        rows: rt.map(k => { const x = rs.filter(r => r.rectifier_rating === k); const s = stats(x); return [k, s.records, s.qty, s.fos, s.nl, s.sc, s.lt, s.fc, x.filter(r => finalStatus(r) === 'Completed').length, s.failed] }) })
    } else {
      const cats = [...new Set(probs.map(p => p.category))]
      setTbl({ title: 'Problem Analysis Report', subtitle: sub, columns: ['Category', 'Total', 'Critical', 'High', 'Medium', 'Low', 'Open', 'Under investigation', 'Resolved'],
        rows: cats.map(c => { const x = probs.filter(p => p.category === c); const n = (k: 'severity' | 'problem_status', v: string) => x.filter(p => p[k] === v).length
          return [c, x.length, n('severity', 'critical'), n('severity', 'high'), n('severity', 'medium'), n('severity', 'low'), n('problem_status', 'open'), n('problem_status', 'under_investigation'), n('problem_status', 'resolved')] }) })
    }
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      <Card><div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className="lbl">Report</label><select className="inp" value={type} onChange={e => { setType(e.target.value); setTbl(null) }}>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className="lbl">{type === 'weekly' ? 'Any date in the week' : type === 'monthly' ? 'Any date in the month' : 'Date'}</label><input type="date" className="inp" value={date} onChange={e => setDate(e.target.value)} /></div>
        {type === 'daily_one' && <div><label className="lbl">Engineer</label><select className="inp" value={eng} onChange={e => setEng(e.target.value)}><option value="">Select</option>{engs.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div>}</div>
        <Btn className="mt-4" onClick={build} disabled={busy}>Generate report</Btn><p className="mt-2 text-xs text-slate-500">Reports include submitted records only; drafts are excluded.</p></Card>
      {busy && <Spinner />}
      {tbl && <Card className="print-area" title={tbl.title} right={<div className="flex gap-2 print:hidden"><Btn kind="ghost" onClick={() => toXLSX(tbl)}><Download size={14} />Excel</Btn><Btn kind="ghost" onClick={() => toCSV(tbl)}><Download size={14} />CSV</Btn><Btn kind="ghost" onClick={() => toPDF(tbl)}><Download size={14} />PDF</Btn><Btn kind="ghost" onClick={() => window.print()}><Printer size={14} />Print</Btn></div>}>
        <div className="mb-3 flex items-center gap-3"><Logo size={36} /><div><div className="font-semibold text-brand-900">GETEK Electronics Pvt. Ltd.</div><div className="text-xs text-slate-500">{tbl.subtitle}</div></div></div>
        <Table head={tbl.columns} empty={!tbl.rows.length}>{tbl.rows.map((r, i) => <tr key={i} className={r[0] === 'TOTAL' ? 'bg-slate-50 font-semibold' : ''}>{r.map((c, j) => <td key={j} className="td">{c}</td>)}</tr>)}</Table></Card>}
    </div>
  )
}


// ===== Settings =====

export function Settings() {
  const [ratings, setRatings] = useState<{ id: string; rating_name: string; is_active: boolean }[]>([]); const [name, setName] = useState('')
  const [hours, setHours] = useState('24'); const [mcode, setMcode] = useState(''); const [logs, setLogs] = useState<any[]>([])
  const load = useCallback(async () => {
    const [r, s, mc, a] = await Promise.all([supabase.from('rating_options').select('*').order('rating_name'), supabase.from('app_settings').select('value').eq('key', 'edit_window_hours').single(), supabase.from('app_settings').select('value').eq('key', 'manager_signup_code').single(),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)])
    setRatings(r.data ?? []); if (mc.data) setMcode(mc.data.value); if (s.data) setHours(s.data.value); setLogs(a.data ?? [])
  }, [])
  useEffect(() => { load() }, [load])
  const done = (error: any, ok: string) => error ? toast(error.message, 'err') : (toast(ok), load())
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Card title="Engineer editing period"><p className="mb-3 text-sm text-slate-600">After submitting, engineers can edit their own report for this many hours. Drafts stay editable.</p>
        <div className="flex gap-2"><input className="inp !w-28" type="number" min={0} value={hours} onChange={e => setHours(e.target.value)} />
          <Btn onClick={async () => done((await supabase.from('app_settings').update({ value: String(Math.max(0, +hours || 0)) }).eq('key', 'edit_window_hours')).error, 'Editing period saved')}>Save</Btn></div></Card>
      <Card title="Manager registration code"><p className="mb-3 text-sm text-slate-600">New managers need this code on the sign-up page. Change it after your managers have registered.</p>
        <div className="flex gap-2"><input className="inp" value={mcode} onChange={e => setMcode(e.target.value)} />
          <Btn onClick={async () => mcode.trim().length < 6 ? toast('Use at least 6 characters', 'err') : done((await supabase.from('app_settings').upsert({ key: 'manager_signup_code', value: mcode.trim() })).error, 'Registration code saved')}>Save</Btn></div></Card>
      <Card title="Rectifier rating options">
        <div className="mb-3 flex gap-2"><input className="inp" placeholder="e.g. 48V 2000A" value={name} onChange={e => setName(e.target.value)} />
          <Btn onClick={async () => { if (!name.trim()) return; done((await supabase.from('rating_options').insert({ rating_name: name.trim() })).error, 'Rating added'); setName('') }}>Add</Btn></div>
        <div className="flex flex-wrap gap-2">{ratings.map(r => <button key={r.id} onClick={async () => done((await supabase.from('rating_options').update({ is_active: !r.is_active }).eq('id', r.id)).error, 'Rating updated')}
          className={`rounded-full border px-3 py-1 text-sm ${r.is_active ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-400 line-through'}`}>{r.rating_name}</button>)}</div>
        <p className="mt-2 text-xs text-slate-500">Click a rating to hide or show it in the entry form.</p></Card>
      <Card title="Audit trail (latest 50 changes)" className="!p-0"><Table head={['When', 'Action', 'Table', 'Record', 'Changed by', 'Change']} empty={!logs.length}>
        {logs.map(l => <tr key={l.id}><td className="td">{new Date(l.created_at).toLocaleString()}</td><td className="td">{l.action}</td><td className="td">{l.table_name}</td><td className="td font-mono text-xs">{String(l.record_id).slice(0, 8)}</td><td className="td font-mono text-xs">{String(l.user_id).slice(0, 8)}</td>
          <td className="td max-w-md truncate text-xs" title={JSON.stringify(l.new_data)}>{l.action === 'UPDATE' ? Object.keys(l.new_data).filter(k => JSON.stringify(l.new_data[k]) !== JSON.stringify(l.old_data[k]) && k !== 'updated_at').map(k => `${k}: ${l.old_data[k]} → ${l.new_data[k]}`).join(', ') : ''}</td></tr>)}</Table></Card>
    </div>
  )
}
