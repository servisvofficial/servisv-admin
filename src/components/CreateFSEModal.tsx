import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  fiscal_data: any;
  dte_codigo_generacion?: string | null;
  dte_tipo_documento?: string | null;
  dte_estado?: string | null;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateFSEModal({ invoice, onClose, onSuccess }: Props) {
  const [observaciones, setObservaciones] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-credit-debit-note`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-region": "us-east-1",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          type: "factura_sujeto_excluido",
          billing_id: invoice.id,
          observaciones: observaciones || null,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al generar FSE");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al generar FSE");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={onClose} />
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">Generar FSE</h2>
                <p className="text-emerald-100 text-sm mt-1">
                  Factura de Sujeto Excluido · Tipo 14
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2 transition"
                type="button"
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

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">Factura</div>
                    <div className="text-sm font-semibold text-gray-900">{invoice.invoice_number}</div>
                  </div>
                  <div>
                    <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">Fecha</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {format(new Date(invoice.invoice_date), "dd/MM/yyyy", { locale: es })}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-emerald-700 font-medium uppercase tracking-wide mb-1">Sujeto Excluido</div>
                    <div className="text-sm font-semibold text-gray-900 truncate">
                      {invoice.fiscal_data?.nombre_completo || "N/A"}
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
                    Observaciones (opcional)
                  </label>
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={3}
                    maxLength={3000}
                    placeholder="Observaciones para el resumen FSE (opcional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Máximo 3000 caracteres</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>Importante:</strong> La FSE (tipo 14) se transmitirá a Hacienda al generarla.
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
                    className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading}
                  >
                    {loading ? "Generando..." : "Generar FSE"}
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

