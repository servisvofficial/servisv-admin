import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCreditNoteModal } from "../components/CreateCreditNoteModal";
import { CreateDebitNoteModal } from "../components/CreateDebitNoteModal";
import { CreateInvalidationModal } from "../components/CreateInvalidationModal";

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: string;
  total_amount: number;
  total_commissions?: number;
  dte_tipo_documento: string;
  dte_codigo_generacion: string | null;
  dte_numero_control: string | null;
  dte_sello_recepcion: string | null;
  dte_estado: string | null;
  dte_json?: any;
  fiscal_data: any;
  created_at: string;
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [showInvalidationModal, setShowInvalidationModal] = useState(false);
  const [contingencyLoadingId, setContingencyLoadingId] = useState<string | null>(null);
  const [duplicateLoadingId, setDuplicateLoadingId] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setInvoices(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar facturas");
      console.error("Error en fetchInvoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleCreateCreditNote = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowCreditNoteModal(true);
  };

  const handleCreateDebitNote = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDebitNoteModal(true);
  };

  const handleInvalidateInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowInvalidationModal(true);
  };

  const handleEmitContingency = async (invoice: Invoice) => {
    setError(null);
    setContingencyLoadingId(invoice.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          emitirEnContingencia: true,
          billingId: invoice.id,
        }),
      });

      const result = await response.json();
      console.log("🔍 Respuesta de emitir contingencia:", result);
      
      if (!response.ok || result?.success === false) {
        const errorMsg = result?.error || result?.message || "Error al emitir DTE en contingencia";
        console.error("❌ Error emitir contingencia:", errorMsg);
        throw new Error(errorMsg);
      }

      await fetchInvoices();
    } catch (err: any) {
      console.error("❌ Excepción emitir contingencia:", err);
      setError(err.message || "Error al emitir DTE en contingencia");
    } finally {
      setContingencyLoadingId(null);
    }
  };

  const handleDuplicateForContingency = async (invoice: Invoice) => {
    setError(null);
    setDuplicateLoadingId(invoice.id);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          duplicarParaContingencia: true,
          billingId: invoice.id,
        }),
      });

      const result = await response.json();
      if (!response.ok || result?.success === false) {
        throw new Error(result?.error || "Error al duplicar factura para contingencia");
      }

      await fetchInvoices();
    } catch (err: any) {
      setError(err.message || "Error al duplicar factura para contingencia");
    } finally {
      setDuplicateLoadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-600">Cargando facturas...</div>
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
        <h1 className="text-3xl font-bold text-gray-900">Facturas Emitidas</h1>
        <p className="text-gray-600 mt-2">
          Gestiona las facturas procesadas y genera notas de crédito/débito
        </p>
      </div>

      {/* Tabla de facturas */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  # Factura
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo DTE
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Monto Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código Generación
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    No hay facturas procesadas
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {invoice.invoice_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {invoice.dte_tipo_documento === "03"
                          ? "CCF (03)"
                          : invoice.dte_tipo_documento === "14"
                            ? "FSE (14)"
                            : "Factura (01)"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {invoice.fiscal_data?.nombre_completo || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ${invoice.total_amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {format(new Date(invoice.invoice_date), "dd/MM/yyyy", {
                        locale: es,
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                      {invoice.dte_codigo_generacion
                        ? `${invoice.dte_codigo_generacion.substring(0, 8)}...`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex gap-2">
                        {invoice.dte_tipo_documento === "03" && (
                          <>
                            <button
                              onClick={() => handleCreateCreditNote(invoice)}
                              className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                              title="Crear Nota de Crédito"
                            >
                              NC
                            </button>
                            <button
                              onClick={() => handleCreateDebitNote(invoice)}
                              className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                              title="Crear Nota de Débito"
                            >
                              ND
                            </button>
                          </>
                        )}
                        {invoice.dte_codigo_generacion && invoice.dte_sello_recepcion && (
                          <button
                            onClick={() => handleInvalidateInvoice(invoice)}
                            className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                            title="Invalidar Documento"
                          >
                            Invalidar
                          </button>
                        )}
                        <button
                          onClick={() => handleEmitContingency(invoice)}
                          className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50"
                          title={
                            invoice.dte_codigo_generacion
                              ? "Ya tiene DTE generado/transmitido"
                              : "Emitir DTE en contingencia (sin transmitir)"
                          }
                          disabled={
                            contingencyLoadingId === invoice.id ||
                            Boolean(invoice.dte_codigo_generacion)
                          }
                        >
                          {contingencyLoadingId === invoice.id
                            ? "Emitiendo..."
                            : "Emitir Contingencia"}
                        </button>
                        <button
                          onClick={() => handleDuplicateForContingency(invoice)}
                          className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
                          title="Crear una factura nueva para contingencia (sin pasarela)"
                          disabled={duplicateLoadingId === invoice.id}
                        >
                          {duplicateLoadingId === invoice.id
                            ? "Duplicando..."
                            : "Duplicar Contingencia"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      {showCreditNoteModal && selectedInvoice && (
        <CreateCreditNoteModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowCreditNoteModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setShowCreditNoteModal(false);
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}

      {showDebitNoteModal && selectedInvoice && (
        <CreateDebitNoteModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowDebitNoteModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setShowDebitNoteModal(false);
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}

      {showInvalidationModal && selectedInvoice && (
        <CreateInvalidationModal
          invoice={selectedInvoice}
          onClose={() => {
            setShowInvalidationModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            setShowInvalidationModal(false);
            setSelectedInvoice(null);
            fetchInvoices();
          }}
        />
      )}

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Facturas</div>
          <div className="text-2xl font-bold text-gray-900">
            {invoices.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">CCF Emitidos</div>
          <div className="text-2xl font-bold text-blue-600">
            {invoices.filter((i) => i.dte_tipo_documento === "03").length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Facturas Emitidas</div>
          <div className="text-2xl font-bold text-green-600">
            {invoices.filter((i) => i.dte_tipo_documento === "01").length}
          </div>
        </div>
      </div>
    </div>
  );
}
