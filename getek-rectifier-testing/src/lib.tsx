import { createClient } from '@supabase/supabase-js'
import { createContext, ReactNode, useContext, useEffect, useState } from 'react'
import { Loader2, X, Zap } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'


export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)

export type TestStatus = 'not_started' | 'in_progress' | 'completed' | 'failed'
export interface Profile { id: string; full_name: string; employee_id: string | null; email: string; role: 'admin' | 'engineer'; department: string | null; is_active: boolean; created_at: string }
export interface Problem { id: string; record_id: string; reported_by: string; category: string; description: string; severity: 'low' | 'medium' | 'high' | 'critical'; image_url: string | null; problem_status: 'open' | 'under_investigation' | 'resolved'; assigned_to: string | null; resolution_remarks: string | null; resolved_at: string | null; created_at: string }
export interface RecordRow {
  id: string; engineer_id: string; testing_date: string; fo_number: string; series_number: string; rectifier_rating: string; quantity: number; ordered_quantity: number | null
  no_load_status: TestStatus; short_circuit_status: TestStatus; load_test_status: TestStatus; remarks: string | null
  submission_status: 'draft' | 'submitted'; created_at: string; updated_at: string
  functional_status: TestStatus
  profiles?: { full_name: string } | null; technical_problems?: Problem[]
  test_start_at: string | null; test_end_at: string | null; verified_by: string | null
  [key: string]: any
}

export const TEST_STATUSES: { v: TestStatus; l: string }[] = [
  { v: 'not_started', l: 'Not Started' }, { v: 'in_progress', l: 'In Progress' }, { v: 'completed', l: 'Completed' }, { v: 'failed', l: 'Failed' }]
export const CATEGORIES = ['Voltage Problem', 'Current Problem', 'Rectifier Not Starting', 'Cooling Fan Problem', 'Control Card Problem', 'PCB Problem', 'Transformer Problem', 'Diode / SCR Problem', 'Output Fluctuation', 'Overheating', 'Other']
export const SEVERITIES = ['low', 'medium', 'high', 'critical']
export const PROBLEM_STATUSES = [{ v: 'open', l: 'Open' }, { v: 'under_investigation', l: 'Under Investigation' }, { v: 'resolved', l: 'Resolved' }]

export const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())
export const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
export const today = () => iso(new Date())
export const addDays = (s: string, n: number) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
export const monthRange = (s: string) => { const d = new Date(s + 'T00:00:00'); return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))] as const }
export const weekStart = (s: string) => { const d = new Date(s + 'T00:00:00'); const day = (d.getDay() + 6) % 7; return addDays(s, -day) }

// ---- testing stages: status + start/end time + witness (in-charge / manager) ----
export const STAGES = [
  { key: 'no_load', label: 'No load test' },
  { key: 'short_circuit', label: 'Short circuit test' },
  { key: 'load_test', label: 'Load test' },
  { key: 'functional', label: 'Functional / program check' },
] as const
export const spanMins = (a?: string | null, b?: string | null) => {
  const x = a ? new Date(a).getTime() : NaN, y = b ? new Date(b).getTime() : NaN
  return Number.isFinite(x) && Number.isFinite(y) && y > x ? Math.round((y - x) / 60000) : 0
}
/** Complete testing time of one FO entry: overall start date/time to end date/time. */
export const testMinutes = (r: RecordRow) => spanMins(r.test_start_at, r.test_end_at)
/** Actual time worked by an engineer: overlapping tests are counted once. */
export function busyMinutes(rs: RecordRow[]) {
  const groups: Record<string, [number, number][]> = {}
  rs.forEach(r => { if (testMinutes(r) > 0) (groups[r.engineer_id] ??= []).push([new Date(r.test_start_at).getTime(), new Date(r.test_end_at).getTime()]) })
  let total = 0
  Object.values(groups).forEach(iv => {
    iv.sort((x, y) => x[0] - y[0]); let [cs, ce] = iv[0]
    for (const [a, b] of iv.slice(1)) { if (a <= ce) ce = Math.max(ce, b); else { total += ce - cs; cs = a; ce = b } }
    total += ce - cs
  })
  return Math.round(total / 60000)
}
export const fmtDur = (m: number) => (m > 0 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : '-')
export const fmtDT = (s?: string | null) => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '-')
export const dtLocal = (s?: string | null) => (s ? s.replace(' ', 'T').slice(0, 16) : '')
export const nowDT = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export const SHIFT_MINUTES = 480 // 8-hour working day

