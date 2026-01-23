import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  fiscal_data: any;
  dte_codigo_generacion: string;
  dte_tipo_documento: string;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

const MOTIVOS_NOTA_CREDITO = [
  { value: "anulacion_total", label: "Anulación Total" },
  { value: "anulacion_parcial", label: "Anulación Parcial" },
  { value: "error_precio", label: "Error en Precio" },
  { value: "error_cantidad", label: "Error en Cantidad" },
  { value: "descuento_posterior", label: "Descuento Posterior" },
  { value: "devolucion", label: "Devolución de Mercancía" },
  { value: "otro", label: "Otro Motivo" },
];

export function CreateCreditNoteModal({ invoice, onClose, onSuccess }: Props) {
  const [motivo, setMotivo] = useState("");
  const [motivoTexto, setMotivoTexto] = useState("");
  const [montoAfectado, setMontoAfectado] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    if (monto > invoice.total_amount) {
      setError(`El monto no puede ser mayor al total de la factura ($${invoice.total_amount.toFixed(2)})`);
      return;
    }

    try {
      setLoading(true);

      // Llamar a Edge Function para generar y transmitir la Nota de Crédito
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-credit-debit-note`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "nota_credito",
            billing_id: invoice.id,
            motivo: motivoTexto || motivo,
            monto_afectado: monto,
            observaciones: observaciones || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al crear nota de crédito");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear nota de crédito");
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
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Crear Nota de Crédito
                </h2>
                <p className="text-blue-100 text-sm mt-1">Tipo 05 - Ajuste de factura</p>
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
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border-2 border-blue-200 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="font-bold text-blue-900">
                Factura Original
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Número</div>
                <div className="text-sm font-semibold text-gray-900">{invoice.invoice_number}</div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Fecha</div>
                <div className="text-sm font-semibold text-gray-900">
                  {format(new Date(invoice.invoice_date), "dd/MM/yyyy", {
                    locale: es,
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Cliente</div>
                <div className="text-sm font-semibold text-gray-900 truncate">
                  {invoice.fiscal_data?.nombre_completo}
                </div>
              </div>
              <div>
                <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Monto Total</div>
                <div className="text-lg font-bold text-blue-700">
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Motivo de la Nota de Crédito *
              </label>
              <select
                value={motivo}
                onChange={(e) => {
                  const selected = MOTIVOS_NOTA_CREDITO.find(
                    (m) => m.value === e.target.value
                  );
                  setMotivo(e.target.value);
                  setMotivoTexto(selected?.label || "");
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Selecciona un motivo</option>
                {MOTIVOS_NOTA_CREDITO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Monto a Afectar *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={invoice.total_amount}
                value={montoAfectado}
                onChange={(e) => setMontoAfectado(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo: ${invoice.total_amount.toFixed(2)}
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Máximo 3000 caracteres
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>⚠️ Importante:</strong> Una vez creada la nota de
                crédito, se transmitirá automáticamente a Hacienda. Este
                proceso no se puede revertir.
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
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                {loading ? "Creando..." : "Crear Nota de Crédito"}
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
