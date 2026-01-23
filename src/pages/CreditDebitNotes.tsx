import { useState } from "react";
import { useCreditDebitNotes } from "../hooks/useCreditDebitNotes";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CreditDebitNotes() {
  const { notes, loading, error } = useCreditDebitNotes();
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedNote, setSelectedNote] = useState<any | null>(null);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("No se pudo copiar al portapapeles:", e);
    }
  };

  const shortText = (value: string, head = 8, tail = 6) => {
    if (!value) return value;
    if (value.length <= head + tail + 3) return value;
    return `${value.slice(0, head)}...${value.slice(-tail)}`;
  };

  const safeJsonStringify = (value: any) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const filteredNotes = notes.filter((note: any) => {
    if (filter !== "all" && note.note_type !== filter) return false;
    if (statusFilter !== "all" && note.dte_estado !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (estado: string) => {
    const styles = {
      procesado: "bg-green-100 text-green-800",
      pendiente: "bg-yellow-100 text-yellow-800",
      rechazado: "bg-red-100 text-red-800",
      contingencia: "bg-orange-100 text-orange-800",
      invalidado: "bg-gray-100 text-gray-800",
    };
    return styles[estado as keyof typeof styles] || styles.pendiente;
  };

  const getNoteTypeBadge = (type: string) => {
    return type === "credit"
      ? "bg-blue-100 text-blue-800"
      : "bg-purple-100 text-purple-800";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Cargando notas...</div>
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
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Notas de Crédito y Débito
        </h1>
        <p className="text-gray-600 mt-2">
          Gestiona las notas de crédito (05) y débito (06) emitidas
        </p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Nota
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todas</option>
              <option value="credit">Notas de Crédito (05)</option>
              <option value="debit">Notas de Débito (06)</option>
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
              <option value="contingencia">Contingencia</option>
            </select>
          </div>

          <div className="flex items-end">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{filteredNotes.length}</span>{" "}
              nota(s) encontrada(s)
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de notas */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código de Generación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número de Control
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Factura Relacionada
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Motivo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNotes.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No hay notas registradas
                  </td>
                </tr>
              ) : (
                filteredNotes.map((note: any) => (
                  <tr key={note.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getNoteTypeBadge(
                          note.note_type
                        )}`}
                      >
                        {note.note_type === "credit" ? "NC (05)" : "ND (06)"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {((note.dte_response?.codigoGeneracion || note.dte_codigo_generacion) as string | null) ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-xs text-gray-700"
                            title={(note.dte_response?.codigoGeneracion || note.dte_codigo_generacion) as string}
                          >
                            {shortText(
                              (note.dte_response?.codigoGeneracion || note.dte_codigo_generacion) as string,
                              10,
                              8
                            )}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-900"
                            title="Copiar código de generación (para buscar en Hacienda)"
                            onClick={() =>
                              copyToClipboard(
                                (note.dte_response?.codigoGeneracion || note.dte_codigo_generacion) as string
                              )
                            }
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">Pendiente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {note.dte_numero_control ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700" title={note.dte_numero_control}>
                            {shortText(note.dte_numero_control, 14, 10)}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-gray-600 hover:text-gray-900"
                            title="Copiar número de control"
                            onClick={() => copyToClipboard(note.dte_numero_control)}
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">Pendiente</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {note.billing?.invoice_number || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {note.motivo}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${note.monto_afectado.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          note.dte_estado
                        )}`}
                      >
                        {note.dte_estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(note.created_at), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        className="text-blue-600 hover:text-blue-900 mr-3"
                        title="Ver detalles"
                        onClick={() => setSelectedNote(note)}
                      >
                        Ver
                      </button>
                      {note.dte_estado === "procesado" && note.qr_url && (
                        <a
                          href={note.qr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 hover:text-green-900"
                          title="Consulta pública (QR)"
                        >
                          Consultar
                        </a>
                      )}
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
          <div className="text-sm text-gray-600">Total Notas</div>
          <div className="text-2xl font-bold text-gray-900">{notes.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Notas de Crédito</div>
          <div className="text-2xl font-bold text-blue-600">
            {notes.filter((n: any) => n.note_type === "credit").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Notas de Débito</div>
          <div className="text-2xl font-bold text-purple-600">
            {notes.filter((n: any) => n.note_type === "debit").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Procesadas</div>
          <div className="text-2xl font-bold text-green-600">
            {notes.filter((n: any) => n.dte_estado === "procesado").length}
          </div>
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedNote && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={() => setSelectedNote(null)}
          />
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex justify-between items-center flex-shrink-0">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Detalle de Nota</h2>
                    <p className="text-gray-200 text-sm mt-1">
                      {selectedNote.note_type === "credit" ? "Nota de Crédito (05)" : "Nota de Débito (06)"} ·{" "}
                      {selectedNote.dte_estado}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                    type="button"
                    title="Cerrar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                        Código de Generación (MH)
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-gray-900 break-all">
                          {selectedNote.dte_response?.codigoGeneracion || selectedNote.dte_codigo_generacion || "-"}
                        </div>
                        {(selectedNote.dte_response?.codigoGeneracion || selectedNote.dte_codigo_generacion) && (
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-900"
                            onClick={() =>
                              copyToClipboard(
                                selectedNote.dte_response?.codigoGeneracion ||
                                  selectedNote.dte_codigo_generacion
                              )
                            }
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                        Número de Control
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-gray-900 break-all">
                          {selectedNote.dte_numero_control || "-"}
                        </div>
                        {selectedNote.dte_numero_control && (
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-900"
                            onClick={() => copyToClipboard(selectedNote.dte_numero_control)}
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                        Sello recibido
                      </div>
                      <div className="font-mono text-sm text-gray-900 break-all">
                        {selectedNote.dte_sello_recepcion || selectedNote.dte_response?.selloRecibido || "-"}
                      </div>
                    </div>

                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                        Factura relacionada
                      </div>
                      <div className="text-sm text-gray-900">
                        {selectedNote.billing?.invoice_number || selectedNote.billing_id || "-"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Motivo</div>
                      <div className="text-sm text-gray-900">{selectedNote.motivo || "-"}</div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Monto</div>
                      <div className="text-sm font-semibold text-gray-900">
                        ${Number(selectedNote.monto_afectado || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Estado</div>
                      <div className="text-sm text-gray-900">{selectedNote.dte_estado}</div>
                    </div>
                  </div>

                  {Array.isArray(selectedNote.dte_observaciones) && selectedNote.dte_observaciones.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="text-xs text-yellow-800 font-medium uppercase tracking-wide mb-2">
                        Observaciones
                      </div>
                      <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1">
                        {selectedNote.dte_observaciones.map((obs: string, idx: number) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-900">Respuesta MH</div>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-900"
                          onClick={() => copyToClipboard(safeJsonStringify(selectedNote.dte_response))}
                        >
                          Copiar JSON
                        </button>
                      </div>
                      <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-80">
                        {safeJsonStringify(selectedNote.dte_response)}
                      </pre>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-900">DTE Nota (JSON)</div>
                        <button
                          type="button"
                          className="text-xs text-blue-600 hover:text-blue-900"
                          onClick={() => copyToClipboard(safeJsonStringify(selectedNote.dte_json))}
                        >
                          Copiar JSON
                        </button>
                      </div>
                      <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-80">
                        {safeJsonStringify(selectedNote.dte_json)}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                  {selectedNote.dte_estado === "procesado" && selectedNote.qr_url && (
                    <a
                      href={selectedNote.qr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      Consulta pública (QR)
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedNote(null)}
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
    </div>
  );
}