export function finalStatus(r: RecordRow) {
  const t = [r.no_load_status, r.short_circuit_status, r.load_test_status, r.functional_status]
  if (t.includes('failed')) return 'Failed'
  if (t.every(x => x === 'completed')) return 'Completed'
  return 'Pending'
}

/** Re-run `cb` whenever the given tables change (Supabase Realtime). */
export function useRealtime(tables: string[], cb: () => void) {
  useEffect(() => {
    const ch = supabase.channel('rt-' + tables.join('-') + Math.random().toString(36).slice(2))
    tables.forEach(t => ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => cb()))
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

export const RECORD_SELECT = '*, profiles:engineer_id(full_name), technical_problems(*)'

export function stats(rs: RecordRow[]) {
  const c = (k: 'no_load_status' | 'short_circuit_status' | 'load_test_status' | 'functional_status', s: string) => rs.filter(r => r[k] === s).length
  const days = new Set(rs.map(r => r.testing_date)).size
  const qty = rs.reduce((a, r) => a + r.quantity, 0)
  return {
    records: rs.length, qty, fos: new Set(rs.map(r => r.fo_number)).size, days, avg: days ? +(qty / days).toFixed(1) : 0,
    nl: c('no_load_status', 'completed'), sc: c('short_circuit_status', 'completed'), lt: c('load_test_status', 'completed'), fc: c('functional_status', 'completed'),
    failed: c('no_load_status', 'failed') + c('short_circuit_status', 'failed') + c('load_test_status', 'failed') + c('functional_status', 'failed'),
    testMins: rs.reduce((a, r) => a + testMinutes(r), 0),
    problems: rs.reduce((a, r) => a + (r.technical_problems?.length ?? 0), 0),
  }
}


export type Tbl = { title: string; subtitle?: string; columns: string[]; rows: (string | number)[][] }
const save = (blob: Blob, name: string) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href) }
const fname = (t: Tbl, ext: string) => `GETEK_${t.title.replace(/\W+/g, '_')}.${ext}`

export function toCSV(t: Tbl) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [t.columns, ...t.rows].map(r => r.map(esc).join(',')).join('\r\n')
  save(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }), fname(t, 'csv'))
}
export function toXLSX(t: Tbl) {
  const ws = XLSX.utils.aoa_to_sheet([['GETEK Electronics Pvt. Ltd.'], [t.title + (t.subtitle ? ' | ' + t.subtitle : '')], [], t.columns, ...t.rows])
  ws['!cols'] = t.columns.map(c => ({ wch: Math.max(12, c.length + 2) }))
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Report')
  XLSX.writeFile(wb, fname(t, 'xlsx'))
}
export async function toPDF(t: Tbl) {
  const doc = new jsPDF({ orientation: t.columns.length > 7 ? 'landscape' : 'portrait' })
  try { // logo from /public/logo.png if present
    const blob = await (await fetch('/logo.png')).blob()
    const url: string = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result as string); f.readAsDataURL(blob) })
    doc.addImage(url, 'PNG', 14, 8, 22, 22)
  } catch { /* no logo file */ }
  doc.setFontSize(15).setTextColor(10, 37, 64).text('GETEK Electronics Pvt. Ltd.', 40, 16)
  doc.setFontSize(10).setTextColor(60).text(t.title, 40, 23)
  if (t.subtitle) doc.text(t.subtitle, 40, 29)
  autoTable(doc, { startY: 36, head: [t.columns], body: t.rows.map(r => r.map(String)), styles: { fontSize: 8 }, headStyles: { fillColor: [16, 58, 96] } })
  doc.save(fname(t, 'pdf'))
}


