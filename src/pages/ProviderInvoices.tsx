import { useState } from "react";
import { useProviderInvoices } from "../hooks/useProviderInvoices";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ProviderInvoice } from "../hooks/useProviderInvoices";

function buildQrUrl(codigo: string, fechaEmi: string, ambiente: string): string {
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambiente}&codGen=${codigo}&fechaEmi=${fechaEmi}`;
}

export default function ProviderInvoices() {
  const { invoices, loading, error } = useProviderInvoices();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedInvoice, setSelectedInvoice] = useState<ProviderInvoice | null>(null);

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

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.dte_estado !== statusFilter) return false;
    return true;
  });

  const getStatusBadge = (estado: string) => {
    const styles: Record<string, string> = {
      procesado: "bg-green-100 text-green-800",
      pendiente: "bg-yellow-100 text-yellow-800",
      rechazado: "bg-red-100 text-red-800",
      contingencia: "bg-orange-100 text-orange-800",
    };
    return styles[estado] || "bg-gray-100 text-gray-800";
  };

  const getTipoBadge = (tipo: string) => {
    return tipo === "03" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Cargando facturas al proveedor...</div>
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
        <h1 className="text-3xl font-bold text-gray-900">Facturas al proveedor</h1>
        <p className="text-gray-600 mt-2">
          DTE 01 (Consumidor Final) y 03 (Crédito Fiscal) emitidos a proveedores
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado</label>
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
              <span className="font-semibold">{filteredInvoices.length}</span> factura(s)
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código generación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nº control</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receptor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No hay facturas al proveedor registradas
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getTipoBadge(inv.dte_tipo_documento)}`}>
                        {inv.dte_tipo_documento === "03" ? "CCF (03)" : "FCF (01)"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {inv.dte_codigo_generacion ? (
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-700" title={inv.dte_codigo_generacion}>
                            {shortText(inv.dte_codigo_generacion, 10, 8)}
                          </span>
                          <button
                            type="button"
                            className="text-xs text-blue-600 hover:text-blue-900"
                            onClick={() => copyToClipboard(inv.dte_codigo_generacion!)}
                          >
                            Copiar
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inv.dte_numero_control ? shortText(inv.dte_numero_control, 14, 10) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-[200px] truncate">
                      {(inv.receptor_fiscal_data as any)?.nombre_completo || "—"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${Number(inv.total_compra).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(inv.dte_estado)}`}>
                        {inv.dte_estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(inv.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-900 font-medium text-sm"
                        onClick={() => setSelectedInvoice(inv)}
                      >
                        Ver detalle
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalle */}
      {selectedInvoice && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={() => setSelectedInvoice(null)}
          />
          <div className="fixed inset-0 z-[9999] overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex justify-between items-center flex-shrink-0">
                  <div>
                    <h2 className="text-2xl font-bold text-white">Detalle factura al proveedor</h2>
                    <p className="text-gray-200 text-sm mt-1">
                      {selectedInvoice.dte_tipo_documento === "03" ? "Crédito Fiscal (03)" : "Factura Consumidor Final (01)"} · {selectedInvoice.dte_estado}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedInvoice(null)}
                    className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                    type="button"
                    title="Cerrar"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Código de generación</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm text-gray-900 break-all">{selectedInvoice.dte_codigo_generacion || "—"}</div>
                        {selectedInvoice.dte_codigo_generacion && (
                          <button type="button" className="text-xs text-blue-600 hover:text-blue-900" onClick={() => copyToClipboard(selectedInvoice.dte_codigo_generacion!)}>
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Número de control</div>
                      <div className="font-mono text-sm text-gray-900 break-all">{selectedInvoice.dte_numero_control || "—"}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Receptor (proveedor)</div>
                      <div className="text-sm text-gray-900">
                        {(selectedInvoice.receptor_fiscal_data as any)?.nombre_completo || "—"}
                        {(selectedInvoice.receptor_fiscal_data as any)?.email && (
                          <div className="text-gray-500 text-xs mt-1">{(selectedInvoice.receptor_fiscal_data as any).email}</div>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Total</div>
                      <div className="text-sm font-semibold text-gray-900">${Number(selectedInvoice.total_compra).toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Descripción</div>
                      <div className="text-sm text-gray-900">{selectedInvoice.descripcion || "—"}</div>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Estado DTE</div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(selectedInvoice.dte_estado)}`}>
                        {selectedInvoice.dte_estado}
                      </span>
                    </div>
                  </div>

                  {selectedInvoice.dte_fecha_emision && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Fecha / Hora emisión</div>
                      <div className="text-sm text-gray-900">
                        {selectedInvoice.dte_fecha_emision}
                        {selectedInvoice.dte_hora_emision && ` ${selectedInvoice.dte_hora_emision}`}
                      </div>
                    </div>
                  )}

                  {Array.isArray(selectedInvoice.dte_observaciones) && selectedInvoice.dte_observaciones.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                      <div className="text-xs text-yellow-800 font-medium uppercase tracking-wide mb-2">Observaciones</div>
                      <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1">
                        {selectedInvoice.dte_observaciones.map((obs: string, idx: number) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-900">Receptor (datos fiscales)</div>
                      </div>
                      <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-48">{safeJsonStringify(selectedInvoice.receptor_fiscal_data)}</pre>
                    </div>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                        <div className="text-sm font-semibold text-gray-900">DTE (JSON)</div>
                        <button type="button" className="text-xs text-blue-600 hover:text-blue-900" onClick={() => copyToClipboard(safeJsonStringify(selectedInvoice.dte_json))}>
                          Copiar JSON
                        </button>
                      </div>
                      <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-48">{safeJsonStringify(selectedInvoice.dte_json)}</pre>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                  {selectedInvoice.dte_estado === "procesado" && selectedInvoice.dte_codigo_generacion && selectedInvoice.dte_fecha_emision && (
                    <a
                      href={buildQrUrl(
                        selectedInvoice.dte_codigo_generacion,
                        selectedInvoice.dte_fecha_emision,
                        (selectedInvoice.dte_json as any)?.identificacion?.ambiente ?? "00"
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                    >
                      Consulta pública (Hacienda)
                    </a>
                  )}
                  <button type="button" onClick={() => setSelectedInvoice(null)} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
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
