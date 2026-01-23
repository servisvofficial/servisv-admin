import { useState } from "react";
import { useCreditDebitNotes } from "../hooks/useCreditDebitNotes";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default function CreditDebitNotes() {
  const { notes, loading, error } = useCreditDebitNotes();
  const [filter, setFilter] = useState<"all" | "credit" | "debit">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

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
    </div>
  );
}
