import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type RequestRecord = {
  service_category: string | null
  status: string | null
  created_at: string
}

type QuoteRecord = {
  id: string
  provider_name: string
  price: number | null
  status: string
  created_at: string
}

const activeStatuses = ['open', 'quoted', 'accepted', 'in_progress']

function Services() {
  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [quotes, setQuotes] = useState<QuoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      const [requestsRes, quotesRes] = await Promise.all([
        supabase.from('requests').select('service_category,status,created_at').limit(500),
        supabase
          .from('quotes')
          .select('id,provider_name,price,status,created_at')
          .order('created_at', { ascending: false })
          .limit(8),
      ])

      if (ignore) return

      if (requestsRes.error) {
        setError(requestsRes.error.message)
      } else if (requestsRes.data) {
        setRequests(requestsRes.data as RequestRecord[])
      }

      if (quotesRes.error) {
        setError(quotesRes.error.message)
      } else if (quotesRes.data) {
        setQuotes(quotesRes.data as QuoteRecord[])
      }

      setLoading(false)
    }

    fetchData()

    return () => {
      ignore = true
    }
  }, [])

  const categorySummary = useMemo(() => {
    const summary = new Map<
      string,
      { total: number; active: number; lastRequest: string | null }
    >()

    requests.forEach((request) => {
      if (!request.service_category) return
      const current = summary.get(request.service_category) ?? {
        total: 0,
        active: 0,
        lastRequest: null,
      }
      current.total += 1
      if (request.status && activeStatuses.includes(request.status)) {
        current.active += 1
      }
      if (
        !current.lastRequest ||
        new Date(request.created_at) > new Date(current.lastRequest)
      ) {
        current.lastRequest = request.created_at
      }
      summary.set(request.service_category, current)
    })

    return [...summary.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 4)
  }, [requests])

  const quotesStatusSummary = useMemo(() => {
    const summary: Record<string, number> = {}
    quotes.forEach((quote) => {
      summary[quote.status] = (summary[quote.status] ?? 0) + 1
    })
    return summary
  }, [quotes])

  return (
    <div className="space-y-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">Servicios y categorías</h2>
          <p className="mt-2 text-sm text-slate-600">
            Esta vista combina la tabla `requests` (para entender demanda real) y
            `quotes` (oferta enviada por proveedores).
          </p>
        </div>
        <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          {loading ? '—' : `${requests.length} solicitudes analizadas`}
        </span>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Categorías más activas</h3>
            <p className="text-sm text-slate-500">
              Total vs. solicitudes en curso ({activeStatuses.join(', ')}).
            </p>
          </div>
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {loading && <p className="text-sm text-slate-500">Analizando datos…</p>}
          {!loading &&
            categorySummary.map(([category, data]) => (
              <article
                key={category}
                className="rounded-2xl border border-slate-100 bg-slate-50 p-5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{category}</p>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                      {data.total} solicitudes
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {data.active} activas
                  </span>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Última solicitud:{' '}
                  {data.lastRequest
                    ? new Date(data.lastRequest).toLocaleDateString('es-AR')
                    : 'N/D'}
                </p>
              </article>
            ))}
          {!loading && categorySummary.length === 0 && (
            <p className="text-sm text-slate-500">
              Todavía no hay categorías registradas en las solicitudes.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">Cotizaciones recientes</h3>
            <p className="text-sm text-white/70">
              Resumen generado desde la tabla `quotes`.
            </p>
          </div>
        </header>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Object.entries(quotesStatusSummary).map(([status, count]) => (
            <article key={status} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-white/60">{status}</p>
              <p className="mt-2 text-3xl font-semibold text-white">{count}</p>
              <p className="text-xs text-white/70">Cotizaciones en este estado</p>
            </article>
          ))}
          {!loading && quotes.length === 0 && (
            <p className="text-sm text-white/70">No hay cotizaciones registradas.</p>
          )}
        </div>

        <div className="mt-6 space-y-3">
          {quotes.map((quote) => (
            <article
              key={quote.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm"
            >
              <div className="flex items-center justify-between text-white">
                <p className="font-semibold">{quote.provider_name}</p>
                <span className="text-xs uppercase tracking-[0.3em] text-white/60">
                  {quote.status}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-white/70">
                <span>
                  Monto: USD {Number(quote.price ?? 0).toLocaleString('es-AR')}
                </span>
                <span>{new Date(quote.created_at).toLocaleString('es-AR')}</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default Services