// ---- toast ----
type T = { id: number; msg: string; kind: 'ok' | 'err' }
let push: (t: T) => void = () => {}
export const toast = (msg: string, kind: 'ok' | 'err' = 'ok') => push({ id: Math.random(), msg, kind })
export function ToastHost() {
  const [items, set] = useState<T[]>([])
  useEffect(() => { push = t => { set(s => [...s, t]); setTimeout(() => set(s => s.filter(x => x.id !== t.id)), 4000) } }, [])
  return <div className="fixed right-4 top-4 z-50 space-y-2">{items.map(t =>
    <div key={t.id} className={`rounded-md px-4 py-2 text-sm text-white shadow-lg ${t.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>{t.msg}</div>)}</div>
}

export const Spinner = () => <div className="flex justify-center p-8"><Loader2 className="animate-spin text-brand-600" /></div>
export const Card = ({ title, children, right, className = '' }: { title?: string; children: ReactNode; right?: ReactNode; className?: string }) =>
  <section className={`overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
    {title && <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3"><h3 className="text-sm font-semibold text-brand-900">{title}</h3>{right}</header>}
    <div className="p-4">{children}</div></section>
export const Stat = ({ label, value, tone = 'brand' }: { label: string; value: ReactNode; tone?: 'brand' | 'amber' | 'red' | 'green' }) => {
  const c = { brand: 'from-brand-50 text-brand-600 border-brand-500', amber: 'from-amber-50 text-amber-600 border-amber-500', red: 'from-red-50 text-red-600 border-red-500', green: 'from-emerald-50 text-emerald-600 border-emerald-500' }[tone]
  return <div className={`relative overflow-hidden rounded-xl border border-slate-200/80 border-t-4 bg-gradient-to-br to-white p-4 shadow-sm ${c}`}>
    <Zap size={46} className="absolute -right-2 -top-2 opacity-10" /><div className="text-3xl font-bold text-slate-900">{value}</div><div className="mt-1 text-xs font-medium text-slate-500">{label}</div></div>
}
export const Hero = ({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) =>
  <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-brand-900 via-brand-700 to-brand-500 p-5 text-white shadow-md">
    <svg className="absolute inset-0 h-full w-full opacity-10" xmlns="http://www.w3.org/2000/svg"><defs><pattern id="g" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="white" strokeWidth="1" /><circle cx="0" cy="0" r="2.5" fill="white" /></pattern></defs><rect width="100%" height="100%" fill="url(#g)" /></svg>
    <div className="relative flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>{sub && <p className="mt-1 text-sm text-brand-100">{sub}</p>}</div>{right}</div></div>
export const Btn = ({ kind = 'primary', className = '', ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'primary' | 'ghost' | 'danger' | 'amber' }) => {
  const k = { primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700', ghost: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50', danger: 'bg-red-600 text-white hover:bg-red-700', amber: 'bg-amber-500 text-slate-900 hover:bg-amber-600' }[kind]
  return <button {...p} className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${k} ${className}`} />
}
const tones: Record<string, string> = {
  completed: 'bg-emerald-100 text-emerald-800', resolved: 'bg-emerald-100 text-emerald-800', failed: 'bg-red-100 text-red-800', critical: 'bg-red-100 text-red-800', high: 'bg-red-100 text-red-800',
  medium: 'bg-orange-100 text-orange-800', in_progress: 'bg-amber-100 text-amber-800', under_investigation: 'bg-orange-100 text-orange-800', open: 'bg-red-100 text-red-800',
  low: 'bg-slate-100 text-slate-700', not_started: 'bg-slate-100 text-slate-600', pending: 'bg-slate-100 text-slate-600', draft: 'bg-slate-200 text-slate-700', submitted: 'bg-brand-100 text-brand-700' }
export const Badge = ({ v }: { v: string }) => <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[v.toLowerCase().replace(/ /g, '_')] ?? 'bg-slate-100 text-slate-700'}`}>{v.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase())}</span>
export const Table = ({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) =>
  <div className="overflow-x-auto"><table className="w-full"><thead className="bg-brand-50"><tr>{head.map(h => <th key={h} className="th">{h}</th>)}</tr></thead>
    <tbody className="divide-y divide-slate-100 [&>tr:hover]:bg-brand-50/40">{children}</tbody></table>{empty && <p className="p-6 text-center text-sm text-slate-500">Nothing here yet.</p>}</div>
export const Modal = ({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) =>
  <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4"><div className="mt-10 w-full max-w-2xl rounded-lg bg-white shadow-xl">
    <div className="flex items-center justify-between border-b px-4 py-3"><h3 className="font-semibold">{title}</h3><button onClick={onClose}><X size={18} /></button></div><div className="p-4">{children}</div></div></div>
export const Logo = ({ size = 40 }: { size?: number }) => <img src="/logo.png" alt="GETEK" style={{ height: size }} className="w-auto" onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
export function SignedImg({ path }: { path: string }) {
  const [url, setUrl] = useState('')
  useEffect(() => { supabase.storage.from('problem-images').createSignedUrl(path, 3600).then(r => setUrl(r.data?.signedUrl ?? '')) }, [path])
  return url ? <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Problem" className="h-16 w-16 rounded border object-cover" /></a> : null
}


export const AuthCtx = createContext<{ profile: Profile } | null>(null)
export const useAuth = () => useContext(AuthCtx)!
