import { useMemo, useState, useEffect } from 'react'
import { useUsersData } from '../hooks/useUsersData'
import { supabase } from '../lib/supabaseClient'
import { useToast } from '../components/ui/use-toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function Users() {
  const { data: users, loading, error, refetch } = useUsersData()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [banning, setBanning] = useState<string | null>(null)
  const [showBanDialog, setShowBanDialog] = useState(false)
  const [userToBan, setUserToBan] = useState<{ id: string; name: string; is_banned: boolean } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Refetch cuando se monta el componente (para sincronizar con cambios de otras páginas)
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refetch cuando la página/tab del navegador se vuelve visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [refetch])

  // Refetch periódico solo si la página está visible (para no gastar recursos en background)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetch()
      }
    }, 120000) // 2 minutos (solo si está visible)

    return () => clearInterval(interval)
  }, [refetch])

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

  // Filtrar usuarios según el término de búsqueda
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) {
      return users
    }

    const term = searchTerm.toLowerCase().trim()
    return users.filter((user) => {
      const fullName = `${user.name} ${user.last_name}`.toLowerCase()
      const email = user.email?.toLowerCase() || ''
      const dui = user.dui?.toLowerCase() || ''

      return (
        fullName.includes(term) ||
        email.includes(term) ||
        dui.includes(term)
      )
    })
  }, [users, searchTerm])

  // Paginación
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = useMemo(() => filteredUsers.slice(startIndex, endIndex), [filteredUsers, startIndex, endIndex])

  // Resetear a página 1 cuando cambia el término de búsqueda
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const handleBanClick = (userId: string, userName: string, isBanned: boolean) => {
    setUserToBan({ id: userId, name: userName, is_banned: isBanned })
    setShowBanDialog(true)
  }

  const copyToClipboard = async (text: string) => {
    if (!text?.trim()) return
    try {
      await navigator.clipboard.writeText(text.trim())
      toast({ title: 'Copiado', description: 'Dirección copiada al portapapeles.' })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo copiar.' })
    }
  }

  const handleBanConfirm = async () => {
    if (!userToBan) return

    setBanning(userToBan.id)
    setShowBanDialog(false)

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ is_banned: !userToBan.is_banned })
        .eq('id', userToBan.id)

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Error",
          description: updateError.message,
        })
      } else {
        toast({
          title: userToBan.is_banned ? "Usuario desbaneado" : "Usuario baneado",
          description: `${userToBan.name} ha sido ${userToBan.is_banned ? 'desbaneado' : 'baneado'} exitosamente.`,
        })
        await refetch()
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setBanning(null)
      setUserToBan(null)
    }
  }

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
        <div className="mt-4">
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar por nombre, email o DUI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
            />
            <div className="mt-2 flex items-center justify-between">
              {searchTerm && (
                <p className="text-xs text-slate-500">
                  {filteredUsers.length} {filteredUsers.length === 1 ? 'usuario encontrado' : 'usuarios encontrados'}
                </p>
              )}
              {!searchTerm && (
                <p className="text-xs text-slate-500">
                  Mostrando {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} de {filteredUsers.length} usuarios
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[18%] min-w-[180px]">Nombre</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[10%] min-w-[100px]">DUI</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[8%] min-w-[80px]">Rol</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[22%] min-w-[200px]">Categorías</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[18%] min-w-[180px]">Ubicación</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-[10%] min-w-[90px]">Estado</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 w-[12%] min-w-[140px]">Alta</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 w-[12%] min-w-[100px]">Acciones</th>
              </tr>
            </thead>
            <tbody>
          {loading ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">Cargando datos…</td>
            </tr>
          ) : paginatedUsers.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                {searchTerm ? 'No se encontraron usuarios con ese criterio de búsqueda.' : 'No hay usuarios registrados.'}
              </td>
            </tr>
          ) : (
            paginatedUsers.map((user) => (
              <tr
                key={user.id}
                className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
              >
                <td className="px-4 py-3 align-top">
                  <p className="font-semibold text-slate-900 text-sm leading-tight">{user.name} {user.last_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5 break-all">{user.email}</p>
                </td>
                <td className="px-4 py-3 align-top text-sm font-mono text-slate-700">{user.dui || '—'}</td>
                <td className="px-4 py-3 align-top text-sm text-slate-700">{user.rol === 'provider' ? 'Proveedor' : 'Cliente'}</td>
                <td className="px-4 py-3 align-top">
                  {user.rol === 'provider' && user.serviceCategories && user.serviceCategories.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {user.serviceCategories.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                          title={c.subcategories?.length ? c.category + ': ' + c.subcategories.join(', ') : c.category}
                        >
                          {c.category}
                          {c.subcategories?.length ? <span className="ml-1 text-slate-500">({c.subcategories.length})</span> : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400 text-sm">—</span>
                  )}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex items-start gap-2">
                    <span className="text-sm text-slate-700 break-words line-clamp-2" title={user.location ?? undefined}>
                      {user.location?.trim() || 'Sin definir'}
                    </span>
                    {user.location?.trim() && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(user.location!)}
                        className="flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                        title="Copiar dirección"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h2m8 0h2a2 2 0 012 2v2m-4 0h2a2 2 0 012 2v6a2 2 0 01-2 2h-2m-4 0h-2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-top">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {user.is_banned ? (
                      <span className="text-red-600">Baneado</span>
                    ) : user.is_validated ? (
                      <span className="text-emerald-600">Validado</span>
                    ) : (
                      <span className="text-amber-600">Pendiente</span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 align-top text-right text-sm text-slate-500 whitespace-nowrap">
                  {dateFormatter.format(new Date(user.created_at))}
                </td>
                <td className="px-4 py-3 align-top text-center">
                  <button
                    onClick={() => handleBanClick(user.id, `${user.name} ${user.last_name}`, user.is_banned)}
                    disabled={banning === user.id}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      user.is_banned
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {banning === user.id ? 'Procesando...' : user.is_banned ? 'Desbanear' : 'Banear'}
                  </button>
                </td>
              </tr>
            ))
          )}
            </tbody>
          </table>
          </div>

          {/* Paginación */}
          {!loading && filteredUsers.length > itemsPerPage && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4">
              <div className="text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (currentPage <= 3) {
                      pageNum = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = currentPage - 2 + i
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                          currentPage === pageNum
                            ? 'bg-purple-600 text-white'
                            : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        isOpen={showBanDialog}
        onClose={() => {
          setShowBanDialog(false)
          setUserToBan(null)
        }}
        onConfirm={handleBanConfirm}
        title={userToBan?.is_banned ? "Desbanear usuario" : "Banear usuario"}
        message={
          userToBan
            ? `¿Estás seguro de que deseas ${userToBan.is_banned ? 'desbanear' : 'banear'} a ${userToBan.name}?`
            : ''
        }
        confirmText={userToBan?.is_banned ? "Desbanear" : "Banear"}
        cancelText="Cancelar"
        variant={userToBan?.is_banned ? "default" : "destructive"}
      />
    </div>
  )
}

export default Users

