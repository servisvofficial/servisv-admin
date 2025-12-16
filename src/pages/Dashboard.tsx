import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type RequestSummary = {
  id: string
  title: string
  client_name: string
  service_category: string
  status: string
  created_at: string
  location: string | null
}

type ReportSummary = {
  id: string
  reason_category: string
  status: string
  reporter_id: string
  reported_user_id: string
  created_at: string
  reporter_name: string | null
  reporter_last_name: string | null
  reported_user_name: string | null
  reported_user_last_name: string | null
}

const statusLabel: Record<string, string> = {
  open: 'Abierta',
  quoted: 'Cotizada',
  accepted: 'Aceptada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
  submitted: 'Recibido',
  under_review: 'En revisión',
  resolved: 'Resuelto',
  dismissed: 'Descartado',
}

function Dashboard() {
  const [counts, setCounts] = useState({
    totalUsers: 0,
    providers: 0,
    pendingProviders: 0,
    openRequests: 0,
    totalQuotes: 0,
    openReports: 0,
  })
  const [latestRequests, setLatestRequests] = useState<RequestSummary[]>([])
  const [latestReports, setLatestReports] = useState<ReportSummary[]>([])
  const [requestsByCategory, setRequestsByCategory] = useState<
    { category: string; count: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const [
        usersCountRes,
        providersRes,
        pendingProvidersRes,
        openRequestsRes,
        quotesRes,
        reportsRes,
        latestRequestsRes,
        latestReportsRes,
        requestsDistributionRes,
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_provider', true),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('is_provider', true)
          .eq('is_validated', false),
        supabase
          .from('requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['open', 'quoted', 'accepted', 'in_progress']),
        supabase.from('quotes').select('id', { count: 'exact', head: true }),
        supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'resolved'),
        supabase
          .from('requests')
          .select('id,title,client_name,service_category,status,created_at,location')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase
          .from('reports')
          .select('id,reason_category,status,reporter_id,reported_user_id,created_at')
          .order('created_at', { ascending: false })
          .limit(6),
        supabase.from('requests').select('service_category'),
      ])

      const responses = [
        usersCountRes,
        providersRes,
        pendingProvidersRes,
        openRequestsRes,
        quotesRes,
        reportsRes,
        latestRequestsRes,
        latestReportsRes,
        requestsDistributionRes,
      ]

      const anyError = responses.find((res) => 'error' in res && res.error)
      if (!ignore && anyError && anyError.error) {
        setError(anyError.error.message)
        setLoading(false)
        return
      }

      if (ignore) return

      setCounts({
        totalUsers: usersCountRes.count ?? 0,
        providers: providersRes.count ?? 0,
        pendingProviders: pendingProvidersRes.count ?? 0,
        openRequests: openRequestsRes.count ?? 0,
        totalQuotes: quotesRes.count ?? 0,
        openReports: reportsRes.count ?? 0,
      })

      setLatestRequests((latestRequestsRes.data as RequestSummary[]) ?? [])
      
      // Procesar reportes para incluir nombres de usuarios
      const reportsData = (latestReportsRes.data as ReportSummary[]) ?? []
      
      if (reportsData.length > 0) {
        // Obtener IDs únicos de usuarios
        const userIds = Array.from(
          new Set(
            reportsData
              .flatMap((report) => [report.reporter_id, report.reported_user_id])
              .filter(Boolean),
          ),
        )
        
        // Cargar usuarios
        let usersMap = new Map<string, { name: string; last_name: string }>()
        if (userIds.length > 0) {
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name, last_name')
            .in('id', userIds)
          
          if (usersData) {
            usersMap = new Map(
              usersData.map((user) => [
                user.id,
                { name: user.name, last_name: user.last_name },
              ]),
            )
          }
        }
        
        // Procesar reportes con nombres de usuarios
        const processedReports = reportsData.map((report) => {
          const reporter = usersMap.get(report.reporter_id)
          const reportedUser = usersMap.get(report.reported_user_id)
          
          return {
            id: report.id,
            reason_category: report.reason_category,
            status: report.status,
            reporter_id: report.reporter_id,
            reported_user_id: report.reported_user_id,
            created_at: report.created_at,
            reporter_name: reporter?.name || null,
            reporter_last_name: reporter?.last_name || null,
            reported_user_name: reportedUser?.name || null,
            reported_user_last_name: reportedUser?.last_name || null,
          }
        })
        
        setLatestReports(processedReports)
      } else {
        setLatestReports([])
      }

      const categoryCounter = new Map<string, number>()
      ;(requestsDistributionRes.data as { service_category: string | null }[] | null)?.forEach(
        ({ service_category }) => {
          if (!service_category) return
          categoryCounter.set(
            service_category,
            (categoryCounter.get(service_category) ?? 0) + 1,
          )
        },
      )
      setRequestsByCategory(
        [...categoryCounter.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .map(([category, count]) => ({ category, count })),
      )

      setLoading(false)
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [])

  const operationalInsights = useMemo(() => {
    const insights = []
    if (counts.pendingProviders > 0) {
      insights.push({
        title: 'Credenciales pendientes',
        detail: `${counts.pendingProviders} proveedores necesitan revisión manual`,
        priority: 'Media',
      })
    }
    if (counts.openReports > 0) {
      insights.push({
        title: 'Reportes abiertos',
        detail: `${counts.openReports} reportes requieren acción del equipo`,
        priority: 'Alta',
      })
    }
    if (counts.openRequests > 0) {
      insights.push({
        title: 'Solicitudes en curso',
        detail: `${counts.openRequests} pedidos siguen activos (open/in-progress)`,
        priority: 'Normal',
      })
    }
    return insights
  }, [counts])

  const statsCards = [
    {
      label: 'Usuarios registrados',
      value: counts.totalUsers,
      helper: 'Cuentas únicas en Supabase',
    },
    {
      label: 'Proveedores validados',
      value: counts.providers - counts.pendingProviders,
      helper: 'is_provider=true & is_validated=true',
    },
    {
      label: 'Solicitudes activas',
      value: counts.openRequests,
      helper: 'open / quoted / accepted / in_progress',
    },
    {
      label: 'Reportes abiertos',
      value: counts.openReports,
      helper: 'status != resolved',
    },
  ]

  return (
    <div className="space-y-8 text-slate-900">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Resumen ejecutivo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Los datos provienen directamente de tus tablas Supabase (usuarios, requests,
          quotes y reports) para compartir con los clientes del servicio.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statsCards.map((card) => (
          <article
            key={card.label}
            className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {loading ? '—' : card.value.toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-slate-500">{card.helper}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Categorías con más solicitudes
              </h3>
              <p className="text-sm text-slate-500">
                Se arma recorriendo la columna `service_category` de `requests`.
              </p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
              {counts.openRequests} activas
            </span>
          </header>
          <div className="mt-6 space-y-4">
            {loading && <p className="text-sm text-slate-500">Calculando…</p>}
            {!loading && requestsByCategory.length === 0 && (
              <p className="text-sm text-slate-500">
                Aún no hay solicitudes con categoría cargada.
              </p>
            )}
            {requestsByCategory.map((category) => (
              <div key={category.category}>
                <div className="flex items-center justify-between text-sm">
                  <p className="font-medium text-slate-800">{category.category}</p>
                  <p className="text-slate-500">{category.count} solicitudes</p>
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400"
                    style={{
                      width: `${
                        counts.openRequests > 0
                          ? Math.min((category.count / counts.openRequests) * 100, 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-xl">
          <header className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Alertas operativas</h3>
              <p className="text-sm text-white/70">Generadas en base al estado real.</p>
            </div>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              Tiempo real
            </span>
          </header>
          <div className="mt-6 space-y-4">
            {operationalInsights.length === 0 && (
              <p className="text-sm text-white/70">Sin alertas por el momento.</p>
            )}
            {operationalInsights.map((alert) => (
              <article
                key={alert.title}
                className="rounded-2xl border border-white/15 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between text-sm">
                  <h4 className="font-semibold">{alert.title}</h4>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                    {alert.priority}
                  </span>
                </div>
                <p className="mt-2 text-sm text-white/80">{alert.detail}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Solicitudes recientes</h3>
            <p className="text-sm text-slate-500">
              Tabla en vivo: `requests` ordenadas por `created_at`.
            </p>
          </div>
        </header>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <div className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr] bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>Título</span>
            <span>Cliente</span>
            <span>Categoría</span>
            <span>Estado</span>
            <span className="text-right">Creada</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando solicitudes…</p>
          ) : (
            latestRequests.map((request) => (
              <div
                key={request.id}
                className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr] items-center px-6 py-4 text-sm text-slate-600 odd:bg-white"
              >
                <div>
                  <p className="font-semibold text-slate-900">{request.title}</p>
                  <p className="text-xs text-slate-500">{request.location}</p>
                </div>
                <span>{request.client_name}</span>
                <span>{request.service_category}</span>
                <span className="text-xs font-semibold uppercase">
                  {statusLabel[request.status] ?? request.status}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {new Date(request.created_at).toLocaleString('es-AR')}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Reportes recientes</h3>
            <p className="text-sm text-slate-500">Información de la tabla `reports`.</p>
          </div>
        </header>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {loading && <p className="text-sm text-slate-500">Buscando reportes…</p>}
          {!loading &&
            latestReports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="uppercase tracking-[0.3em]">
                    {statusLabel[report.status] ?? report.status}
                  </span>
                  <span>{new Date(report.created_at).toLocaleDateString('es-AR')}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  Motivo: {report.reason_category}
                </p>
                <p className="text-xs text-slate-500">
                  Reporter:{' '}
                  {report.reporter_name && report.reporter_last_name
                    ? `${report.reporter_name} ${report.reporter_last_name}`
                    : `ID: ${report.reporter_id.slice(0, 12)}...`}
                  {' | '}
                  Reportado:{' '}
                  {report.reported_user_name && report.reported_user_last_name
                    ? `${report.reported_user_name} ${report.reported_user_last_name}`
                    : `ID: ${report.reported_user_id.slice(0, 12)}...`}
                </p>
              </article>
            ))}
        </div>
      </section>
    </div>
  )
}

export default Dashboard

