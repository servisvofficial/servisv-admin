import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CreateFSEModal } from "../components/CreateFSEModal";
import { FSEDetailModal } from "../components/FSEDetailModal";

export default function FSE() {
  const [showFseModal, setShowFseModal] = useState(false);
  const [fseInvoices, setFseInvoices] = useState<any[]>([]);
  const [loadingFse, setLoadingFse] = useState(true);
  const [selectedFseForDetail, setSelectedFseForDetail] = useState<any | null>(null);

  const fetchFseInvoices = async () => {
    setLoadingFse(true);
    const { data, error } = await supabase
      .from("fse_invoices")
      .select(
        `
        *,
        billing(
          id,
          total_amount,
          seller_amount,
          quote_id,
          description
        )
      `
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Error cargando FSE:", error);
    } else if (data) {
      setFseInvoices(data);
    }
    setLoadingFse(false);
  };

  useEffect(() => {
    fetchFseInvoices();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">FSE (Factura de Sujeto Excluido)</h1>
        <p className="mt-1 text-sm text-slate-600">
          Genera y consulta Facturas de Sujeto Excluido (tipo 14) cuando ServiSV contrata un servicio externo.
        </p>
      </div>

      <section className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-xl">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <span className="text-xl font-bold">14</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Generar FSE (14) – Cuando ServiSV contrata un servicio externo
              </h3>
              <p className="text-sm text-slate-600">
                La FSE no va asociada a un billing. Usa este botón cuando la plataforma (ServiSV) contrate un servicio a un proveedor externo y necesites emitir la Factura de Sujeto Excluido.
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6">
          <button
            type="button"
            onClick={() => setShowFseModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-base font-semibold text-white shadow-md hover:bg-emerald-700 transition-colors"
          >
            <span className="text-lg">14</span>
            Generar FSE (Factura de Sujeto Excluido)
          </button>
        </div>

        <header className="mb-3 mt-8">
          <h4 className="text-lg font-semibold text-slate-900">FSE ya generadas</h4>
        </header>

        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white">
          {loadingFse ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando FSE...</p>
          ) : fseInvoices.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">
              No hay FSE generadas aún
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Código
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Total Compra
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Estado DTE
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Sello MH
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fseInvoices.map((fse: any) => (
                    <tr key={fse.id} className="hover:bg-emerald-50/50">
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs text-slate-700">
                          {fse.dte_codigo_generacion?.substring(0, 8)}...
                        </div>
                        <div className="text-xs text-slate-500">
                          {fse.dte_numero_control || "N/A"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {fse.dte_fecha_emision ||
                          new Date(fse.created_at).toLocaleDateString("es-AR")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">
                          ${Number(fse.total_compra || 0).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                            fse.dte_estado === "procesado"
                              ? "bg-green-100 text-green-800"
                              : fse.dte_estado === "rechazado"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {fse.dte_estado || "pendiente"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {fse.dte_sello_recepcion ? (
                          <span className="font-mono text-xs text-green-700">
                            ✓ {fse.dte_sello_recepcion.substring(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">
                            Sin sello
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedFseForDetail(fse)}
                          className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                        >
                          Ver detalles
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showFseModal && (
        <CreateFSEModal
          invoice={null}
          onClose={() => setShowFseModal(false)}
          onSuccess={() => {
            setShowFseModal(false);
            fetchFseInvoices();
          }}
        />
      )}

      {selectedFseForDetail && (
        <FSEDetailModal
          fse={selectedFseForDetail}
          onClose={() => setSelectedFseForDetail(null)}
        />
      )}
    </div>
  );
}
