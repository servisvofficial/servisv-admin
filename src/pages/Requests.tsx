import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type RequestRecord = {
  id: string
  title: string
  client_name: string
  service_category: string
  status: string
  location: string | null
  created_at: string
}

const statusTexts: Record<string, string> = {
  open: 'Abierta',
  quoted: 'Cotizada',
  accepted: 'Aceptada',
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
}

const activeStatuses = ['open', 'quoted', 'accepted', 'in_progress']

function Requests() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const fetchRequests = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('requests')
        .select('id,title,client_name,service_category,status,location,created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      if (ignore) return

      if (error) {
        setError(error.message)
      } else if (data) {
        setRequests(data as RequestRecord[])
      }

      setLoading(false)
    }

    fetchRequests()

    return () => {
      ignore = true
    }
  }, [])

  const stats = useMemo(() => {
    const total = requests.length
    const active = requests.filter((request) => activeStatuses.includes(request.status)).length
    const completed = requests.filter((request) => request.status === 'completed').length
    const cancelled = requests.filter((request) => request.status === 'cancelled').length

    return [
      {
        label: 'Solicitudes activas',
        value: active,
        detail: 'Estados open, quoted, accepted o in_progress',
      },
      {
        label: 'Completadas',
        value: completed,
        detail: `${
          total > 0 ? ((completed / total) * 100).toFixed(1) : '0'
        }% del total`,
      },
      {
        label: 'Canceladas',
        value: cancelled,
        detail: 'Impacto en SLA y experiencia',
      },
    ]
  }, [requests])

  const operationalTips = useMemo(() => {
    const tips = []
    const active = stats[0]?.value ?? 0
    const cancelled = stats[2]?.value ?? 0
    if (active > 0) {
      tips.push(`Hay ${active} solicitudes en curso; conviene monitorear SLA provocados.`)
    }
    if (cancelled > 0) {
      tips.push(
        `${cancelled} solicitudes canceladas recientemente. Revisa motivos para mantener la satisfacción.`,
      )
    }
    if (tips.length === 0) {
      tips.push('No hay acciones urgentes detectadas en este momento.')
    }
    return tips
  }, [stats])

  return (
    <div className="space-y-8 text-slate-900">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">Solicitudes en vivo</h2>
        <p className="mt-2 text-sm text-slate-600">
          Datos provenientes de la tabla `requests`: estado operativo y desglose por
          cliente.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {loading ? '—' : stat.value}
            </p>
            <p className="text-xs text-slate-500">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Operaciones activas</h3>
            <p className="text-sm text-slate-500">
              Vista directa de cada solicitud (ordenada por `created_at`).
            </p>
          </div>
        </header>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <div className="grid grid-cols-[1fr,2fr,2fr,1fr,1fr] bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>ID</span>
            <span>Servicio</span>
            <span>Cliente</span>
            <span>Estado</span>
            <span className="text-right">Creada</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando solicitudes…</p>
          ) : (
            requests.map((request) => (
              <div
                key={request.id}
                className="grid grid-cols-[1fr,2fr,2fr,1fr,1fr] items-center px-6 py-4 text-sm text-slate-600 odd:bg-white"
              >
                <span className="font-mono text-slate-500">{request.id.slice(0, 8)}</span>
                <div>
                  <p className="font-medium text-slate-900">{request.title}</p>
                  <p className="text-xs text-slate-500">
                    {request.service_category} · {request.location ?? 'Ubicación N/D'}
                  </p>
                </div>
                <span>{request.client_name}</span>
                <span className="font-semibold uppercase text-emerald-600">
                  {statusTexts[request.status] ?? request.status}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {new Date(request.created_at).toLocaleString('es-AR')}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Recomendaciones operativas</h3>
            <p className="text-sm text-white/70">
              Construidas automáticamente según el estado real de las solicitudes.
            </p>
          </div>
        </header>
        <div className="mt-6 space-y-4">
          {operationalTips.map((tip) => (
            <article
              key={tip}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/90"
            >
              {tip}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Requests

