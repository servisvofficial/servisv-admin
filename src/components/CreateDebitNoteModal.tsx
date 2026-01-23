import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  total_commissions?: number;
  dte_json?: any;
  fiscal_data: any;
  dte_codigo_generacion: string;
  dte_tipo_documento: string;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

const MOTIVOS_NOTA_DEBITO = [
  { value: "intereses_mora", label: "Intereses por Mora" },
  { value: "gastos_adicionales", label: "Gastos Adicionales" },
  { value: "error_menor_cobro", label: "Error en Cobro (Menor)" },
  { value: "ajuste_precio", label: "Ajuste de Precio" },
  { value: "otro", label: "Otro Motivo" },
];

export function CreateDebitNoteModal({ invoice, onClose, onSuccess }: Props) {
  const [motivo, setMotivo] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [montoAfectado, setMontoAfectado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [numPagoElectronico, setNumPagoElectronico] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dteBase =
    typeof invoice?.dte_json?.resumen?.totalGravada === "number" &&
    Number.isFinite(invoice.dte_json.resumen.totalGravada) &&
    invoice.dte_json.resumen.totalGravada > 0
      ? invoice.dte_json.resumen.totalGravada
      : typeof invoice.total_commissions === "number" &&
          Number.isFinite(invoice.total_commissions) &&
          invoice.total_commissions > 0
        ? invoice.total_commissions
        : invoice.total_amount;

  const dteIva =
    typeof invoice?.dte_json?.resumen?.tributos?.find?.((t: any) => t?.codigo === "20")?.valor ===
      "number" &&
    Number.isFinite(
      invoice.dte_json.resumen.tributos.find((t: any) => t?.codigo === "20")?.valor
    )
      ? invoice.dte_json.resumen.tributos.find((t: any) => t?.codigo === "20")?.valor
      : dteBase * 0.13;

  const facturadoDteTotal =
    typeof invoice?.dte_json?.resumen?.montoTotalOperacion === "number" &&
    Number.isFinite(invoice.dte_json.resumen.montoTotalOperacion) &&
    invoice.dte_json.resumen.montoTotalOperacion > 0
      ? invoice.dte_json.resumen.montoTotalOperacion
      : dteBase + dteIva;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!motivo) {
      setError("Debes seleccionar un motivo");
      return;
    }

    const monto = parseFloat(montoAfectado);
    if (isNaN(monto) || monto <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }

    try {
      setLoading(true);

      // Llamar a Edge Function para generar y transmitir la Nota de Débito
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-credit-debit-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Forzar ejecución regional (evita bloqueo MH por egress/region)
            "x-region": "us-east-1",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "nota_debito",
            billing_id: invoice.id,
            motivo: motivoTexto || motivo,
            monto_afectado: monto,
            monto_incluye_iva: true,
            observaciones: observaciones || null,
            num_pago_electronico: numPagoElectronico || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al crear nota de débito");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear nota de débito");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Crear Nota de Débito
                </h2>
                <p className="text-purple-100 text-sm mt-1">Tipo 06 - Cargo adicional</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                type="button"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">

              {/* Información de la factura */}
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 border-2 border-purple-200 rounded-xl p-5 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <h3 className="font-bold text-purple-900">
                    Factura Original
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Número</div>
                    <div className="text-sm font-semibold text-gray-900">{invoice.invoice_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Fecha</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {format(new Date(invoice.invoice_date), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Cliente</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {invoice.fiscal_data?.nombre_completo}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Total servicio</div>
                    <div className="text-lg font-bold text-purple-700">
                      ${invoice.total_amount.toFixed(2)}
                    </div>
                    <div className="text-xs text-purple-700/80 mt-1">
                      Facturado (DTE): ${facturadoDteTotal.toFixed(2)}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la Nota de Débito *
              </label>
              <select
                value={motivo}
                onChange={(e) => {
                  const selected = MOTIVOS_NOTA_DEBITO.find(
                    (m) => m.value === e.target.value
                  );
                  setMotivo(e.target.value);
                  setMotivoTexto(selected?.label || "");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Selecciona un motivo</option>
                {MOTIVOS_NOTA_DEBITO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto Adicional a Cobrar (con IVA) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={montoAfectado}
                onChange={(e) => setMontoAfectado(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Monto que se cobrará adicionalmente
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Este monto incluye IVA.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número de Pago Electrónico
              </label>
              <input
                type="text"
                value={numPagoElectronico}
                onChange={(e) => setNumPagoElectronico(e.target.value)}
                maxLength={100}
                placeholder="Ej: REF-123456 (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Referencia del pago electrónico (opcional)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observaciones
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={3}
                maxLength={3000}
                placeholder="Observaciones adicionales (opcional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo 3000 caracteres
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Importante:</strong> Una vez creada la nota de
                débito, se transmitirá automáticamente a Hacienda. Este proceso
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
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Creando..." : "Crear Nota de Débito"}
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
