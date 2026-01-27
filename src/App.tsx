import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import { Toaster } from './components/ui/Toaster'

const navItems = [
  { to: '/', label: 'Resumen' },
  { to: '/usuarios', label: 'Usuarios' },
  { to: '/usuarios/pendientes', label: 'Pendientes' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/servicios', label: 'Servicios' },
  { to: '/solicitudes', label: 'Solicitudes' },
  { to: '/facturas', label: 'Facturas' },
  { to: '/notas', label: 'NC/ND' },
  { to: '/eventos-dte', label: 'Eventos DTE' },
]

function App() {
  const [heroMetrics, setHeroMetrics] = useState({
    users: 0,
    todayRequests: 0,
  })
  const [loadingMetrics, setLoadingMetrics] = useState(true)

  useEffect(() => {
    let ignore = false

    const fetchMetrics = async () => {
      setLoadingMetrics(true)
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)

      const [usersRes, todayRequestsRes] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', startOfDay.toISOString()),
      ])

      if (ignore) return

      if (!usersRes.error && !todayRequestsRes.error) {
        setHeroMetrics({
          users: usersRes.count ?? 0,
          todayRequests: todayRequestsRes.count ?? 0,
        })
      }

      setLoadingMetrics(false)
    }

    fetchMetrics()

    return () => {
      ignore = true
    }
  }, [])

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
        <header className="glass-card relative overflow-hidden rounded-3xl border border-white/20 bg-white/40 p-8 text-slate-900 shadow-2xl">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-16 right-0 h-64 w-64 rounded-full bg-purple-400/40 blur-3xl" />
            <div className="absolute -bottom-24 left-4 h-56 w-56 rounded-full bg-emerald-300/40 blur-3xl" />
          </div>
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <img
                src="/assets/logoServiSVpng.png"
                alt="ServiSV Logo"
                className="w-16 h-16 object-contain flex-shrink-0"
              />
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-700">
                  ServisV Administración
                </p>
                <h1 className="mt-3 text-3xl font-semibold leading-snug text-slate-900">
                  Control absoluto de la operación de servicios
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Visualiza métricas en tiempo real, aprueba nuevos profesionales y
                  gestiona reportes críticos desde un solo espacio alineado al estilo
                  del sitio principal.
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:text-right">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Usuarios activos
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {loadingMetrics ? '—' : heroMetrics.users.toLocaleString('es-AR')}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Solicitudes del día
                </p>
                <p className="mt-1 text-3xl font-semibold text-slate-900">
                  {loadingMetrics ? '—' : heroMetrics.todayRequests.toLocaleString('es-AR')}
                </p>
              </div>
            </div>
          </div>
          <nav className="relative mt-8 flex flex-wrap gap-3">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  [
                    'inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
                    isActive
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/30'
                      : 'border border-slate-200/60 text-slate-700 hover:border-slate-400 hover:bg-white/80',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <section className="glass-card flex-1 rounded-3xl border border-white/30 bg-white/60 p-6 shadow-2xl">
          <Outlet />
        </section>
      </div>
      <Toaster />
    </main>
  )
}

export default App
