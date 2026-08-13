import { useMemo, useState, useEffect } from 'react'
import { useUsersData } from '../hooks/useUsersData'
import { useToast } from '../components/ui/use-toast'
import { Search, Copy, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'

function ProviderLinks() {
  const { data: users, loading, refetch } = useUsersData()
  const { toast } = useToast()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    const timer = setTimeout(() => refetch(), 100)
    return () => clearTimeout(timer)
  }, [refetch])

  const providers = useMemo(() => {
    return users.filter(u => u.is_provider)
  }, [users])

  const filteredProviders = useMemo(() => {
    if (!searchTerm.trim()) return providers
    
    const term = searchTerm.toLowerCase().trim()
    return providers.filter(provider => {
      const fullName = `${provider.name} ${provider.last_name}`.toLowerCase()
      const email = provider.email?.toLowerCase() || ''
      return fullName.includes(term) || email.includes(term)
    })
  }, [providers, searchTerm])

  const totalPages = Math.ceil(filteredProviders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedProviders = useMemo(
    () => filteredProviders.slice(startIndex, endIndex),
    [filteredProviders, startIndex, endIndex]
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm])

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: 'Copiado', description: `Enlace de ${label} copiado.` })
    } catch {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo copiar.' })
    }
  }

  const getProfileLink = (id: string) => `https://servisv.com/proveedor/${id}`
  const getHireLink = (id: string) => `https://servisv.com/contratar/${id}`

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Enlaces de Proveedores</h2>
          <p className="mt-1 text-sm text-slate-500">
            Obtén fácilmente los enlaces directos al perfil o al flujo de contratación de cada proveedor.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o correo..."
              className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/50 w-full sm:w-64 transition-shadow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white/50 shadow-sm backdrop-blur-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="border-b border-slate-200 bg-slate-50/50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4 font-semibold">Proveedor</th>
              <th className="px-6 py-4 font-semibold">Enlace Perfil</th>
              <th className="px-6 py-4 font-semibold">Enlace Contratar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && paginatedProviders.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                  Cargando proveedores...
                </td>
              </tr>
            ) : paginatedProviders.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-12 text-center text-slate-500">
                  No se encontraron proveedores.
                </td>
              </tr>
            ) : (
              paginatedProviders.map((provider) => {
                const profileLink = getProfileLink(provider.id)
                const hireLink = getHireLink(provider.id)
                return (
                  <tr key={provider.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {provider.name} {provider.last_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{provider.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px] text-xs text-slate-400">
                          {profileLink}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyToClipboard(profileLink, 'perfil')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Copiar enlace"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={profileLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Abrir en pestaña nueva"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px] text-xs text-slate-400">
                          {hireLink}
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => copyToClipboard(hireLink, 'contratación')}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                            title="Copiar enlace"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={hireLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Abrir en pestaña nueva"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200/60 pt-4 text-sm text-slate-500">
          <div>
            Mostrando <span className="font-medium text-slate-900">{startIndex + 1}</span> a{' '}
            <span className="font-medium text-slate-900">
              {Math.min(endIndex, filteredProviders.length)}
            </span>{' '}
            de <span className="font-medium text-slate-900">{filteredProviders.length}</span> proveedores
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProviderLinks
