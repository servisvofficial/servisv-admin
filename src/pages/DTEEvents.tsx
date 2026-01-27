import { useState } from "react";
import { useDTEEvents } from "../hooks/useDTEEvents";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreateContingencyModal } from "../components/CreateContingencyModal";

export default function DTEEvents() {
  const { events, loading, error, refresh } = useDTEEvents();
  const [filter, setFilter] = useState<"all" | "invalidacion" | "contingencia">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [showContingencyModal, setShowContingencyModal] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("No se pudo copiar:", e);
    }
  };

  const shortText = (value: string, head = 8, tail = 6) => {
    if (!value) return value;
    if (value.length <= head + tail + 3) return value;
    return `${value.slice(0, head)}...${value.slice(-tail)}`;
  };

  const filteredEvents = events.filter((event: any) => {
    if (filter !== "all" && event.event_type !== filter) return false;
    if (statusFilter !== "all" && event.dte_estado !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (estado: string) => {
    const styles = {
      procesado: "bg-green-100 text-green-800",
      pendiente: "bg-yellow-100 text-yellow-800",
      rechazado: "bg-red-100 text-red-800",
    };
    return styles[estado as keyof typeof styles] || styles.pendiente;
  };

  const getTypeBadge = (type: string) => {
    return type === "invalidacion"
      ? "bg-red-100 text-red-800"
      : "bg-orange-100 text-orange-800";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Cargando eventos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Eventos DTE (Ministerio de Hacienda)
          </h1>
          <p className="text-gray-600 mt-2">
            Gestiona eventos de invalidación y contingencia
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700"
          onClick={() => setShowContingencyModal(true)}
        >
          Reportar Contingencia
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Evento
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="invalidacion">Invalidación</option>
              <option value="contingencia">Contingencia</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estado
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="procesado">Procesado</option>
              <option value="pendiente">Pendiente</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{filteredEvents.length}</span>{" "}
              evento(s) encontrado(s)
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de eventos */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Código de Generación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Factura Relacionada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  DTEs Reportados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No hay eventos registrados
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event: any) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getTypeBadge(
                          event.event_type
                        )}`}
                      >
                        {event.event_type === "invalidacion" ? "Invalidación" : "Contingencia"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.dte_codigo_generacion ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-xs text-gray-700"
                            title={event.dte_codigo_generacion}
                          >
                            {shortText(event.dte_codigo_generacion, 10, 8)}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-900"
                            onClick={() => copyToClipboard(event.dte_codigo_generacion)}
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">Pendiente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.billing?.invoice_number || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {event.motivo || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {event.event_type === "contingencia" ? event.dtes_reportados : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          event.dte_estado
                        )}`}
                      >
                        {event.dte_estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900"
                        onClick={() => setSelectedEvent(event)}
                      >
                        Ver detalles
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Eventos</div>
          <div className="text-2xl font-bold text-gray-900">{events.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Invalidaciones</div>
          <div className="text-2xl font-bold text-red-600">
            {events.filter((e: any) => e.event_type === "invalidacion").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Contingencias</div>
          <div className="text-2xl font-bold text-orange-600">
            {events.filter((e: any) => e.event_type === "contingencia").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Procesados</div>
          <div className="text-2xl font-bold text-green-600">
            {events.filter((e: any) => e.dte_estado === "procesado").length}
          </div>
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedEvent && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={() => setSelectedEvent(null)}
          />
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      Detalle del Evento
                    </h2>
                    <p className="text-gray-200 text-sm mt-1">
                      {selectedEvent.event_type === "invalidacion" ? "Invalidación" : "Contingencia"} · {selectedEvent.dte_estado}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase mb-1">
                        Código de Generación
                      </div>
                      <div className="font-mono text-sm text-gray-900 break-all">
                        {selectedEvent.dte_codigo_generacion || "-"}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase mb-1">
                        Sello Recibido
                      </div>
                      <div className="font-mono text-sm text-gray-900 break-all">
                        {selectedEvent.dte_sello_recepcion || "-"}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase mb-1">
                        Motivo
                      </div>
                      <div className="text-sm text-gray-900">
                        {selectedEvent.motivo || "-"}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase mb-1">
                        Estado
                      </div>
                      <div className="text-sm text-gray-900">
                        {selectedEvent.dte_estado}
                      </div>
                    </div>
                  </div>

                  {selectedEvent.event_type === "contingencia" && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <div className="text-xs text-orange-800 font-medium uppercase mb-2">
                        DTEs Reportados en Contingencia
                      </div>
                      <div className="text-2xl font-bold text-orange-900">
                        {selectedEvent.dtes_reportados} documentos
                      </div>
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                      <div className="text-sm font-semibold text-gray-900">
                        Respuesta del MH
                      </div>
                      <button
                        type="button"
                        className="text-xs text-blue-600 hover:text-blue-900"
                        onClick={() => copyToClipboard(JSON.stringify(selectedEvent.dte_response, null, 2))}
                      >
                        Copiar JSON
                      </button>
                    </div>
                    <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-80">
                      {JSON.stringify(selectedEvent.dte_response, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {showContingencyModal && (
        <CreateContingencyModal
          onClose={() => setShowContingencyModal(false)}
          onSuccess={() => {
            setShowContingencyModal(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}
