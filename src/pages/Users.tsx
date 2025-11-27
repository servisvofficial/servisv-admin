import { useMemo } from 'react'
import { useUsersData } from '../hooks/useUsersData'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function Users() {
  const { data: users, loading, error, refetch } = useUsersData()

  const stats = useMemo(() => {
    const providers = users.filter((user) => user.is_provider)
    const validatedProviders = providers.filter((user) => user.is_validated)
    const pendingProviders = providers.filter((user) => !user.is_validated)
    const bannedUsers = users.filter((user) => user.is_banned)

    return [
      {
        label: 'Total registrados',
        value: users.length,
        helper: 'Usuarios únicos en la plataforma',
      },
      {
        label: 'Proveedores activos',
        value: validatedProviders.length,
        helper: 'Con credenciales aprobadas',
      },
      {
        label: 'Pendientes de validación',
        value: pendingProviders.length,
        helper: 'Requieren revisión manual',
      },
      {
        label: 'Bloqueados / vetados',
        value: bannedUsers.length,
        helper: 'Usuarios que no pueden operar',
      },
    ]
  }, [users])

  const topCategories = useMemo(() => {
    const counter = new Map<string, number>()
    users.forEach((user) => {
      // Contar por nombres de categorías
      if (user.serviceCategories && user.serviceCategories.length > 0) {
        user.serviceCategories.forEach((cat) => {
          const categoryName = typeof cat === 'string' ? cat : cat.category
          counter.set(categoryName, (counter.get(categoryName) ?? 0) + 1)
        })
      }
    })

    return [...counter.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([category, count]) => ({ category, count }))
  }, [users])

  const recentUsers = useMemo(() => users.slice(0, 8), [users])

  return (
    <div className="space-y-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Usuarios y fidelización
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Información real tomada de Supabase: evolución de cuentas, foco en
            proveedores y calidad de base.
          </p>
        </div>
        <button
          onClick={refetch}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400"
        >
          Actualizar
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <article
            key={stat.label}
            className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {loading ? '—' : stat.value.toLocaleString('es-AR')}
            </p>
            <p className="text-xs text-slate-500">{stat.helper}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Categorías con más proveedores
            </h3>
            <p className="text-sm text-slate-500">
              Construido a partir de la tabla `user_professional_services`.
            </p>
          </div>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white">
            {loading ? '—' : `${users.filter((u) => u.is_provider).length} proveedores`}
          </span>
        </header>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {topCategories.map((category) => (
            <article
              key={category.category}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-sm font-semibold text-slate-900">
                {category.category}
              </p>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                Proveedores registrados
              </p>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {category.count}
              </p>
            </article>
          ))}
          {!loading && topCategories.length === 0 && (
            <p className="text-sm text-slate-500">
              Aún no se cargaron categorías en la base.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Últimos usuarios registrados
            </h3>
            <p className="text-sm text-slate-500">
              Incluye clientes y proveedores con sus banderas actuales.
            </p>
          </div>
        </header>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
          <div className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr] bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span>Nombre</span>
            <span>Rol</span>
            <span>Ubicación</span>
            <span>Estado</span>
            <span className="text-right">Alta</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando datos…</p>
          ) : (
            recentUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1.2fr,1fr,1fr,1fr,1fr] items-center px-6 py-4 text-sm text-slate-600 odd:bg-white"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {user.name} {user.last_name}
                  </p>
                  <p className="text-xs text-slate-500">{user.email}</p>
                </div>
                <span className="capitalize">
                  {user.rol === 'provider' ? 'Proveedor' : 'Cliente'}
                </span>
                <span>{user.location ?? 'Sin definir'}</span>
                <span className="text-xs font-semibold uppercase">
                  {user.is_banned
                    ? 'Baneado'
                    : user.is_validated
                      ? 'Validado'
                      : 'Pendiente'}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {dateFormatter.format(new Date(user.created_at))}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

export default Users

