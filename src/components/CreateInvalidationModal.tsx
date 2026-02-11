import { useState } from "react";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  fiscal_data: any;
  dte_codigo_generacion: string | null;
  dte_numero_control: string | null;
  dte_sello_recepcion: string | null;
  dte_tipo_documento: string;
}

interface Props {
  invoice: Invoice;
  /** "billing" = factura a cliente; "provider" = factura a proveedor */
  invoiceType?: "billing" | "provider";
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS_INVALIDACION = [
  { value: 1, label: "Anular y Reemplazar" },
  { value: 2, label: "Anular sin Reemplazar" },
  { value: 3, label: "Otro Motivo" },
];

const MOTIVOS_COMUNES = [
  "Documento emitido por error",
  "Datos incorrectos del cliente",
  "Monto incorrecto",
  "Duplicado",
  "Cancelación de servicio",
  "Otro",
];

export function CreateInvalidationModal({ invoice, invoiceType = "billing", onClose, onSuccess }: Props) {
  const [tipoAnulacion, setTipoAnulacion] = useState<number>(2);
  const [motivo, setMotivo] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [responsable, setResponsable] = useState({
    nombre: "",
    tipoDoc: "13",
    numDoc: "",
  });
  const [solicitante, setSolicitante] = useState({
    nombre: "",
    tipoDoc: "13",
    numDoc: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!motivo && !motivoCustom) {
      setError("Debes especificar un motivo");
      return;
    }

    if (!responsable.nombre || !responsable.numDoc) {
      setError("Debes completar los datos del responsable");
      return;
    }

    if (!solicitante.nombre || !solicitante.numDoc) {
      setError("Debes completar los datos del solicitante");
      return;
    }

    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-dte-events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-region": "us-east-1",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "invalidacion",
            ...(invoiceType === "provider"
              ? { provider_invoice_id: invoice.id }
              : { billing_id: invoice.id }),
            motivo: motivoCustom || motivo,
            tipo_anulacion: tipoAnulacion,
            responsable,
            solicitante,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al crear evento de invalidación");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear evento de invalidación");
      console.error("Error:", err);
    } finally {
      setLoading(false);
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Invalidar Documento Tributario
                </h2>
                <p className="text-red-100 text-sm mt-1">Evento de Invalidación - MH</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                type="button"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Info factura */}
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5 mb-6">
                <h3 className="font-bold text-red-900 mb-3">
                  Documento a Invalidar
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-red-600 font-medium uppercase mb-1">
                      Factura
                    </div>
                    <div className="font-semibold text-gray-900">
                      {invoice.invoice_number}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-red-600 font-medium uppercase mb-1">
                      Cliente
                    </div>
                    <div className="font-semibold text-gray-900 truncate">
                      {invoice.fiscal_data?.nombre_completo}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-red-600 font-medium uppercase mb-1">
                      Código DTE
                    </div>
                    <div className="font-mono text-xs text-gray-900 truncate">
                      {invoice.dte_codigo_generacion ?? "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-red-600 font-medium uppercase mb-1">
                      Total
                    </div>
                    <div className="font-bold text-red-700">
                      ${invoice.total_amount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Tipo de anulación */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Anulación *
                  </label>
                  <select
                    value={tipoAnulacion}
                    onChange={(e) => setTipoAnulacion(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                    required
                  >
                    {TIPOS_INVALIDACION.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Motivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Motivo *
                  </label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="">Selecciona un motivo</option>
                    {MOTIVOS_COMUNES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  {motivo === "Otro" && (
                    <input
                      type="text"
                      value={motivoCustom}
                      onChange={(e) => setMotivoCustom(e.target.value)}
                      placeholder="Especifica el motivo"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 mt-2"
                      required
                    />
                  )}
                </div>

                {/* Responsable */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Responsable de la Invalidación
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={responsable.nombre}
                        onChange={(e) =>
                          setResponsable({ ...responsable, nombre: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Doc
                      </label>
                      <select
                        value={responsable.tipoDoc}
                        onChange={(e) =>
                          setResponsable({ ...responsable, tipoDoc: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="13">DUI</option>
                        <option value="36">NIT</option>
                        <option value="03">Pasaporte</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Documento *
                      </label>
                      <input
                        type="text"
                        value={responsable.numDoc}
                        onChange={(e) =>
                          setResponsable({ ...responsable, numDoc: e.target.value })
                        }
                        placeholder="Ej: 039153636"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Solicitante */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Solicitante de la Invalidación
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={solicitante.nombre}
                        onChange={(e) =>
                          setSolicitante({ ...solicitante, nombre: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Doc
                      </label>
                      <select
                        value={solicitante.tipoDoc}
                        onChange={(e) =>
                          setSolicitante({ ...solicitante, tipoDoc: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="13">DUI</option>
                        <option value="36">NIT</option>
                        <option value="03">Pasaporte</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Documento *
                      </label>
                      <input
                        type="text"
                        value={solicitante.numDoc}
                        onChange={(e) =>
                          setSolicitante({ ...solicitante, numDoc: e.target.value })
                        }
                        placeholder="Ej: 039153636"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Advertencia:</strong> Este evento se transmitirá
                    inmediatamente al Ministerio de Hacienda. La invalidación
                    no se puede revertir.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Procesando..." : "Invalidar Documento"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
