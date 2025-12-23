import { useState, useMemo, useEffect } from 'react'
import { useUsersData } from '../hooks/useUsersData'
import { supabase } from '../lib/supabaseClient'
import { sendProviderRejectionEmail, sendProviderApprovalEmail } from '../services/email'
import { useToast } from '../components/ui/use-toast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'

function PendingUsers() {
  const { data: users, loading, error, refetch } = useUsersData()
  const { toast } = useToast()
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [userToReject, setUserToReject] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    missingPoliceClearance: false,
    missingProfessionalCredential: false,
    missingDuiFrontal: false,
    missingDuiDorso: false,
    hasDocuments: false,
  })
  const [providerPage, setProviderPage] = useState(1)
  const [clientPage, setClientPage] = useState(1)
  const itemsPerPage = 10

  // Refetch periódico solo si la página está visible (para no gastar recursos en background)
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refetch()
      }
    }, 120000) // 2 minutos (solo si está visible)

    return () => clearInterval(interval)
  }, [refetch])

  // Refetch al montar el componente
  useEffect(() => {
    const timer = setTimeout(() => refetch(), 100)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendingProviders = useMemo(() => {
    // Solo mostrar proveedores que:
    // 1. Son proveedores y no están validados (is_validated = false)
    // 2. Tienen al menos un documento subido (para que no aparezcan los rechazados que aún no han vuelto a subir)
    let filtered = users.filter(
      (user) =>
        user.is_provider &&
        !user.is_validated &&
        (user.police_clearance_pic || user.professional_credential_pic || user.dui_frontal_pic || user.dui_dorso_pic),
    )

    if (filters.missingPoliceClearance) {
      filtered = filtered.filter(
        (user) => !user.police_clearance_pic || !user.police_clearance_verified,
      )
    }

    if (filters.missingProfessionalCredential) {
      filtered = filtered.filter(
        (user) => !user.professional_credential_pic || !user.professional_credential_verified,
      )
    }

    if (filters.missingDuiFrontal) {
      filtered = filtered.filter(
        (user) => !user.dui_frontal_pic,
      )
    }

    if (filters.missingDuiDorso) {
      filtered = filtered.filter(
        (user) => !user.dui_dorso_pic,
      )
    }

    if (filters.hasDocuments) {
      filtered = filtered.filter(
        (user) => user.police_clearance_pic || user.professional_credential_pic || user.dui_frontal_pic || user.dui_dorso_pic,
      )
    }

    return filtered
  }, [users, filters])

  const pendingClients = useMemo(() => {
    // Solo mostrar clientes que:
    // 1. NO son proveedores y no están validados (is_validated = false)
    // 2. Tienen al menos un documento DUI subido
    let filtered = users.filter(
      (user) =>
        !user.is_provider &&
        !user.is_validated &&
        (user.dui_frontal_pic || user.dui_dorso_pic),
    )

    if (filters.missingDuiFrontal) {
      filtered = filtered.filter(
        (user) => !user.dui_frontal_pic,
      )
    }

    if (filters.missingDuiDorso) {
      filtered = filtered.filter(
        (user) => !user.dui_dorso_pic,
      )
    }

    if (filters.hasDocuments) {
      filtered = filtered.filter(
        (user) => user.dui_frontal_pic || user.dui_dorso_pic,
      )
    }

    return filtered
  }, [users, filters])

  // Paginación para proveedores
  const providerTotalPages = Math.ceil(pendingProviders.length / itemsPerPage)
  const providerStartIndex = (providerPage - 1) * itemsPerPage
  const providerEndIndex = providerStartIndex + itemsPerPage
  const paginatedProviders = useMemo(() => 
    pendingProviders.slice(providerStartIndex, providerEndIndex),
    [pendingProviders, providerStartIndex, providerEndIndex]
  )

  // Paginación para clientes
  const clientTotalPages = Math.ceil(pendingClients.length / itemsPerPage)
  const clientStartIndex = (clientPage - 1) * itemsPerPage
  const clientEndIndex = clientStartIndex + itemsPerPage
  const paginatedClients = useMemo(() => 
    pendingClients.slice(clientStartIndex, clientEndIndex),
    [pendingClients, clientStartIndex, clientEndIndex]
  )

  // Resetear páginas cuando cambian los filtros
  useEffect(() => {
    setProviderPage(1)
    setClientPage(1)
  }, [filters])

  const selectedUser = useMemo(() => {
    const allPending = [...pendingProviders, ...pendingClients]
    return allPending.find((u) => u.id === selectedUserId)
  }, [pendingProviders, pendingClients, selectedUserId])

  // Aprobar automáticamente proveedores con más de 7 días
  useEffect(() => {
    const autoApproveOldProviders = async () => {
      if (loading || users.length === 0) return

      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      // Encontrar proveedores y clientes pendientes con más de 7 días
      const usersToAutoApprove = users.filter((user) => {
        if (user.is_validated) return false
        if (!user.created_at) return false

        const createdAt = new Date(user.created_at)
        const daysSinceCreation = Math.floor(
          (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
        )

        // Para proveedores: aprobar si tiene más de 7 días y tiene documentos subidos
        if (user.is_provider) {
          return (
            daysSinceCreation >= 7 &&
            (user.police_clearance_pic || user.professional_credential_pic || user.dui_frontal_pic || user.dui_dorso_pic)
          )
        }
        
        // Para clientes: aprobar si tiene más de 7 días y tiene DUI subido
        return (
          daysSinceCreation >= 7 &&
          (user.dui_frontal_pic || user.dui_dorso_pic)
        )
      })

      if (usersToAutoApprove.length === 0) return

      const providersCount = usersToAutoApprove.filter(u => u.is_provider).length
      const clientsCount = usersToAutoApprove.filter(u => !u.is_provider).length

      // Aprobar cada usuario
      for (const user of usersToAutoApprove) {
        try {
          // Actualizar estado
          const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update({ is_validated: true })
            .eq('id', user.id)
            .select()
            .single()

          if (updateError) {
            continue
          }

          if (updatedUser && !updatedUser.is_validated) {
            continue
          }

          // Enviar email de aprobación tanto a proveedores como a clientes
          try {
            await sendProviderApprovalEmail({
              to: user.email,
              toName: `${user.name} ${user.last_name}`,
              isProvider: user.is_provider,
            })
          } catch (emailError) {
            console.error(
              `Error al enviar email de aprobación a ${user.email}:`,
              emailError,
            )
            // Continuar aunque falle el email
          }
        } catch (error) {
          console.error(
            `Error al procesar aprobación automática de ${user.id}:`,
            error,
          )
        }
      }

      // Recargar datos después de aprobar
      if (usersToAutoApprove.length > 0) {
        await refetch()
        const message = providersCount > 0 && clientsCount > 0
          ? `Se aprobaron automáticamente ${providersCount} proveedor(es) y ${clientsCount} cliente(s) con más de 7 días pendientes.`
          : providersCount > 0
          ? `Se aprobaron automáticamente ${providersCount} proveedor(es) con más de 7 días pendientes.`
          : `Se aprobaron automáticamente ${clientsCount} cliente(s) con más de 7 días pendientes.`
        
        toast({
          title: 'Aprobación automática',
          description: message,
        })
      }
    }

    autoApproveOldProviders()
  }, [users, loading, refetch, toast])

  const handleApprove = async (userId: string) => {
    setProcessing(userId)
    try {
      const user = users.find((u) => u.id === userId)
      if (!user) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se encontró el usuario.",
        })
        setProcessing(null)
        return
      }

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ is_validated: true })
        .eq('id', userId)
        .select()
        .single()

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Error al aprobar",
          description: updateError.message,
        })
        setProcessing(null)
        return
      }

      // Verificar que realmente se actualizó
      if (updatedUser && !updatedUser.is_validated) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "El usuario no se pudo validar correctamente. Verifica RLS en Supabase.",
        })
        setProcessing(null)
        return
      }

      // Enviar email de aprobación tanto a proveedores como a clientes
      try {
        await sendProviderApprovalEmail({
          to: user.email,
          toName: `${user.name} ${user.last_name}`,
          isProvider: user.is_provider,
        })
      } catch (emailError) {
        console.error('Error al enviar email de aprobación:', emailError)
        // No fallar si el email falla
      }

      await refetch()
      setSelectedUserId(null)
      const userType = user.is_provider ? 'proveedor' : 'cliente'
      toast({
        title: `${userType === 'proveedor' ? 'Proveedor' : 'Cliente'} aprobado`,
        description: `El ${userType} ha sido aprobado exitosamente y se le ha enviado un email de notificación.`,
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleRejectClick = (userId: string) => {
    setUserToReject(userId)
    setShowConfirmDialog(true)
  }

  const handleReject = async () => {
    if (!userToReject) return

    const user = users.find((u) => u.id === userToReject)
    if (!user) return

    setShowConfirmDialog(false)
    setRejecting(userToReject)
    setProcessing(userToReject)
    try {
      // Para clientes solo necesitamos limpiar DUI
      // Para proveedores necesitamos limpiar todos los documentos
      if (!user.is_provider) {
        // Cliente: si se rechaza, ambos DUI están mal, así que siempre marcarlos como faltantes
        const missingDocuments = {
          police_clearance: false,
          professional_credential: false,
          dui_frontal: true, // Si se rechaza, el DUI frontal está mal
          dui_dorso: true, // Si se rechaza, el DUI dorso está mal
        }

        const { error: updateError } = await supabase
          .from('users')
          .update({
            is_validated: false,
            is_banned: false,
            dui_frontal_pic: null,
            dui_dorso_pic: null,
          })
          .eq('id', userToReject)

        if (updateError) {
          toast({
            variant: "destructive",
            title: "Error al rechazar",
            description: updateError.message,
          })
          setRejecting(null)
          return
        }

        // Enviar email de rechazo para clientes
        try {
          if (!user.id) {
            throw new Error("El ID del usuario no está disponible")
          }
          
          await sendProviderRejectionEmail({
            to: user.email,
            toName: `${user.name} ${user.last_name}`,
            missingDocuments,
            userId: user.id,
            isProvider: false, // Es un cliente
          })
        } catch (emailError) {
          console.error('Error al enviar email:', emailError)
          toast({
            variant: "destructive",
            title: "Error al enviar email",
            description: emailError instanceof Error ? emailError.message : 'Error desconocido',
          })
        }

        await refetch()
        setSelectedUserId(null)
        toast({
          title: "Cliente rechazado",
          description: "Se ha enviado un email con instrucciones al cliente.",
        })
        setProcessing(null)
        setTimeout(() => {
          setRejecting(null)
        }, 1000)
        return
      }

      // Proveedor: limpiar todos los documentos
      // Verificar si tiene categorías profesionales
      const professionalCategoryNames = [
        'Abogados y Notarios',
        'Contadores',
        'Traductores',
        'Diseño Gráfico',
        'Programador Freelance',
        'Community Manager',
        'Veterinarios',
        'Médicos Generales',
        'Médicos Especialistas',
      ]

      const hasProfessionalCategories =
        user.serviceCategories?.some((cat) =>
          professionalCategoryNames.includes(cat.category),
        ) || false

      // Determinar qué documentos faltan
      const missingDocuments = {
        police_clearance: !user.police_clearance_pic || !user.police_clearance_verified,
        // Solo requerir credencial profesional si tiene categorías profesionales
        professional_credential:
          hasProfessionalCategories &&
          (!user.professional_credential_pic || !user.professional_credential_verified),
        dui_frontal: !user.dui_frontal_pic,
        dui_dorso: !user.dui_dorso_pic,
      }

      // Actualizar estado del usuario:
      // - Marcar como no validado
      // - Limpiar documentos para que desaparezca de la lista hasta que vuelva a subirlos
      // - Resetear verificaciones
      const { error: updateError } = await supabase
        .from('users')
        .update({
          is_validated: false,
          is_banned: false,
          police_clearance_pic: null,
          police_clearance_verified: false,
          professional_credential_pic: null,
          professional_credential_verified: false,
          dui_frontal_pic: null,
          dui_dorso_pic: null,
        })
        .eq('id', userToReject)

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Error al rechazar",
          description: updateError.message,
        })
        setRejecting(null)
        return
      }

      // Enviar email de rechazo
      try {
        if (!user.id) {
          throw new Error("El ID del usuario no está disponible")
        }
        
        await sendProviderRejectionEmail({
          to: user.email,
          toName: `${user.name} ${user.last_name}`,
          missingDocuments,
          userId: user.id,
          isProvider: true, // Es un proveedor
        })
      } catch (emailError) {
        console.error('Error al enviar email:', emailError)
        toast({
          variant: "destructive",
          title: "Error al enviar email",
          description: emailError instanceof Error ? emailError.message : 'Error desconocido',
        })
      }

      // Esperar un poco para que se vea el feedback visual
      await new Promise(resolve => setTimeout(resolve, 500))
      
      await refetch()
      setSelectedUserId(null)
      toast({
        title: "Proveedor rechazado",
        description: "Se ha enviado un email con instrucciones al proveedor.",
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setProcessing(null)
      // Mantener el estado de rechazando un poco más para el feedback visual
      setTimeout(() => {
        setRejecting(null)
      }, 1000)
    }
  }

  const handleVerifyDocument = async (
    userId: string,
    documentType: 'police_clearance' | 'professional_credential',
  ) => {
    setProcessing(userId)
    try {
      const updateField =
        documentType === 'police_clearance'
          ? { police_clearance_verified: true }
          : { professional_credential_verified: true }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateField)
        .eq('id', userId)

      if (updateError) {
        toast({
          variant: "destructive",
          title: "Error al verificar documento",
          description: updateError.message,
        })
      } else {
        await refetch()
        toast({
          title: "Documento verificado",
          description: "El documento ha sido marcado como verificado.",
        })
      }
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : 'Error desconocido',
      })
    } finally {
      setProcessing(null)
    }
  }

  const handleExport = () => {
    const csvHeaders = [
      'Tipo',
      'Nombre',
      'Apellido',
      'Email',
      'Ubicación',
      'Fecha de registro',
      'Categorías',
      'Solvencia Policial',
      'Credencial Profesional',
      'DUI Frontal',
      'DUI Dorso',
    ]

    const providerRows = pendingProviders.map((user) => {
      const categories = user.serviceCategories
        ? user.serviceCategories
            .map((cat) => `${cat.category}${cat.subcategories?.length ? ` (${cat.subcategories.join(', ')})` : ''}`)
            .join('; ')
        : 'Sin categorías'

      return [
        'Proveedor',
        user.name || '',
        user.last_name || '',
        user.email || '',
        user.location || 'Sin ubicación',
        new Date(user.created_at).toLocaleDateString('es-AR'),
        categories,
        user.police_clearance_verified ? 'Verificada' : user.police_clearance_pic ? 'Pendiente' : 'Falta',
        user.professional_credential_verified ? 'Verificada' : user.professional_credential_pic ? 'Pendiente' : 'Falta',
        user.dui_frontal_pic ? 'Subido' : 'Falta',
        user.dui_dorso_pic ? 'Subido' : 'Falta',
      ]
    })

    const clientRows = pendingClients.map((user) => {
      return [
        'Cliente',
        user.name || '',
        user.last_name || '',
        user.email || '',
        user.location || 'Sin ubicación',
        new Date(user.created_at).toLocaleDateString('es-AR'),
        'N/A',
        'N/A',
        'N/A',
        user.dui_frontal_pic ? 'Subido' : 'Falta',
        user.dui_dorso_pic ? 'Subido' : 'Falta',
      ]
    })

    const csvContent = [csvHeaders, ...providerRows, ...clientRows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `usuarios_pendientes_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <h2 className="text-2xl font-semibold">Usuarios pendientes de aprobación</h2>
        <p className="mt-2 text-sm text-slate-600">
            Proveedores y clientes marcados con `is_validated=false` dentro de Supabase.
            Proveedores requieren: Solvencia Policial, Credencial Profesional (si aplica) y DUI.
            Clientes requieren: DUI frontal y dorso.
          </p>
        </div>
        <button
          onClick={refetch}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Actualizar
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-amber-100 bg-amber-50/70 p-6 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">Proveedores</p>
            <h3 className="text-lg font-semibold text-amber-900">
              {loading ? '—' : `${pendingProviders.length} pendientes por validar`}
            </h3>
            <span className="text-xs text-amber-700 mt-1 block">
              {users.filter((user) => user.is_provider).length} proveedores totales
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-amber-500">Clientes</p>
            <h3 className="text-lg font-semibold text-amber-900">
              {loading ? '—' : `${pendingClients.length} pendientes por validar`}
            </h3>
            <span className="text-xs text-amber-700 mt-1 block">
              {users.filter((user) => !user.is_provider).length} clientes totales
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Detalle de aplicaciones</h3>
            <p className="text-sm text-slate-500">
              {pendingProviders.length + pendingClients.length} usuario{pendingProviders.length + pendingClients.length !== 1 ? 's' : ''} pendiente{pendingProviders.length + pendingClients.length !== 1 ? 's' : ''} ({pendingProviders.length} proveedor{pendingProviders.length !== 1 ? 'es' : ''}, {pendingClients.length} cliente{pendingClients.length !== 1 ? 's' : ''})
              {Object.values(filters).some((f) => f) && ' (filtrados)'}
            </p>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Filtros {showFilters ? '▲' : '▼'}
            </button>
              {showFilters && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg z-10">
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.missingPoliceClearance}
                        onChange={(e) =>
                          setFilters({ ...filters, missingPoliceClearance: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Falta solvencia policial</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.missingProfessionalCredential}
                        onChange={(e) =>
                          setFilters({ ...filters, missingProfessionalCredential: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Falta credencial profesional</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.missingDuiFrontal}
                        onChange={(e) =>
                          setFilters({ ...filters, missingDuiFrontal: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Falta DUI frontal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.missingDuiDorso}
                        onChange={(e) =>
                          setFilters({ ...filters, missingDuiDorso: e.target.checked })
                        }
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Falta DUI dorso</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.hasDocuments}
                        onChange={(e) => setFilters({ ...filters, hasDocuments: e.target.checked })}
                        className="rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-700">Tiene documentos subidos</span>
                    </label>
                    <button
                      onClick={() => {
                        setFilters({
                          missingPoliceClearance: false,
                          missingProfessionalCredential: false,
                          missingDuiFrontal: false,
                          missingDuiDorso: false,
                          hasDocuments: false,
                        })
                        setShowFilters(false)
                      }}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Limpiar filtros
            </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={handleExport}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Exportar
            </button>
          </div>
        </header>

        <div className="mt-6 space-y-4">
          {loading && <p className="text-sm text-slate-500">Cargando pendientes…</p>}
          {!loading && pendingProviders.length === 0 && pendingClients.length === 0 && (
            <p className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              ¡Todos los usuarios están validados!
            </p>
          )}
          
          {/* Sección de Proveedores */}
          {pendingProviders.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                Proveedores ({pendingProviders.length})
              </h4>
              <div className="space-y-4">
                {paginatedProviders.map((professional) => {
            const isRejecting = rejecting === professional.id
            const isProcessing = processing === professional.id
            
            return (
            <article
              key={professional.id}
              className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${
                isRejecting
                  ? 'border-red-300 bg-red-50/50 animate-pulse'
                  : 'border-slate-100 bg-slate-50'
              }`}
            >
              {isRejecting && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                  <p className="text-sm font-semibold text-red-700">
                    Rechazando proveedor y enviando email...
                  </p>
                </div>
              )}
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-900">
                    {professional.name} {professional.last_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {professional.serviceCategories && professional.serviceCategories.length > 0
                      ? professional.serviceCategories
                          .map(
                            (cat) =>
                              `${cat.category}${cat.subcategories && cat.subcategories.length > 0 ? ` (${cat.subcategories.join(', ')})` : ''}`,
                          )
                          .join(' • ')
                      : 'Categoría sin definir'}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  Alta {new Date(professional.created_at).toLocaleDateString('es-AR')}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                  {professional.location ?? 'Sin ubicación'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    professional.police_clearance_verified
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  Solvencia {professional.police_clearance_verified ? 'verificada' : 'pendiente'}
                </span>
                <span
                  className={`rounded-full px-3 py-1 font-semibold ${
                    professional.professional_credential_verified
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  Credencial {professional.professional_credential_verified ? 'verificada' : 'pendiente'}
                </span>
                {professional.dui_frontal_pic && (
                  <span className="rounded-full px-3 py-1 font-semibold bg-emerald-100 text-emerald-700">
                    DUI Frontal subido
                  </span>
                )}
                {professional.dui_dorso_pic && (
                  <span className="rounded-full px-3 py-1 font-semibold bg-emerald-100 text-emerald-700">
                    DUI Dorso subido
                  </span>
                )}
              </div>

              {/* Sección de documentos */}
              {(professional.police_clearance_pic || professional.professional_credential_pic || professional.dui_frontal_pic || professional.dui_dorso_pic) && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Documentos subidos
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {professional.police_clearance_pic && (
                <div>
                        <p className="mb-2 text-xs font-semibold text-slate-700">
                          Solvencia Policial
                        </p>
                        <div className="relative">
                          <img
                            src={professional.police_clearance_pic}
                            alt="Solvencia policial"
                            className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                            onClick={() => window.open(professional.police_clearance_pic!, '_blank')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                window.open(professional.police_clearance_pic!, '_blank')
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(professional.police_clearance_pic!, '_blank')}
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                </div>
                </div>
                    )}
                    {professional.professional_credential_pic && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-700">
                          Credencial Profesional
                        </p>
                        <div className="relative">
                          <img
                            src={professional.professional_credential_pic}
                            alt="Credencial profesional"
                            className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                            onClick={() => window.open(professional.professional_credential_pic!, '_blank')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                window.open(professional.professional_credential_pic!, '_blank')
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(professional.professional_credential_pic!, '_blank')}
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
              </div>
                      </div>
                    )}
                    {professional.dui_frontal_pic && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-700">
                          DUI Frontal
                        </p>
                        <div className="relative">
                          <img
                            src={professional.dui_frontal_pic}
                            alt="DUI frontal"
                            className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                            onClick={() => window.open(professional.dui_frontal_pic!, '_blank')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                window.open(professional.dui_frontal_pic!, '_blank')
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(professional.dui_frontal_pic!, '_blank')}
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                      </div>
                    )}
                    {professional.dui_dorso_pic && (
                      <div>
                        <p className="mb-2 text-xs font-semibold text-slate-700">
                          DUI Dorso
                        </p>
                        <div className="relative">
                          <img
                            src={professional.dui_dorso_pic}
                            alt="DUI dorso"
                            className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                            onClick={() => window.open(professional.dui_dorso_pic!, '_blank')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                window.open(professional.dui_dorso_pic!, '_blank')
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => window.open(professional.dui_dorso_pic!, '_blank')}
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  onClick={() => handleApprove(professional.id)}
                  disabled={processing === professional.id}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {processing === professional.id ? 'Procesando...' : 'Aprobar'}
                </button>
                <button
                  onClick={() => setSelectedUserId(professional.id)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Ver detalles
                </button>
                <button
                  onClick={() => handleRejectClick(professional.id)}
                  disabled={isProcessing}
                  className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isRejecting ? (
                    <>
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-600 border-t-transparent"></div>
                      Rechazando...
                    </>
                  ) : (
                    'Rechazar'
                  )}
                </button>
              </div>
            </article>
            )
                })}
              </div>
              
              {/* Paginación para Proveedores */}
              {pendingProviders.length > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="text-sm text-slate-600">
                    Mostrando {providerStartIndex + 1}-{Math.min(providerEndIndex, pendingProviders.length)} de {pendingProviders.length} proveedores
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setProviderPage(prev => Math.max(1, prev - 1))}
                      disabled={providerPage === 1}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, providerTotalPages) }, (_, i) => {
                        let pageNum: number
                        if (providerTotalPages <= 5) {
                          pageNum = i + 1
                        } else if (providerPage <= 3) {
                          pageNum = i + 1
                        } else if (providerPage >= providerTotalPages - 2) {
                          pageNum = providerTotalPages - 4 + i
                        } else {
                          pageNum = providerPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setProviderPage(pageNum)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                              providerPage === pageNum
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
                      onClick={() => setProviderPage(prev => Math.min(providerTotalPages, prev + 1))}
                      disabled={providerPage === providerTotalPages}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sección de Clientes */}
          {pendingClients.length > 0 && (
            <div className="mt-8">
              <h4 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">
                Clientes ({pendingClients.length})
              </h4>
              <div className="space-y-4">
                {paginatedClients.map((client) => {
                  const isRejecting = rejecting === client.id
                  const isProcessing = processing === client.id
                  
                  return (
                    <article
                      key={client.id}
                      className={`rounded-2xl border p-4 shadow-sm transition-all duration-300 ${
                        isRejecting
                          ? 'border-red-300 bg-red-50/50 animate-pulse'
                          : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      {isRejecting && (
                        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-600 border-t-transparent"></div>
                          <p className="text-sm font-semibold text-red-700">
                            Rechazando cliente y enviando email...
                          </p>
                        </div>
                      )}
                      
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex-1">
                          <p className="text-lg font-semibold text-slate-900">
                            {client.name} {client.last_name}
                          </p>
                          <p className="text-sm text-slate-500">
                            Cliente
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          Alta {new Date(client.created_at).toLocaleDateString('es-AR')}
                        </div>
                      </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-600">
                          {client.location ?? 'Sin ubicación'}
                </span>
                        {client.dui_frontal_pic && (
                          <span className="rounded-full px-3 py-1 font-semibold bg-emerald-100 text-emerald-700">
                            DUI Frontal subido
                  </span>
                        )}
                        {client.dui_dorso_pic && (
                          <span className="rounded-full px-3 py-1 font-semibold bg-emerald-100 text-emerald-700">
                            DUI Dorso subido
                          </span>
                        )}
              </div>

                      {/* Sección de documentos DUI */}
                      {(client.dui_frontal_pic || client.dui_dorso_pic) && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Documentos DUI subidos
                          </p>
                          <div className="grid gap-4 sm:grid-cols-2">
                            {client.dui_frontal_pic && (
                              <div>
                                <p className="mb-2 text-xs font-semibold text-slate-700">
                                  DUI Frontal
                                </p>
                                <div className="relative">
                                  <img
                                    src={client.dui_frontal_pic}
                                    alt="DUI frontal"
                                    className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                                    onClick={() => window.open(client.dui_frontal_pic!, '_blank')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        window.open(client.dui_frontal_pic!, '_blank')
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => window.open(client.dui_frontal_pic!, '_blank')}
                                    className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                                  >
                                    Ver completo
                                  </button>
                                </div>
                              </div>
                            )}
                            {client.dui_dorso_pic && (
                              <div>
                                <p className="mb-2 text-xs font-semibold text-slate-700">
                                  DUI Dorso
                                </p>
                                <div className="relative">
                                  <img
                                    src={client.dui_dorso_pic}
                                    alt="DUI dorso"
                                    className="h-32 w-full rounded-lg border border-slate-200 object-cover"
                                    onClick={() => window.open(client.dui_dorso_pic!, '_blank')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        window.open(client.dui_dorso_pic!, '_blank')
                                      }
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => window.open(client.dui_dorso_pic!, '_blank')}
                                    className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                                  >
                                    Ver completo
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

              <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => handleApprove(client.id)}
                          disabled={processing === client.id}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                        >
                          {processing === client.id ? 'Procesando...' : 'Aprobar'}
                </button>
                        <button
                          onClick={() => setSelectedUserId(client.id)}
                          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Ver detalles
                </button>
                        <button
                          onClick={() => handleRejectClick(client.id)}
                          disabled={isProcessing}
                          className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
                        >
                          {isRejecting ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-600 border-t-transparent"></div>
                              Rechazando...
                            </>
                          ) : (
                            'Rechazar'
                          )}
                </button>
              </div>
            </article>
                  )
                })}
              </div>
              
              {/* Paginación para Clientes */}
              {pendingClients.length > itemsPerPage && (
                <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
                  <div className="text-sm text-slate-600">
                    Mostrando {clientStartIndex + 1}-{Math.min(clientEndIndex, pendingClients.length)} de {pendingClients.length} clientes
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setClientPage(prev => Math.max(1, prev - 1))}
                      disabled={clientPage === 1}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Anterior
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(5, clientTotalPages) }, (_, i) => {
                        let pageNum: number
                        if (clientTotalPages <= 5) {
                          pageNum = i + 1
                        } else if (clientPage <= 3) {
                          pageNum = i + 1
                        } else if (clientPage >= clientTotalPages - 2) {
                          pageNum = clientTotalPages - 4 + i
                        } else {
                          pageNum = clientPage - 2 + i
                        }
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setClientPage(pageNum)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                              clientPage === pageNum
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
                      onClick={() => setClientPage(prev => Math.min(clientTotalPages, prev + 1))}
                      disabled={clientPage === clientTotalPages}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Modal de detalles */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedUserId(null)
            }
          }}
        >
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {selectedUser.name} {selectedUser.last_name}
                </h3>
                <p className="mt-1 text-sm text-slate-500">{selectedUser.email}</p>
              </div>
              <button
                onClick={() => setSelectedUserId(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Información básica */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
                  Información básica
                </h4>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-slate-500">Ubicación</p>
                    <p className="font-semibold text-slate-900">
                      {selectedUser.location ?? 'Sin definir'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Fecha de registro</p>
                    <p className="font-semibold text-slate-900">
                      {new Date(selectedUser.created_at).toLocaleDateString('es-AR', {
                        dateStyle: 'long',
                      })}
                    </p>
                  </div>
                  {selectedUser.description && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500">Descripción</p>
                      <p className="font-semibold text-slate-900">{selectedUser.description}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Categorías - Solo para proveedores */}
              {selectedUser.is_provider && selectedUser.serviceCategories && selectedUser.serviceCategories.length > 0 && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
                    Categorías de servicio
                  </h4>
                  <div className="space-y-2">
                    {selectedUser.serviceCategories.map((cat, idx) => (
                      <div key={idx} className="rounded-lg bg-white p-3">
                        <p className="font-semibold text-slate-900">{cat.category}</p>
                        {cat.subcategories && cat.subcategories.length > 0 && (
                          <p className="mt-1 text-xs text-slate-500">
                            {cat.subcategories.join(', ')}
                          </p>
                        )}
                      </div>
          ))}
        </div>
      </section>
              )}

              {/* Documentos */}
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-600">
                  Documentos
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Solvencia Policial - Solo para proveedores */}
                  {selectedUser.is_provider && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">Solvencia Policial</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          selectedUser.police_clearance_verified
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedUser.police_clearance_verified ? 'Verificada' : 'Pendiente'}
                      </span>
                    </div>
                    {selectedUser.police_clearance_pic ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={selectedUser.police_clearance_pic}
                            alt="Solvencia policial"
                            className="h-48 w-full rounded-lg border border-slate-200 object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              window.open(selectedUser.police_clearance_pic!, '_blank')
                            }
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                        {!selectedUser.police_clearance_verified && (
                          <button
                            type="button"
                            onClick={() => handleVerifyDocument(selectedUser.id, 'police_clearance')}
                            disabled={processing === selectedUser.id}
                            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            ✓ Marcar como verificado
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No se ha subido documento
                      </p>
                    )}
                    </div>
                  )}

                  {/* Credencial Profesional - Solo para proveedores */}
                  {selectedUser.is_provider && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-700">
                          Credencial Profesional
                        </p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          selectedUser.professional_credential_verified
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedUser.professional_credential_verified ? 'Verificada' : 'Pendiente'}
                      </span>
                    </div>
                    {selectedUser.professional_credential_pic ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={selectedUser.professional_credential_pic}
                            alt="Credencial profesional"
                            className="h-48 w-full rounded-lg border border-slate-200 object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              window.open(selectedUser.professional_credential_pic!, '_blank')
                            }
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                        {!selectedUser.professional_credential_verified && (
                          <button
                            type="button"
                            onClick={() =>
                              handleVerifyDocument(selectedUser.id, 'professional_credential')
                            }
                            disabled={processing === selectedUser.id}
                            className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            ✓ Marcar como verificado
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No se ha subido documento
                      </p>
                    )}
                    </div>
                  )}

                  {/* DUI Frontal - Para todos (proveedores y clientes) */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">DUI Frontal</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          selectedUser.dui_frontal_pic
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedUser.dui_frontal_pic ? 'Subido' : 'No subido'}
                      </span>
                    </div>
                    {selectedUser.dui_frontal_pic ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={selectedUser.dui_frontal_pic}
                            alt="DUI frontal"
                            className="h-48 w-full rounded-lg border border-slate-200 object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              window.open(selectedUser.dui_frontal_pic!, '_blank')
                            }
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No se ha subido documento
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">DUI Dorso</p>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          selectedUser.dui_dorso_pic
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {selectedUser.dui_dorso_pic ? 'Subido' : 'No subido'}
                      </span>
                    </div>
                    {selectedUser.dui_dorso_pic ? (
                      <div className="space-y-2">
                        <div className="relative">
                          <img
                            src={selectedUser.dui_dorso_pic}
                            alt="DUI dorso"
                            className="h-48 w-full rounded-lg border border-slate-200 object-contain bg-white"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              window.open(selectedUser.dui_dorso_pic!, '_blank')
                            }
                            className="absolute bottom-2 right-2 rounded-full bg-slate-900/80 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900"
                          >
                            Ver completo
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                        No se ha subido documento
                      </p>
                    )}
                  </div>
                </div>
              </section>

              {/* Acciones */}
              <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
                <button
                  onClick={() => handleApprove(selectedUser.id)}
                  disabled={processing === selectedUser.id}
                  className="flex-1 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  {processing === selectedUser.id 
                    ? 'Procesando...' 
                    : `Aprobar ${selectedUser.is_provider ? 'proveedor' : 'cliente'}`}
                </button>
                <button
                  onClick={() => handleRejectClick(selectedUser.id)}
                  disabled={processing === selectedUser.id}
                  className="flex-1 rounded-full border border-red-200 bg-red-50 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  {processing === selectedUser.id ? 'Procesando...' : 'Rechazar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        onClose={() => {
          setShowConfirmDialog(false)
          setUserToReject(null)
        }}
        onConfirm={handleReject}
        title="Confirmar rechazo"
        message={
          userToReject && users.find(u => u.id === userToReject)?.is_provider
            ? "¿Estás seguro de rechazar a este proveedor? Se le enviará un email con instrucciones para completar su registro."
            : "¿Estás seguro de rechazar a este cliente? Se le enviará un email con instrucciones para completar su registro."
        }
        confirmText="Sí, rechazar"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  )
}

export default PendingUsers

