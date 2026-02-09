import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useReportsData } from '../hooks/useReportsData'
import { sendReportNotificationToReportedUser, sendReportResolutionToReporter } from '../services/email'
import { useToast } from '../components/ui/use-toast'

const statusPalette: Record<string, { label: string; badge: string }> = {
  submitted: { label: 'Recibido', badge: 'bg-amber-100 text-amber-800' },
  under_review: { label: 'En revisión', badge: 'bg-sky-100 text-sky-800' },
  resolved: { label: 'Resuelto', badge: 'bg-emerald-100 text-emerald-800' },
  dismissed: { label: 'Descartado', badge: 'bg-slate-100 text-slate-600' },
}

const actionOptions = [
  { value: 'none', label: 'Sin acción' },
  { value: 'warning_issued', label: 'Advertencia emitida' },
  { value: 'content_removed', label: 'Contenido removido' },
  { value: 'user_suspended', label: 'Usuario suspendido' },
  { value: 'user_banned', label: 'Usuario baneado' },
]

const statusOptions = [
  { value: 'submitted', label: 'Recibido' },
  { value: 'under_review', label: 'En revisión' },
  { value: 'resolved', label: 'Resuelto' },
  { value: 'dismissed', label: 'Descartado' },
]

type RequestPreview = {
  id: string
  title: string
  description: string
  photos: string[] | null
  location: string | null
  service_category: string
  subcategory: string | null
  client_name: string
  client_id: string | null
  status: string
  budget_range: { min?: number; max?: number } | null
  scheduled_date: string | null
  coordinates: { lat: number; lng: number } | null
  created_at: string
  updated_at: string
}

