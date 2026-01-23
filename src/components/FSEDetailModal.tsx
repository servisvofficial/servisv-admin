import { format } from "date-fns";
import { es } from "date-fns/locale";

interface FSEDetailModalProps {
  fse: any;
  onClose: () => void;
}

export function FSEDetailModal({ fse, onClose }: FSEDetailModalProps) {
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copiado al portapapeles");
    } catch (e) {
      console.error("No se pudo copiar:", e);
    }
  };

  const safeJsonStringify = (value: any) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">Detalle FSE</h2>
                <p className="text-emerald-100 text-sm mt-1">
                  Factura de Sujeto Excluido · Tipo 14 · {fse.dte_estado}
                </p>
              </div>
              <button
                onClick={onClose}
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
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">
                    Código de Generación
                  </div>
                  <div className="font-mono text-sm text-gray-900 break-all">
                    {fse.dte_codigo_generacion || "Pendiente"}
                  </div>
                  {fse.dte_codigo_generacion && (
                    <button
                      onClick={() => copyToClipboard(fse.dte_codigo_generacion)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 mt-2"
                    >
                      Copiar
                    </button>
                  )}
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">
                    Número de Control
                  </div>
                  <div className="font-mono text-sm text-gray-900 break-all">
                    {fse.dte_numero_control || "Pendiente"}
                  </div>
                  {fse.dte_numero_control && (
                    <button
                      onClick={() => copyToClipboard(fse.dte_numero_control)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 mt-2"
                    >
                      Copiar
                    </button>
                  )}
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Fecha de Emisión
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {fse.dte_fecha_emision || format(new Date(fse.created_at), "dd/MM/yyyy", { locale: es })}
                    {fse.dte_hora_emision && ` · ${fse.dte_hora_emision}`}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Total Compra
                  </div>
                  <div className="text-2xl font-bold text-emerald-600">
                    ${Number(fse.total_compra || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                    Retención Renta
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ${Number(fse.rete_renta || 0).toFixed(2)}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                    IVA Retenido
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ${Number(fse.iva_rete1 || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {fse.dte_sello_recepcion && (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                  <div className="text-xs text-green-700 font-medium uppercase tracking-wide mb-2">
                    Sello de Recepción MH
                  </div>
                  <div className="font-mono text-sm text-gray-900 break-all">
                    {fse.dte_sello_recepcion}
                  </div>
                  <button
                    onClick={() => copyToClipboard(fse.dte_sello_recepcion)}
                    className="text-xs text-green-600 hover:text-green-700 mt-2"
                  >
                    Copiar sello
                  </button>
                </div>
              )}

              {fse.sujeto_excluido && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="text-xs text-blue-700 font-medium uppercase tracking-wide mb-3">
                    Información del Sujeto Excluido (Proveedor)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Nombre:</span>
                      <div className="font-medium text-gray-900">{fse.sujeto_excluido.nombre || "N/D"}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Documento:</span>
                      <div className="font-medium text-gray-900">
                        {fse.sujeto_excluido.tipoDocumento} - {fse.sujeto_excluido.numDocumento || "N/D"}
                      </div>
                    </div>
                    {fse.sujeto_excluido.telefono && (
                      <div>
                        <span className="text-gray-600">Teléfono:</span>
                        <div className="font-medium text-gray-900">{fse.sujeto_excluido.telefono}</div>
                      </div>
                    )}
                    {fse.sujeto_excluido.correo && (
                      <div>
                        <span className="text-gray-600">Correo:</span>
                        <div className="font-medium text-gray-900">{fse.sujeto_excluido.correo}</div>
                      </div>
                    )}
                    {fse.sujeto_excluido.direccion && (
                      <div className="md:col-span-2">
                        <span className="text-gray-600">Dirección:</span>
                        <div className="font-medium text-gray-900">
                          {fse.sujeto_excluido.direccion.complemento}
                          {" · "}
                          Depto: {fse.sujeto_excluido.direccion.departamento}
                          {" · "}
                          Municipio: {fse.sujeto_excluido.direccion.municipio}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {fse.observaciones && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Observaciones
                  </div>
                  <div className="text-sm text-gray-900 whitespace-pre-wrap">{fse.observaciones}</div>
                </div>
              )}

              {fse.dte_observaciones && fse.dte_observaciones.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="text-xs text-yellow-700 font-medium uppercase tracking-wide mb-2">
                    Observaciones del Ministerio de Hacienda
                  </div>
                  <ul className="list-disc list-inside text-sm text-gray-900 space-y-1">
                    {fse.dte_observaciones.map((obs: string, idx: number) => (
                      <li key={idx}>{obs}</li>
                    ))}
                  </ul>
                </div>
              )}

              {fse.qr_url && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">
                    Consulta Pública
                  </div>
                  <a
                    href={fse.qr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-emerald-600 hover:text-emerald-700 text-sm underline"
                  >
                    Ver en portal del Ministerio de Hacienda
                  </a>
                </div>
              )}

              {fse.dte_json && (
                <details className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <summary className="text-xs text-gray-500 font-medium uppercase tracking-wide cursor-pointer">
                    DTE JSON Completo
                  </summary>
                  <pre className="mt-3 text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto">
                    {safeJsonStringify(fse.dte_json)}
                  </pre>
                </details>
              )}

              {fse.dte_response && (
                <details className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <summary className="text-xs text-gray-500 font-medium uppercase tracking-wide cursor-pointer">
                    Respuesta del Ministerio de Hacienda
                  </summary>
                  <pre className="mt-3 text-xs bg-gray-900 text-blue-400 p-4 rounded-lg overflow-x-auto">
                    {safeJsonStringify(fse.dte_response)}
                  </pre>
                </details>
              )}
            </div>

            <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 flex-shrink-0 border-t">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
