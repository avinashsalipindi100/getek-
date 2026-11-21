import { useEffect, useState, ReactNode } from 'react'
import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import { AlertTriangle, BarChart3, ClipboardList, LayoutDashboard, LogOut, Menu, Settings as Cog, Users, PlusCircle } from 'lucide-react'
import { supabase, Logo, Spinner, ToastHost, AuthCtx, useAuth } from './lib'
import type { Profile } from './lib'
import { Login, EngineerDashboard, AdminDashboard, ReportForm, Records, Problems, Reports, Engineers, EngineerDetail, Settings } from './pages'


function Shell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const admin = profile.role === 'admin'
  const links = admin
    ? [['/', 'Dashboard', LayoutDashboard], ['/records', 'Testing Records', ClipboardList], ['/problems', 'Problems', AlertTriangle], ['/reports', 'Reports', BarChart3], ['/engineers', 'Engineers', Users], ['/settings', 'Settings', Cog]]
    : [['/', 'Dashboard', LayoutDashboard], ['/report/new', 'New Report', PlusCircle], ['/records', 'My Records', ClipboardList], ['/problems', 'My Problems', AlertTriangle]]
  return (
    <div className="min-h-screen lg:flex">
      <>{open && <div className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden" onClick={() => setOpen(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform bg-brand-900 text-white transition-transform lg:static lg:translate-x-0 ${open ? '' : '-translate-x-full'}`}>
        <div className="m-4 flex items-center gap-3 rounded-md bg-white p-2.5"><Logo size={34} /><span className="text-xs font-bold leading-tight text-brand-900">GETEK Rectifier<br />Testing System</span></div>
        <nav className="space-y-0.5 px-3 py-2">{links.map(([to, text, Icon]: any) =>
          <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${isActive ? 'bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_#f2a900]' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}><Icon size={17} />{text}</NavLink>)}</nav>
        <div className="absolute bottom-0 w-full border-t border-white/10 p-4 text-xs">
          <div className="mb-3 flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500 font-bold text-slate-900">{(profile.full_name || "?")[0].toUpperCase()}</span><div className="min-w-0 truncate">{profile.full_name}<div className="text-slate-400">{admin ? 'Testing Manager' : 'Testing Engineer'}</div></div></div>
          <button onClick={async () => { await supabase.auth.signOut(); nav('/') }} className="flex items-center gap-2 text-slate-300 hover:text-white"><LogOut size={14} />Sign out</button></div>
      </aside></>
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white p-3 lg:hidden"><button onClick={() => setOpen(!open)}><Menu /></button><Logo size={28} /></header>
        <main className="mx-auto max-w-7xl space-y-5 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState<any>(undefined)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((ev, s) => { if (ev === 'PASSWORD_RECOVERY') setRecovery(true); setSession(s) })
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) { setProfile(null); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data }) => {
      if (data && !data.is_active) { supabase.auth.signOut(); alert('Your account is deactivated. Contact the Testing Manager.'); return }
      setProfile(data as Profile)
    })
  }, [session])

  if (session === undefined || (session && !profile)) return <Spinner />
  if (!session || recovery) return <><Login recovery={recovery} onDone={() => setRecovery(false)} /><ToastHost /></>
  const admin = profile!.role === 'admin'
  return (
    <AuthCtx.Provider value={{ profile: profile! }}>
      <Shell profile={profile!}>
        <Routes>
          <Route path="/" element={admin ? <AdminDashboard /> : <EngineerDashboard />} />
          <Route path="/report/new" element={<ReportForm />} />
          <Route path="/report/:id" element={<ReportForm />} />
          <Route path="/records" element={<Records />} />
          <Route path="/problems" element={<Problems />} />
          {admin && <Route path="/reports" element={<Reports />} />}
          {admin && <Route path="/engineers" element={<Engineers />} />}
          {admin && <Route path="/engineers/:id" element={<EngineerDetail />} />}
          {admin && <Route path="/settings" element={<Settings />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Shell><ToastHost />
    </AuthCtx.Provider>
  )
}