function Reports() {
  const { reports, loading, error, refetch, updateReport, toggleUserBan } =
    useReportsData()
  const { toast } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [requestPreview, setRequestPreview] = useState<RequestPreview | null>(
    null,
  )
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [requestChat, setRequestChat] = useState<{ id: string; client_id: string; professional_id: string } | null>(null)
  const [requestChatMessages, setRequestChatMessages] = useState<Array<{ id: number; sender_id: string; content: string | null; type: string; created_at: string; attachment_url: string | null }>>([])
  const [chatParticipantNames, setChatParticipantNames] = useState<Record<string, string>>({})
  const [loadingChat, setLoadingChat] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [resolutionForm, setResolutionForm] = useState({
    status: 'submitted',
    action_taken: 'none',
    moderator_notes: '',
  })
  const [savingResolution, setSavingResolution] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 15

  const selectedReport = useMemo(() => {
    if (!reports.length) return null
    return reports.find((report) => report.id === selectedId) ?? reports[0]
  }, [reports, selectedId])

  useEffect(() => {
    if (!selectedId && reports.length) {
      setSelectedId(reports[0].id)
    }
  }, [reports, selectedId])

  useEffect(() => {
    if (!selectedReport) return
    console.log('Actualizando formulario con reporte seleccionado:', {
      id: selectedReport.id,
      status: selectedReport.status,
      action_taken: selectedReport.action_taken,
      resolved_by: selectedReport.resolved_by,
      resolved_at: selectedReport.resolved_at,
    })
    setResolutionForm({
      status: selectedReport.status,
      action_taken: selectedReport.action_taken,
      moderator_notes: selectedReport.moderator_notes ?? '',
    })
  }, [selectedReport])

  useEffect(() => {
    if (
      selectedReport?.reported_content_type === 'request' &&
      selectedReport.reported_content_id
    ) {
      setLoadingPreview(true)
      setPreviewError(null)
      const query = supabase
        .from('requests')
        .select(
          'id,title,description,photos,location,service_category,subcategory,client_name,client_id,status,budget_range,scheduled_date,coordinates,created_at,updated_at',
        )
        .eq('id', selectedReport.reported_content_id)
        .single()
      
      Promise.resolve(query)
        .then(({ data, error }) => {
          if (error) {
            setPreviewError(error.message)
            setRequestPreview(null)
          } else if (data) {
            setRequestPreview(data as RequestPreview)
          }
          setLoadingPreview(false)
        })
        .catch((err) => {
          setPreviewError(err.message)
          setRequestPreview(null)
          setLoadingPreview(false)
        })
    } else {
      setRequestPreview(null)
    }
  }, [
    selectedReport?.id,
    selectedReport?.reported_content_type,
    selectedReport?.reported_content_id,
  ])

  // Cargar chat de la solicitud cuando el reporte es por una request
  useEffect(() => {
    if (
      selectedReport?.reported_content_type !== 'request' ||
      !selectedReport.reported_content_id
    ) {
      setRequestChat(null)
      setRequestChatMessages([])
      setChatParticipantNames({})
      setChatError(null)
      return
    }
    const requestId = selectedReport.reported_content_id
    setLoadingChat(true)
    setChatError(null)
    ;(async () => {
      try {
        const { data: chatData, error: chatErr } = await supabase
          .from('chats')
          .select('id, client_id, professional_id')
          .eq('request_id', requestId)
          .maybeSingle()

        if (chatErr) {
          setChatError(chatErr.message)
          setRequestChat(null)
          setRequestChatMessages([])
          setLoadingChat(false)
          return
        }
        if (!chatData) {
          setRequestChat(null)
          setRequestChatMessages([])
          setLoadingChat(false)
          return
        }
        setRequestChat(chatData)

        const { data: participants } = await supabase
          .from('users')
          .select('id, name, last_name')
          .in('id', [chatData.client_id, chatData.professional_id])
        const names: Record<string, string> = {}
        if (participants) {
          participants.forEach((u: { id: string; name: string; last_name: string }) => {
            names[u.id] = [u.name, u.last_name].filter(Boolean).join(' ').trim() || u.id
          })
        }
        setChatParticipantNames(names)

        const { data: messagesData, error: messagesErr } = await supabase
          .from('messages')
          .select('id, sender_id, content, type, created_at, attachment_url')
          .eq('chat_id', chatData.id)
          .order('created_at', { ascending: true })

        if (messagesErr) {
          setChatError(messagesErr.message)
          setRequestChatMessages([])
        } else {
          setRequestChatMessages(messagesData ?? [])
        }
      } catch (e) {
        setChatError(e instanceof Error ? e.message : 'Error al cargar el chat')
        setRequestChatMessages([])
      } finally {
        setLoadingChat(false)
      }
    })()
  }, [
    selectedReport?.reported_content_type,
    selectedReport?.reported_content_id,
  ])

  const statusSummary = useMemo(() => {
    const summary: Record<string, number> = {}
    reports.forEach((report) => {
      summary[report.status] = (summary[report.status] ?? 0) + 1
    })
    return summary
  }, [reports])

  // Top de motivos más reportados
  const topReasons = useMemo(() => {
    const reasonCounts: Record<string, number> = {}
    reports.forEach((report) => {
      reasonCounts[report.reason_category] = (reasonCounts[report.reason_category] ?? 0) + 1
    })
    
    // Convertir a array y ordenar por cantidad (descendente)
    return Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5
  }, [reports])

  // Mapeo de motivos a etiquetas en español
  const reasonLabels: Record<string, string> = {
    spam: 'Spam',
    contenido_inapropiado: 'Contenido Inapropiado',
    discurso_de_odio: 'Discurso de Odio',
    acoso: 'Acoso',
    informacion_falsa: 'Información Falsa',
    violacion_terminos: 'Violación de Términos',
    otro: 'Otro',
  }

  // Paginación
  const totalPages = Math.ceil(reports.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedReports = useMemo(() => 
    reports.slice(startIndex, endIndex),
    [reports, startIndex, endIndex]
  )

  // Resetear a página 1 cuando cambian los reportes
  useEffect(() => {
    setCurrentPage(1)
  }, [reports.length])

  const handleResolutionSave = async () => {
    if (!selectedReport) {
      setFeedback('Error: No hay reporte seleccionado')
      return
    }
    try {
      setSavingResolution(true)
      setFeedback(null)
      
      console.log('Guardando cambios del reporte:', selectedReport.id)
      console.log('Payload a enviar:', resolutionForm)
      
      const isResolved = resolutionForm.status === 'resolved' || resolutionForm.status === 'dismissed'
      
      // Preparar el payload de actualización
      const updatePayload: Record<string, any> = {
        status: resolutionForm.status,
        action_taken: resolutionForm.action_taken,
        moderator_notes: resolutionForm.moderator_notes || null,
      }

      // Solo agregar resolved_by y resolved_at si el reporte está resuelto
      if (isResolved) {
        updatePayload.resolved_by = 'servisv-admin'
        updatePayload.resolved_at = new Date().toISOString()
      } else {
        // Si no está resuelto, limpiar estos campos
        updatePayload.resolved_by = null
        updatePayload.resolved_at = null
      }
      
      console.log('Actualizando reporte con payload:', updatePayload)
      
      // Actualizar el reporte
      await updateReport(selectedReport.id, updatePayload)
      
      console.log('Reporte actualizado exitosamente, esperando un momento antes de refetch...')
      
      // Esperar un momento para que la BD se actualice
      await new Promise(resolve => setTimeout(resolve, 500))

      // Si el reporte fue resuelto o descartado, enviar emails automáticamente
      if (isResolved) {
        const actionLabels: Record<string, string> = {
          none: 'Sin acción',
          warning_issued: 'Advertencia emitida',
          content_removed: 'Contenido removido',
          user_suspended: 'Usuario suspendido',
          user_banned: 'Usuario baneado',
        }

        const actionLabel = actionLabels[resolutionForm.action_taken] || resolutionForm.action_taken

        // Email al usuario reportado
        if (selectedReport.reportedUser?.email) {
          try {
            await sendReportNotificationToReportedUser({
              to: selectedReport.reportedUser.email,
              toName: `${selectedReport.reportedUser.name} ${selectedReport.reportedUser.last_name}`,
              reasonCategory: selectedReport.reason_category,
              actionTaken: actionLabel,
              moderatorNotes: resolutionForm.moderator_notes || null,
              reporterName: selectedReport.reporter
                ? `${selectedReport.reporter.name} ${selectedReport.reporter.last_name}`
                : 'Un usuario',
            })
          } catch (emailError) {
            console.error('Error al enviar email al usuario reportado:', emailError)
          }
        }

        // Email al usuario que hizo el reporte
        if (selectedReport.reporter?.email) {
          try {
            await sendReportResolutionToReporter({
              to: selectedReport.reporter.email,
              toName: `${selectedReport.reporter.name} ${selectedReport.reporter.last_name}`,
              reasonCategory: selectedReport.reason_category,
              actionTaken: actionLabel,
              moderatorNotes: resolutionForm.moderator_notes || null,
              reportedUserName: selectedReport.reportedUser
                ? `${selectedReport.reportedUser.name} ${selectedReport.reportedUser.last_name}`
                : 'El usuario reportado',
            })
          } catch (emailError) {
            console.error('Error al enviar email al reporter:', emailError)
          }
        }
      }

      console.log('Recargando datos desde la base de datos...')
      
      // Recargar los datos para reflejar los cambios
      await refetch()
      
      console.log('Datos recargados, esperando actualización del estado...')
      
      // Esperar un momento para que el estado se actualice después del refetch
      await new Promise(resolve => setTimeout(resolve, 300))
      
      let emailMessage = ''
      if (isResolved) {
        const emailsSent = []
        if (selectedReport.reportedUser?.email) emailsSent.push('usuario reportado')
        if (selectedReport.reporter?.email) emailsSent.push('usuario que hizo el reporte')
        emailMessage = emailsSent.length > 0 
          ? ` Los emails han sido enviados a: ${emailsSent.join(' y ')}.`
          : ' Nota: No se pudieron enviar los emails (faltan datos de usuarios).'
      } else {
        emailMessage = ' Nota: Los emails solo se envían cuando el estado es "Resuelto" o "Descartado".'
      }
      
      const successMessage = `Cambios guardados correctamente.${emailMessage}`
      setFeedback(`✅ ${successMessage}`)
      
      toast({
        title: "✅ Cambios guardados",
        description: successMessage,
      })
      
      console.log('Feedback establecido:', `✅ ${successMessage}`)
    } catch (err) {
      console.error('Error completo al guardar:', err)
      const errorMessage = err instanceof Error ? err.message : 'No se pudo actualizar el reporte'
      setFeedback(`❌ Error: ${errorMessage}`)
      
      toast({
        variant: "destructive",
        title: "❌ Error al guardar",
        description: errorMessage,
      })
      
      console.log('Feedback de error establecido:', errorMessage)
    } finally {
      setSavingResolution(false)
    }
  }


  const handleToggleBan = async () => {
    if (!selectedReport?.reported_user_id || !selectedReport.reportedUser) return
    try {
      await toggleUserBan(
        selectedReport.reported_user_id,
        !selectedReport.reportedUser.is_banned,
      )
      setFeedback(
        selectedReport.reportedUser.is_banned
          ? 'Usuario restaurado correctamente.'
          : 'Usuario bloqueado correctamente.',
      )
    } catch (err) {
      setFeedback(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el estado del usuario',
      )
    }
  }

  return (
    <div className="space-y-8 text-slate-900">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900">
            Reportes y moderación
          </h2>
        <p className="mt-2 text-sm text-slate-600">
            Gestiona en un solo lugar los reportes con toda la información del
            usuario o solicitud involucrada.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refetch}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Actualizar
          </button>
          <span className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            {loading ? '—' : `${reports.length} reportes`}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {feedback && (
        <div className={`rounded-2xl border p-4 text-sm ${
          feedback.startsWith('❌') 
            ? 'border-red-200 bg-red-50 text-red-700' 
            : feedback.startsWith('✅')
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-slate-200 bg-white text-slate-700'
        }`}>
          {feedback}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(statusSummary).map(([status, count]) => {
          const palette = statusPalette[status] ?? {
            label: status,
            badge: 'bg-slate-100 text-slate-600',
          }
          return (
            <article
              key={status}
              className="rounded-3xl border border-white/70 bg-white/90 p-4 shadow-lg"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                {palette.label}
              </p>
              <p className="mt-2 text-3xl font-semibold text-slate-900">{count}</p>
              <span
                className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette.badge}`}
              >
                {status}
            </span>
          </article>
          )
        })}
      </section>

      {/* Top de motivos más reportados */}
      {topReasons.length > 0 && (
        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
          <header className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Top Motivos de Reporte
            </h3>
            <p className="text-sm text-slate-500">
              Los motivos más frecuentes por los que los usuarios reportan contenido
            </p>
          </header>
          <div className="space-y-3">
            {topReasons.map((item, index) => {
              const percentage = reports.length > 0 
                ? ((item.count / reports.length) * 100).toFixed(1) 
                : '0'
              return (
                <div
                  key={item.reason}
                  className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold text-lg">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-slate-900">
                        {reasonLabels[item.reason] || item.reason}
                      </p>
                      <div className="text-right">
                        <p className="text-lg font-bold text-slate-900">{item.count}</p>
                        <p className="text-xs text-slate-500">{percentage}%</p>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-3 rounded-3xl border border-white/70 bg-white/80 p-4 shadow-lg">
          {loading && <p className="text-sm text-slate-500">Cargando...</p>}
          {!loading && paginatedReports.length === 0 && (
            <p className="text-sm text-slate-500">No hay reportes disponibles.</p>
          )}
          {!loading &&
            paginatedReports.map((report) => {
              const palette = statusPalette[report.status] ?? {
                label: report.status,
                badge: 'bg-slate-100 text-slate-600',
              }
              const isActive = selectedReport?.id === report.id
              return (
                <button
                  key={report.id}
                  type="button"
                  onClick={() => setSelectedId(report.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    isActive
                      ? 'border-slate-900 bg-white shadow-lg'
                      : 'border-transparent bg-white/60 hover:border-slate-200'
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {report.reason_category}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {report.reporter
                      ? `${report.reporter.name} ${report.reporter.last_name}`
                      : `ID: ${report.reporter_id.slice(0, 12)}...`}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Reportado:{' '}
                    {report.reportedUser
                      ? `${report.reportedUser.name} ${report.reportedUser.last_name}`
                      : `ID: ${report.reported_user_id.slice(0, 12)}...`}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette.badge}`}
                  >
                    {palette.label}
                  </span>
                </button>
              )
            })}
          
          {/* Paginación */}
          {!loading && reports.length > itemsPerPage && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-600">
                Mostrando {startIndex + 1}-{Math.min(endIndex, reports.length)} de {reports.length} reportes
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </aside>

        <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
          {selectedReport ? (
            <div className="space-y-6">
              <header>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  Reporte #{selectedReport.id.slice(0, 8)}
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  {selectedReport.reason_category}
                </h3>
                {selectedReport.details && (
                  <p className="mt-2 text-sm text-slate-600">
                    {selectedReport.details}
                  </p>
                )}
                {selectedReport.reported_content_type === 'request' && requestPreview && (
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    Reportado por:{' '}
                    <span className={selectedReport.reporter_id === requestPreview.client_id ? 'text-blue-600' : 'text-emerald-600'}>
                      {selectedReport.reporter_id === requestPreview.client_id ? 'el cliente' : 'el proveedor'}
                    </span>
                    {selectedReport.reporter && (
                      <span className="text-slate-500 font-normal">
                        {' '}({selectedReport.reporter.name} {selectedReport.reporter.last_name})
                      </span>
                    )}
                  </p>
                )}
              </header>

              <div className="grid gap-4 md:grid-cols-2">
                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Reporter
                  </p>
                  {selectedReport.reporter ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-lg font-semibold text-slate-900">
                        {selectedReport.reporter.name} {selectedReport.reporter.last_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedReport.reporter.email}
                      </p>
                      {selectedReport.reporter.location && (
                        <p className="text-xs text-slate-500">
                          📍 {selectedReport.reporter.location}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {selectedReport.reporter.is_provider && (
                          <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                            Proveedor
                          </span>
                        )}
                        {selectedReport.reporter.is_validated && (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                            Verificado
                          </span>
                        )}
                        {selectedReport.reporter.is_banned && (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      {selectedReport.reporter.serviceCategories &&
                        selectedReport.reporter.serviceCategories.length > 0 && (
                          <p className="text-xs text-slate-500 mt-2">
                            Categorías:{' '}
                            {selectedReport.reporter.serviceCategories
                              .map(
                                (cat) =>
                                  `${cat.category}${cat.subcategories && cat.subcategories.length > 0 ? ` (${cat.subcategories.join(', ')})` : ''}`,
                              )
                              .join(', ')}
                          </p>
                        )}
                    </div>
                  ) : (
                    <div className="mt-3">
                      <p className="text-sm text-slate-500">
                        ID: {selectedReport.reporter_id}
                      </p>
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ Usuario no encontrado en la base de datos
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          await refetch()
                        }}
                        className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                      >
                        🔄 Reintentar carga
                      </button>
                    </div>
                  )}
                </article>

                <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                        Usuario reportado
                      </p>
                      {selectedReport.reportedUser ? (
                        <div className="mt-3 space-y-2">
                          <p className="text-lg font-semibold text-slate-900">
                            {selectedReport.reportedUser.name} {selectedReport.reportedUser.last_name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {selectedReport.reportedUser.email}
                          </p>
                          {selectedReport.reportedUser.location && (
                            <p className="text-xs text-slate-500">
                              📍 {selectedReport.reportedUser.location}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {selectedReport.reportedUser.is_provider && (
                              <span className="rounded-full bg-purple-100 px-2 py-1 text-xs font-semibold text-purple-700">
                                Proveedor
                              </span>
                            )}
                            {selectedReport.reportedUser.is_validated && (
                              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                Verificado
                              </span>
                            )}
                            {selectedReport.reportedUser.is_banned && (
                              <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                                Bloqueado
                              </span>
                            )}
                          </div>
                          {selectedReport.reportedUser.serviceCategories &&
                            selectedReport.reportedUser.serviceCategories.length > 0 && (
                              <p className="text-xs text-slate-500 mt-2">
                                Categorías:{' '}
                                {selectedReport.reportedUser.serviceCategories
                                  .map(
                                    (cat) =>
                                      `${cat.category}${cat.subcategories && cat.subcategories.length > 0 ? ` (${cat.subcategories.join(', ')})` : ''}`,
                                  )
                                  .join(', ')}
                              </p>
                            )}
                        </div>
                      ) : (
                        <div className="mt-3">
                          <p className="text-sm text-slate-500">
                            ID: {selectedReport.reported_user_id}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            ⚠️ Usuario no encontrado en la base de datos
                          </p>
                          <button
                            type="button"
                            onClick={async () => {
                              await refetch()
                            }}
                            className="mt-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                          >
                            🔄 Reintentar carga
                          </button>
                        </div>
                      )}
          </div>
                    {selectedReport.reportedUser && (
                      <button
                        type="button"
                        onClick={handleToggleBan}
                        className={`ml-3 rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                          selectedReport.reportedUser.is_banned
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {selectedReport.reportedUser.is_banned
                          ? 'Desbloquear'
                          : 'Bloquear'}
          </button>
                    )}
                  </div>
                </article>
              </div>

              <div>
                <article className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4">
                  <h4 className="text-sm font-semibold text-slate-900">
                    Resolver reporte
                  </h4>
                  <p className="text-xs text-slate-500">
                    Al cambiar el estado a "Resuelto" o "Descartado", se enviarán automáticamente emails al usuario reportado y al usuario que hizo el reporte.
                  </p>
                  <label className="text-xs font-semibold text-slate-500">
                    Estado
                    <select
                      value={resolutionForm.status}
                      onChange={(event) =>
                        setResolutionForm((prev) => ({
                          ...prev,
                          status: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Acción
                    <select
                      value={resolutionForm.action_taken}
                      onChange={(event) =>
                        setResolutionForm((prev) => ({
                          ...prev,
                          action_taken: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    >
                      {actionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-slate-500">
                    Notas de moderación
                    <textarea
                      value={resolutionForm.moderator_notes}
                      onChange={(event) =>
                        setResolutionForm((prev) => ({
                          ...prev,
                          moderator_notes: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                      rows={3}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleResolutionSave}
                    disabled={savingResolution}
                    className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {savingResolution ? 'Guardando...' : 'Guardar cambios'}
                  </button>
            </article>
        </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-900">
                  Contenido reportado
                </h4>
                {selectedReport.reported_content_type === 'user_profile' &&
                selectedReport.reportedUser ? (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="space-y-3">
          <div>
                        <p className="text-lg font-semibold text-slate-900">
                          {selectedReport.reportedUser.name}{' '}
                          {selectedReport.reportedUser.last_name}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {selectedReport.reportedUser.email}
                        </p>
                      </div>
                      {selectedReport.reportedUser.description && (
                        <p className="text-sm text-slate-600">
                          {selectedReport.reportedUser.description}
                        </p>
                      )}
                      <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        {selectedReport.reportedUser.serviceCategories &&
                          selectedReport.reportedUser.serviceCategories.length > 0 && (
                            <p>
                              <span className="font-semibold">Categorías:</span>{' '}
                              {selectedReport.reportedUser.serviceCategories
                                .map(
                                  (cat) =>
                                    `${cat.category}${cat.subcategories && cat.subcategories.length > 0 ? ` (${cat.subcategories.join(', ')})` : ''}`,
                                )
                                .join(', ')}
                            </p>
                          )}
                        {selectedReport.reportedUser.location && (
                          <p>
                            <span className="font-semibold">Ubicación:</span>{' '}
                            {selectedReport.reportedUser.location}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {selectedReport.reportedUser.is_provider && (
                          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                            Proveedor
                          </span>
                        )}
                        {selectedReport.reportedUser.is_validated && (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Verificado
                          </span>
                        )}
                        {selectedReport.reportedUser.is_banned && (
                          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                            Bloqueado
                          </span>
                        )}
                        {selectedReport.reportedUser.profile_pic && (
                          <img
                            src={selectedReport.reportedUser.profile_pic}
                            alt={`${selectedReport.reportedUser.name} ${selectedReport.reportedUser.last_name}`}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        )}
                      </div>
          </div>
                  </article>
                ) : selectedReport.reported_content_type === 'user_profile' ? (
                  <article className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm text-amber-700">
                      ⚠️ No se pudo cargar el perfil del usuario. ID:{' '}
                      {selectedReport.reported_user_id}
                    </p>
            </article>
                ) : null}

                {selectedReport.reported_content_type === 'request' && (
                  <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    {loadingPreview && (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"></div>
                        Cargando detalles de la solicitud...
                      </div>
                    )}
                    {previewError && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-sm font-semibold text-red-700">
                          ⚠️ Error al cargar la solicitud
                        </p>
                        <p className="text-xs text-red-600 mt-1">{previewError}</p>
                        <p className="text-xs text-red-500 mt-1">
                          ID: {selectedReport.reported_content_id}
                        </p>
                      </div>
                    )}
                    {!loadingPreview && requestPreview && (
                      <div className="space-y-4">
                        {/* Título y estado */}
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h5 className="text-lg font-semibold text-slate-900">
                              {requestPreview.title}
                            </h5>
                            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              requestPreview.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              requestPreview.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                              requestPreview.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {requestPreview.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            ID: {requestPreview.id}
                          </p>
                        </div>

                        {/* Descripción */}
                        {requestPreview.description && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1">
                              Descripción:
                            </p>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                              {requestPreview.description}
                            </p>
                          </div>
                        )}

                        {/* Información de categoría y ubicación */}
                        <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                          <div>
                            <span className="font-semibold">Categoría:</span>{' '}
                            {requestPreview.service_category}
                            {requestPreview.subcategory && (
                              <span className="text-slate-500">
                                {' '}· {requestPreview.subcategory}
                              </span>
                            )}
                          </div>
                          {requestPreview.location && (
                            <div>
                              <span className="font-semibold">📍 Ubicación:</span>{' '}
                              {requestPreview.location}
                            </div>
                          )}
                          {requestPreview.client_name && (
                            <div>
                              <span className="font-semibold">Cliente:</span>{' '}
                              {requestPreview.client_name}
                            </div>
                          )}
                          {requestPreview.budget_range && (
                            <div>
                              <span className="font-semibold">Presupuesto:</span>{' '}
                              {requestPreview.budget_range.min && requestPreview.budget_range.max
                                ? `$${requestPreview.budget_range.min} - $${requestPreview.budget_range.max} USD`
                                : requestPreview.budget_range.min
                                ? `Desde $${requestPreview.budget_range.min} USD`
                                : requestPreview.budget_range.max
                                ? `Hasta $${requestPreview.budget_range.max} USD`
                                : 'No especificado'}
                            </div>
                          )}
                          {requestPreview.scheduled_date && (
                            <div>
                              <span className="font-semibold">📅 Fecha programada:</span>{' '}
                              {new Date(requestPreview.scheduled_date).toLocaleDateString('es-AR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                          <div>
                            <span className="font-semibold">Creada:</span>{' '}
                            {new Date(requestPreview.created_at).toLocaleDateString('es-AR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        {/* Imágenes */}
                        {requestPreview.photos && requestPreview.photos.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-2">
                              Imágenes ({requestPreview.photos.length}):
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {requestPreview.photos.map((photo, index) => (
                                <div key={index} className="relative group">
                                  <img
                                    src={photo}
                                    alt={`${requestPreview.title} - Imagen ${index + 1}`}
                                    className="h-32 w-full rounded-lg object-cover border border-slate-200 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                      window.open(photo, '_blank')
                                    }}
                                  />
                                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                    <span className="text-white text-xs font-semibold">
                                      Ver completo
                                    </span>
                                  </div>
                                </div>
          ))}
        </div>
                          </div>
                        )}

                        {/* Chat de la solicitud */}
                        <div className="pt-4 border-t border-slate-200">
                          <h6 className="text-sm font-semibold text-slate-700 mb-2">
                            Chat de la solicitud
                          </h6>
                          <p className="text-xs text-slate-500 mb-3">
                            Conversación entre cliente y proveedor para entender el contexto del reporte.
                          </p>
                          {loadingChat && (
                            <div className="flex items-center gap-2 text-sm text-slate-500 py-4">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                              Cargando mensajes...
                            </div>
                          )}
                          {chatError && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="text-sm text-amber-800">No se pudo cargar el chat: {chatError}</p>
                            </div>
                          )}
                          {!loadingChat && requestChat && requestChatMessages.length === 0 && !chatError && (
                            <p className="text-sm text-slate-500 py-3">No hay mensajes en este chat.</p>
                          )}
                          {!loadingChat && requestChatMessages.length > 0 && requestChat && (
                            <div className="rounded-xl border border-slate-200 bg-slate-50/80 flex flex-col min-h-[12rem] max-h-[28rem] overflow-y-auto overflow-x-hidden overscroll-contain">
                              {requestChatMessages.length > 8 && (
                                <p className="text-xs text-slate-500 px-3 py-2 border-b border-slate-200 bg-slate-100/80 sticky top-0 z-10">
                                  {requestChatMessages.length} mensajes — desplaza para ver todo el historial
                                </p>
                              )}
                              <ul className="divide-y divide-slate-200 p-3 space-y-2 flex-1">
                                {requestChatMessages.map((msg) => {
                                  const isClient = msg.sender_id === requestChat.client_id
                                  const displayName = chatParticipantNames[msg.sender_id] ?? (isClient ? 'Cliente' : 'Proveedor')
                                  return (
                                    <li
                                      key={msg.id}
                                      className={`flex flex-col gap-0.5 ${isClient ? 'items-start' : 'items-end'}`}
                                    >
                                      <span className={`text-xs font-medium ${isClient ? 'text-blue-600' : 'text-emerald-600'}`}>
                                        {displayName}
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {new Date(msg.created_at).toLocaleString('es-AR', {
                                          day: '2-digit',
                                          month: 'short',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                      {msg.type === 'text' && msg.content && (
                                        <p className="text-sm text-slate-800 whitespace-pre-wrap break-words max-w-full rounded-lg bg-white px-3 py-2 border border-slate-100 shadow-sm">
                                          {msg.content}
                                        </p>
                                      )}
                                      {msg.type !== 'text' && msg.content && (
                                        <p className="text-sm text-slate-700 italic">[{msg.type}] {msg.content}</p>
                                      )}
                                      {msg.attachment_url && (
                                        <a
                                          href={msg.attachment_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-xs text-purple-600 hover:underline"
                                        >
                                          Ver adjunto
                                        </a>
                                      )}
                                    </li>
                                  )
                                })}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Enlace para ver la solicitud completa */}
                        <div className="pt-2 border-t border-slate-200">
                          <button
                            type="button"
                            onClick={() => {
                              const webAppUrl = import.meta.env.VITE_WEB_APP_URL || 'http://localhost:5173'
                              const url = `${webAppUrl}/solicitud/${requestPreview.id}`
                              console.log('Abriendo solicitud en:', url)
                              window.open(url, '_blank', 'noopener,noreferrer')
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-semibold inline-flex items-center gap-1 underline"
                          >
                            Ver solicitud completa →
                          </button>
                          <p className="text-xs text-slate-400 mt-1">
                            ID: {requestPreview.id}
                          </p>
                        </div>
                      </div>
                    )}
                    {!loadingPreview && !requestPreview && !previewError && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3">
                        <p className="text-sm text-amber-700">
                          ⚠️ No se pudo cargar la solicitud. ID:{' '}
                          {selectedReport.reported_content_id}
                        </p>
                      </div>
                    )}
                  </article>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              Selecciona un reporte para ver sus detalles.
            </p>
          )}
      </section>
      </div>
    </div>
  )
}

export default Reports

