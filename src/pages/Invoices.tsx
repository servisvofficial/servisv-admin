import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CreateCreditNoteModal } from "../components/CreateCreditNoteModal";
import { CreateDebitNoteModal } from "../components/CreateDebitNoteModal";
import { CreateInvalidationModal } from "../components/CreateInvalidationModal";
import { useProviderInvoices, type ProviderInvoice } from "../hooks/useProviderInvoices";

interface BillingInvoice {
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

type UnifiedRow =
  | { tipo: "cliente"; raw: BillingInvoice }
  | { tipo: "proveedor"; raw: ProviderInvoice };

function buildQrUrl(codigo: string, fechaEmi: string, ambiente: string): string {
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambiente}&codGen=${codigo}&fechaEmi=${fechaEmi}`;
}

function safeJsonStringify(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getStatusBadge(estado: string | null): string {
  if (!estado) return "bg-gray-100 text-gray-800";
  const styles: Record<string, string> = {
    procesado: "bg-green-100 text-green-800",
    pendiente: "bg-yellow-100 text-yellow-800",
    rechazado: "bg-red-100 text-red-800",
    contingencia: "bg-orange-100 text-orange-800",
  };
  return styles[estado] || "bg-gray-100 text-gray-800";
}

function getTipoDteLabel(tipo: string): string {
  return tipo === "03" ? "CCF (03)" : tipo === "14" ? "FSE (14)" : tipo === "01" ? "Factura (01)" : `DTE (${tipo})`;
}

export default function Invoices() {
  const { invoices: providerInvoices, loading: loadingProvider, error: errorProvider, fetchInvoices: fetchProviderInvoices } = useProviderInvoices();
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(true);
  const [billingError, setBillingError] = useState<string | null>(null);

  const [selectedClientInvoice, setSelectedClientInvoice] = useState<BillingInvoice | null>(null);
  const [selectedDetailRow, setSelectedDetailRow] = useState<UnifiedRow | null>(null);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [showDebitNoteModal, setShowDebitNoteModal] = useState(false);
  const [showInvalidationModal, setShowInvalidationModal] = useState(false);
  const [selectedRowForInvalidation, setSelectedRowForInvalidation] = useState<UnifiedRow | null>(null);
  const [contingencyLoadingId, setContingencyLoadingId] = useState<string | null>(null);
  const [duplicateLoadingId, setDuplicateLoadingId] = useState<string | null>(null);

  const fetchBillingInvoices = async () => {
    try {
      setLoadingBilling(true);
      setBillingError(null);
      const { data, error: fetchError } = await supabase
        .from("billing")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setBillingInvoices(data || []);
    } catch (err: any) {
      setBillingError(err.message || "Error al cargar facturas a cliente");
    } finally {
      setLoadingBilling(false);
    }
  };

  useEffect(() => {
    fetchBillingInvoices();
  }, []);

  const loading = loadingBilling || loadingProvider;
  const error = billingError || errorProvider;

  const unifiedRows: UnifiedRow[] = [
    ...billingInvoices.map((inv) => ({ tipo: "cliente" as const, raw: inv })),
    ...providerInvoices.map((inv) => ({ tipo: "proveedor" as const, raw: inv })),
  ].sort((a, b) => {
    const dateA = a.tipo === "cliente" ? a.raw.created_at : a.raw.created_at;
    const dateB = b.tipo === "cliente" ? b.raw.created_at : b.raw.created_at;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const refreshAll = () => {
    fetchBillingInvoices();
    fetchProviderInvoices();
  };

  const handleCreateCreditNote = (invoice: BillingInvoice) => {
    setSelectedClientInvoice(invoice);
    setShowCreditNoteModal(true);
  };

  const handleCreateDebitNote = (invoice: BillingInvoice) => {
    setSelectedClientInvoice(invoice);
    setShowDebitNoteModal(true);
  };

  const handleInvalidateInvoice = (row: UnifiedRow) => {
    setSelectedRowForInvalidation(row);
    setShowInvalidationModal(true);
  };

  const handleEmitContingency = async (row: UnifiedRow) => {
    if (row.tipo === "cliente") {
      setContingencyLoadingId(row.raw.id);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ emitirEnContingencia: true, billingId: row.raw.id }),
        });
        const result = await response.json();
        if (!response.ok || result?.success === false) throw new Error(result?.error || result?.message || "Error al emitir DTE en contingencia");
        refreshAll();
      } catch (err: any) {
        setBillingError(err.message || "Error al emitir DTE en contingencia");
      } finally {
        setContingencyLoadingId(null);
      }
    } else {
      setContingencyLoadingId(row.raw.id);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ emitirEnContingencia: true, providerInvoiceId: row.raw.id }),
        });
        const result = await response.json();
        if (!response.ok || result?.success === false) throw new Error(result?.error || result?.message || "Error al emitir contingencia (proveedor)");
        refreshAll();
      } catch (err: any) {
        setBillingError(err.message || "Error al emitir contingencia (proveedor)");
      } finally {
        setContingencyLoadingId(null);
      }
    }
  };

  const handleDuplicateForContingency = async (row: UnifiedRow) => {
    if (row.tipo === "cliente") {
      setDuplicateLoadingId(row.raw.id);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ duplicarParaContingencia: true, billingId: row.raw.id }),
        });
        const result = await response.json();
        if (!response.ok || result?.success === false) throw new Error(result?.error || "Error al duplicar factura para contingencia");
        refreshAll();
      } catch (err: any) {
        setBillingError(err.message || "Error al duplicar factura para contingencia");
      } finally {
        setDuplicateLoadingId(null);
      }
    } else {
      setDuplicateLoadingId(row.raw.id);
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-invoice`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
          body: JSON.stringify({ duplicarParaContingencia: true, providerInvoiceId: row.raw.id }),
        });
        const result = await response.json();
        if (!response.ok || result?.success === false) throw new Error(result?.error || "Error al duplicar contingencia (proveedor)");
        refreshAll();
      } catch (err: any) {
        setBillingError(err.message || "Error al duplicar contingencia (proveedor)");
      } finally {
        setDuplicateLoadingId(null);
      }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("No se pudo copiar:", e);
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
        <h1 className="text-3xl font-bold text-gray-900">Facturas</h1>
        <p className="text-gray-600 mt-2">
          Facturas a clientes y a proveedores. Gestiona DTE, contingencia, invalidación y notas de crédito/débito.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"># Factura / Nº Control</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo DTE</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cliente / Receptor</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Monto Total</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Código Generación</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {unifiedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    No hay facturas registradas
                  </td>
                </tr>
              ) : (
                unifiedRows.map((row) => {
                  const isClient = row.tipo === "cliente";
                  const inv = row.raw;
                  const dteTipo = isClient ? (inv as BillingInvoice).dte_tipo_documento : (inv as ProviderInvoice).dte_tipo_documento;
                  const clienteReceptor = isClient ? (inv as BillingInvoice).fiscal_data?.nombre_completo || "N/A" : (inv as ProviderInvoice).receptor_fiscal_data?.nombre_completo || "—";
                  const total = isClient ? (inv as BillingInvoice).total_amount : Number((inv as ProviderInvoice).total_compra);
                  const fecha = isClient ? (inv as BillingInvoice).invoice_date : (inv as ProviderInvoice).created_at;
                  const codigo = inv.dte_codigo_generacion;
                  const sello = inv.dte_sello_recepcion;
                  const canInvalidate = codigo && sello;
                  const hasCodigo = Boolean(codigo);
                  const loadingContingency = contingencyLoadingId === inv.id;
                  const loadingDuplicate = duplicateLoadingId === inv.id;

                  return (
                    <tr key={isClient ? inv.id : `prov-${inv.id}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-[180px] truncate">
                        {isClient ? (inv as BillingInvoice).invoice_number : (inv as ProviderInvoice).dte_numero_control || (inv as ProviderInvoice).id.slice(0, 12)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isClient ? "bg-sky-100 text-sky-800" : "bg-violet-100 text-violet-800"}`}>
                          {isClient ? "Cliente" : "Proveedor"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {getTipoDteLabel(dteTipo)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">{clienteReceptor}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${total.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {format(new Date(fecha), isClient ? "dd/MM/yyyy" : "dd/MM/yyyy HH:mm", { locale: es })}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 font-mono text-xs">
                        {codigo ? `${codigo.substring(0, 8)}...` : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-2">
                          {isClient && dteTipo === "03" && (
                            <>
                              <button
                                onClick={() => handleCreateCreditNote(inv as BillingInvoice)}
                                className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                                title="Crear Nota de Crédito"
                              >
                                NC
                              </button>
                              <button
                                onClick={() => handleCreateDebitNote(inv as BillingInvoice)}
                                className="px-3 py-1 bg-purple-500 text-white text-xs rounded hover:bg-purple-600"
                                title="Crear Nota de Débito"
                              >
                                ND
                              </button>
                            </>
                          )}
                          {canInvalidate && (
                            <button
                              onClick={() => handleInvalidateInvoice(row)}
                              className="px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                              title="Invalidar Documento"
                            >
                              Invalidar
                            </button>
                          )}
                          <button
                            onClick={() => handleEmitContingency(row)}
                            className="px-3 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 disabled:opacity-50"
                            title={hasCodigo ? "Ya tiene DTE generado" : "Emitir DTE en contingencia"}
                            disabled={loadingContingency || hasCodigo}
                          >
                            {loadingContingency ? "Emitiendo..." : "Emitir Contingencia"}
                          </button>
                          <button
                            onClick={() => handleDuplicateForContingency(row)}
                            className="px-3 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 disabled:opacity-50"
                            title="Duplicar para contingencia"
                            disabled={loadingDuplicate}
                          >
                            {loadingDuplicate ? "Duplicando..." : "Duplicar Contingencia"}
                          </button>
                          <button
                            onClick={() => setSelectedDetailRow(row)}
                            className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-700"
                            title="Ver detalles"
                          >
                            Ver detalles
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Ver detalles - Unificado (cliente y proveedor, misma estructura) */}
      {selectedDetailRow && (() => {
        const isClient = selectedDetailRow.tipo === "cliente";
        const raw = selectedDetailRow.raw;
        const codigoGeneracion = raw.dte_codigo_generacion;
        const numeroControl = isClient ? (raw as BillingInvoice).dte_numero_control : (raw as ProviderInvoice).dte_numero_control;
        const receptorNombre = isClient ? (raw as BillingInvoice).fiscal_data?.nombre_completo : (raw as ProviderInvoice).receptor_fiscal_data?.nombre_completo;
        const receptorEmail = isClient ? (raw as BillingInvoice).fiscal_data?.email : (raw as ProviderInvoice).receptor_fiscal_data?.email;
        const total = isClient ? (raw as BillingInvoice).total_amount : Number((raw as ProviderInvoice).total_compra);
        const descripcion = isClient ? null : (raw as ProviderInvoice).descripcion;
        const estado = raw.dte_estado ?? null;
        const fechaEmision = isClient ? (raw as BillingInvoice).invoice_date : (raw as ProviderInvoice).dte_fecha_emision;
        const horaEmision = isClient ? null : (raw as ProviderInvoice).dte_hora_emision;
        const receptorFiscalData = isClient ? (raw as BillingInvoice).fiscal_data : (raw as ProviderInvoice).receptor_fiscal_data;
        const dteJson = raw.dte_json;
        const observaciones = isClient ? null : (raw as ProviderInvoice).dte_observaciones;
        const ambiente = (dteJson as any)?.identificacion?.ambiente ?? "00";
        const fechaParaUrl = isClient ? format(new Date((raw as BillingInvoice).invoice_date), "yyyy-MM-dd") : (raw as ProviderInvoice).dte_fecha_emision;
        const showConsultaPublica = estado === "procesado" && codigoGeneracion && fechaParaUrl;

        return (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]" onClick={() => setSelectedDetailRow(null)} />
            <div className="fixed inset-0 z-[9999] overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                  <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 flex justify-between items-center flex-shrink-0">
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Detalle factura {isClient ? "a cliente" : "al proveedor"}
                      </h2>
                      <p className="text-gray-200 text-sm mt-1">
                        {getTipoDteLabel(raw.dte_tipo_documento)} · {estado ?? "—"}
                      </p>
                    </div>
                    <button type="button" onClick={() => setSelectedDetailRow(null)} className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                  <div className="p-6 overflow-y-auto flex-1 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Código de generación</div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-sm text-gray-900 break-all">{codigoGeneracion || "—"}</div>
                          {codigoGeneracion && (
                            <button type="button" className="text-xs text-blue-600 hover:text-blue-900" onClick={() => copyToClipboard(codigoGeneracion)}>Copiar</button>
                          )}
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Número de control</div>
                        <div className="font-mono text-sm text-gray-900 break-all">{numeroControl || "—"}</div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Receptor {isClient ? "(cliente)" : "(proveedor)"}</div>
                        <div className="text-sm text-gray-900">
                          {receptorNombre || "—"}
                          {receptorEmail && <div className="text-gray-500 text-xs mt-1">{receptorEmail}</div>}
                        </div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Total</div>
                        <div className="text-sm font-semibold text-gray-900">${total.toFixed(2)}</div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Descripción</div>
                        <div className="text-sm text-gray-900">{descripcion ?? "—"}</div>
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Estado DTE</div>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(estado)}`}>{estado ?? "—"}</span>
                      </div>
                    </div>
                    {(fechaEmision || horaEmision) && (
                      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Fecha / Hora emisión</div>
                        <div className="text-sm text-gray-900">
                          {fechaEmision ? format(new Date(fechaEmision), "dd/MM/yyyy", { locale: es }) : "—"}
                          {horaEmision ? ` ${horaEmision}` : ""}
                        </div>
                      </div>
                    )}
                    {Array.isArray(observaciones) && observaciones.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                        <div className="text-xs text-yellow-800 font-medium uppercase tracking-wide mb-2">Observaciones</div>
                        <ul className="list-disc pl-5 text-sm text-yellow-900 space-y-1">
                          {observaciones.map((obs: string, idx: number) => (
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
                        <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-48">{safeJsonStringify(receptorFiscalData)}</pre>
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                          <div className="text-sm font-semibold text-gray-900">DTE (JSON)</div>
                          <button type="button" className="text-xs text-blue-600 hover:text-blue-900" onClick={() => copyToClipboard(safeJsonStringify(dteJson))}>Copiar JSON</button>
                        </div>
                        <pre className="p-4 text-xs text-gray-800 overflow-auto max-h-48">{safeJsonStringify(dteJson)}</pre>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
                    {showConsultaPublica && (
                      <a
                        href={buildQrUrl(codigoGeneracion!, fechaParaUrl, ambiente)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-md bg-green-600 text-white text-sm hover:bg-green-700"
                      >
                        Consulta pública (Hacienda)
                      </a>
                    )}
                    <button type="button" onClick={() => setSelectedDetailRow(null)} className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">Cerrar</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {showCreditNoteModal && selectedClientInvoice && (
        <CreateCreditNoteModal
          invoice={selectedClientInvoice}
          onClose={() => { setShowCreditNoteModal(false); setSelectedClientInvoice(null); }}
          onSuccess={() => { setShowCreditNoteModal(false); setSelectedClientInvoice(null); refreshAll(); }}
        />
      )}
      {showDebitNoteModal && selectedClientInvoice && (
        <CreateDebitNoteModal
          invoice={selectedClientInvoice}
          onClose={() => { setShowDebitNoteModal(false); setSelectedClientInvoice(null); }}
          onSuccess={() => { setShowDebitNoteModal(false); setSelectedClientInvoice(null); refreshAll(); }}
        />
      )}
      {showInvalidationModal && selectedRowForInvalidation && (
        <CreateInvalidationModal
          invoice={
            selectedRowForInvalidation.tipo === "cliente"
              ? (selectedRowForInvalidation.raw as BillingInvoice)
              : (() => {
                  const p = selectedRowForInvalidation.raw as ProviderInvoice;
                  return {
                    id: p.id,
                    invoice_number: p.dte_numero_control || p.id.slice(0, 12),
                    invoice_date: p.dte_fecha_emision || p.created_at,
                    total_amount: p.total_compra,
                    fiscal_data: p.receptor_fiscal_data,
                    dte_codigo_generacion: p.dte_codigo_generacion,
                    dte_numero_control: p.dte_numero_control,
                    dte_sello_recepcion: p.dte_sello_recepcion,
                    dte_tipo_documento: p.dte_tipo_documento,
                  };
                })()
          }
          invoiceType={selectedRowForInvalidation.tipo === "proveedor" ? "provider" : "billing"}
          onClose={() => { setShowInvalidationModal(false); setSelectedRowForInvalidation(null); }}
          onSuccess={() => { setShowInvalidationModal(false); setSelectedRowForInvalidation(null); refreshAll(); }}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">Total Facturas</div>
          <div className="text-2xl font-bold text-gray-900">{unifiedRows.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">A clientes</div>
          <div className="text-2xl font-bold text-sky-600">{billingInvoices.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm text-gray-600">A proveedores</div>
          <div className="text-2xl font-bold text-violet-600">{providerInvoices.length}</div>
        </div>
      </div>
    </div>
  );
}
