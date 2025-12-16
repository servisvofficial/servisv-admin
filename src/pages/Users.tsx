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
        <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-100">
          <div className="min-w-full">
            <div className="grid grid-cols-[2fr,1.2fr,0.8fr,1.5fr,1fr,1.2fr,140px] gap-4 bg-slate-50 px-6 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span>Nombre</span>
              <span>DUI</span>
              <span>Rol</span>
              <span>Ubicación</span>
              <span>Estado</span>
              <span className="text-right">Alta</span>
              <span className="text-center">Acciones</span>
            </div>
          {loading ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando datos…</p>
          ) : paginatedUsers.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">
              {searchTerm ? 'No se encontraron usuarios con ese criterio de búsqueda.' : 'No hay usuarios registrados.'}
            </p>
          ) : (
            paginatedUsers.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[2fr,1.2fr,0.8fr,1.5fr,1fr,1.2fr,140px] gap-4 items-center px-6 py-5 text-sm text-slate-600 odd:bg-white border-b border-slate-100 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">
                    {user.name} {user.last_name}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
                </div>
                <span className="text-sm font-mono text-slate-700 font-medium">
                  {user.dui || '—'}
                </span>
                <span className="capitalize text-sm font-medium">
                  {user.rol === 'provider' ? 'Proveedor' : 'Cliente'}
                </span>
                <span className="text-sm text-slate-700 truncate">{user.location ?? 'Sin definir'}</span>
                <span className="text-xs font-semibold uppercase tracking-wide">
                  {user.is_banned ? (
                    <span className="text-red-600">Baneado</span>
                  ) : user.is_validated ? (
                    <span className="text-emerald-600">Validado</span>
                  ) : (
                    <span className="text-amber-600">Pendiente</span>
                  )}
                </span>
                <span className="text-right text-sm text-slate-500">
                  {dateFormatter.format(new Date(user.created_at))}
                </span>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleBanClick(user.id, `${user.name} ${user.last_name}`, user.is_banned)}
                    disabled={banning === user.id}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                      user.is_banned
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {banning === user.id
                      ? 'Procesando...'
                      : user.is_banned
                        ? 'Desbanear'
                        : 'Banear'}
                  </button>
                </div>
              </div>
            ))
          )}
          </div>
          
          {/* Paginación */}
          {!loading && filteredUsers.length > itemsPerPage && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-200 px-6 py-4">
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

