import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { CreateFSEModal } from "../components/CreateFSEModal";
import { CreateProviderInvoiceModal } from "../components/CreateProviderInvoiceModal";
import { FSEDetailModal } from "../components/FSEDetailModal";

type RequestRecord = {
  id: string;
  title: string;
  client_name: string;
  service_category: string;
  status: string;
  location: string | null;
  created_at: string;
};

type ProviderPaymentDetails = {
  name: string;
  last_name: string;
  email: string | null;
  cel_phone: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  bank_account_type: string | null;
  /** Datos fiscales del proveedor (para rellenar modal de factura 01/03) */
  tipo_persona?: "natural" | "juridica" | null;
  dui?: string | null;
  nit?: string | null;
  numero_registro_contribuyente?: string | null;
};

type InProgressRequest = {
  id: string;
  title: string;
  client_name: string;
  service_category: string;
  location: string | null;
  created_at: string;
  status: string;
  quote_id: string | null;
  quote_price: number | null;
  billing_id: string | null;
  /** Si ya se generó factura al proveedor (01/03), no se muestra en "Solicitudes con Pago" */
  hasProviderInvoice?: boolean;
  billing_total_amount: number | null;
  billing_is_held: boolean | null;
  billing_created_at: string | null;
  billing_released_at: string | null;
  seller_name: string | null;
  billing_seller_amount: number | null;
  billing_description: string | null;
  // Desglose de pago
  billing_service_amount: number | null;
  billing_platform_commission_buyer: number | null;
  billing_platform_commission_seller: number | null;
  billing_payment_gateway_commission: number | null;
  billing_iva_amount: number | null;
  billing_iva_commission_seller: number | null;
  // Datos del proveedor para liberar pago
  provider_details: ProviderPaymentDetails | null;
};

const statusTexts: Record<string, string> = {
  open: "Abierta",
  quoted: "Cotizada",
  accepted: "Aceptada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const activeStatuses = ["open", "quoted", "accepted", "in_progress"];

function Requests() {
  const [requests, setRequests] = useState<RequestRecord[]>([]);
  const [inProgressRequests, setInProgressRequests] = useState<
    InProgressRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingInProgress, setLoadingInProgress] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFseModal, setShowFseModal] = useState(false);
  const [selectedBillingForFse, setSelectedBillingForFse] = useState<
    any | null
  >(null);
  const [fseInvoices, setFseInvoices] = useState<any[]>([]);
  const [loadingFse, setLoadingFse] = useState(true);
  const [selectedFseForDetail, setSelectedFseForDetail] = useState<any | null>(
    null
  );
  const [showProviderInvoiceModal, setShowProviderInvoiceModal] = useState(false);
  const [selectedBillingForProviderInvoice, setSelectedBillingForProviderInvoice] = useState<any | null>(null);
  const [billingsForFse, setBillingsForFse] = useState<any[]>([]);
  const [loadingBillingsFse, setLoadingBillingsFse] = useState(false);
  const [refreshInProgressKey, setRefreshInProgressKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    const fetchRequests = async () => {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("requests")
        .select(
          "id,title,client_name,service_category,status,location,created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (ignore) return;

      if (error) {
        setError(error.message);
      } else if (data) {
        setRequests(data as RequestRecord[]);
      }

      setLoading(false);
    };

    fetchRequests();

    return () => {
      ignore = true;
    };
  }, []);

  // Cargar solicitudes con pago (billing) para emitir FSE
  useEffect(() => {
    let ignore = false;

    const fetchInProgressRequests = async () => {
      setLoadingInProgress(true);

      // Paso 1: Obtener requests en progreso o completadas
      const { data: requestsData, error: requestsError } = await supabase
        .from("requests")
        .select(
          "id, title, client_name, service_category, location, created_at, status, selected_quote_id"
        )
        .in("status", ["in_progress", "completed"])
        .order("created_at", { ascending: false });

      if (ignore) return;

      if (requestsError) {
        console.error("Error cargando solicitudes:", requestsError);
        setLoadingInProgress(false);
        return;
      }

      if (!requestsData || requestsData.length === 0) {
        setInProgressRequests([]);
        setLoadingInProgress(false);
        return;
      }

      // Filtrar requests que tienen selected_quote_id
      const requestsWithQuote = requestsData.filter(
        req => req.selected_quote_id
      );
      const quoteIds = requestsWithQuote.map(req => req.selected_quote_id);

      if (quoteIds.length === 0) {
        setInProgressRequests([]);
        setLoadingInProgress(false);
        return;
      }

      // Paso 2: Obtener las quotes seleccionadas (provider_id y uid por si el id del proveedor está en uid)
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("id, price, provider_name, provider_id, uid")
        .in("id", quoteIds);

      if (quotesError) {
        console.error("Error cargando quotes:", quotesError);
      }

      // Paso 3: Obtener billing asociado a esas quotes (con desglose de comisiones)
      const { data: billingData, error: billingError } = await supabase
        .from("billing")
        .select(
          `
          id, quote_id, seller_id,
          total_amount, seller_amount, description,
          service_amount, platform_commission_buyer, platform_commission_seller, payment_gateway_commission,
          is_held, created_at, released_at
        `
        )
        .in("quote_id", quoteIds);

      if (billingError) {
        console.error("Error cargando billing:", billingError);
      }

      // Paso 3b: Billings que ya tienen factura al proveedor (para ocultarlos de "Solicitudes con Pago")
      const billingIds = (billingData || []).map((b: any) => b.id);
      let billingIdsWithProviderInvoice = new Set<string>();
      if (billingIds.length > 0) {
        const { data: piData } = await supabase
          .from("provider_invoices")
          .select("billing_id")
          .in("billing_id", billingIds);
        billingIdsWithProviderInvoice = new Set((piData || []).map((p: any) => p.billing_id));
      }

      // Paso 4: Obtener datos del proveedor para liberar pago (tabla users; los datos bancarios NO están en billing)
      // Probar seller_id (billing), provider_id y uid (quotes) por si el id del proveedor está en distinta columna
      const sellerIdsFromBilling = (billingData || [])
        .map((b: any) => b.seller_id)
        .filter(Boolean);
      const providerIdsFromQuotes = (quotesData || []).flatMap((q: any) =>
        [q.provider_id, q.uid].filter(Boolean)
      );
      const allProviderIds = [
        ...new Set([...sellerIdsFromBilling, ...providerIdsFromQuotes]),
      ];
      let providerDetailsMap: Record<string, ProviderPaymentDetails> = {};
      if (allProviderIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select(
            "id, name, last_name, email, cel_phone, bank_account_number, bank_name, bank_account_type, tipo_persona, dui, nit, numero_registro_contribuyente"
          )
          .in("id", allProviderIds);
        if (usersData) {
          providerDetailsMap = usersData.reduce(
            (acc: Record<string, ProviderPaymentDetails>, u: any) => {
              acc[u.id] = {
                name: u.name || "",
                last_name: u.last_name || "",
                email: u.email || null,
                cel_phone: u.cel_phone || null,
                bank_account_number: u.bank_account_number || null,
                bank_name: u.bank_name || null,
                bank_account_type: u.bank_account_type || null,
                tipo_persona: u.tipo_persona || null,
                dui: u.dui || null,
                nit: u.nit || null,
                numero_registro_contribuyente: u.numero_registro_contribuyente || null,
              };
              return acc;
            },
            {}
          );
        }
      }

      // Paso 5: Combinar todos los datos
      const transformed: InProgressRequest[] = requestsWithQuote.map(
        (req: any) => {
          const quote = quotesData?.find(q => q.id === req.selected_quote_id);
          const billing = billingData?.find(
            b => b.quote_id === req.selected_quote_id
          );
          const providerId =
            billing?.seller_id || quote?.provider_id || quote?.uid;
          const providerDetails = providerId
            ? (providerDetailsMap[providerId] ?? null)
            : null;

          return {
            id: req.id,
            title: req.title,
            client_name: req.client_name,
            service_category: req.service_category,
            location: req.location,
            created_at: req.created_at,
            status: req.status,
            quote_id: quote?.id || null,
            quote_price: quote?.price || null,
            billing_id: billing?.id || null,
            hasProviderInvoice: billing?.id ? billingIdsWithProviderInvoice.has(billing.id) : false,
            billing_total_amount: billing?.total_amount || null,
            billing_seller_amount: billing?.seller_amount || null,
            billing_description: billing?.description || null,
            billing_is_held: billing?.is_held ?? null,
            billing_created_at: billing?.created_at || null,
            billing_released_at: billing?.released_at || null,
            seller_name: quote?.provider_name || null,
            billing_service_amount: billing?.service_amount ?? null,
            billing_platform_commission_buyer:
              billing?.platform_commission_buyer ?? null,
            billing_platform_commission_seller:
              billing?.platform_commission_seller ?? null,
            billing_payment_gateway_commission:
              billing?.payment_gateway_commission ?? null,
            billing_iva_amount: (billing as { iva_amount?: number } | null)?.iva_amount ?? null,
            billing_iva_commission_seller: (billing as { iva_commission_seller?: number } | null)?.iva_commission_seller ?? null,
            provider_details: providerDetails || null,
          };
        }
      );

      setInProgressRequests(transformed);
      setLoadingInProgress(false);
    };

    fetchInProgressRequests();

    return () => {
      ignore = true;
    };
  }, [refreshInProgressKey]);

  // Cargar FSE generadas
  useEffect(() => {
    let ignore = false;

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

      if (ignore) return;

      if (error) {
        console.error("Error cargando FSE:", error);
      } else if (data) {
        setFseInvoices(data);
      }

      setLoadingFse(false);
    };

    fetchFseInvoices();

    return () => {
      ignore = true;
    };
  }, []);

  // Cargar billings para la sección "Generar FSE" (apartada de las requests)
  useEffect(() => {
    let ignore = false;

    const fetchBillingsForFse = async () => {
      setLoadingBillingsFse(true);
      const { data, error } = await supabase
        .from("billing")
        .select("id, invoice_number, total_amount, seller_amount, description, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (ignore) return;
      if (error) {
        console.error("Error cargando billings para FSE:", error);
      } else {
        setBillingsForFse(data || []);
      }
      setLoadingBillingsFse(false);
    };

    fetchBillingsForFse();
    return () => { ignore = true; };
  }, []);

  const stats = useMemo(() => {
    const total = requests.length;
    const active = requests.filter(request =>
      activeStatuses.includes(request.status)
    ).length;
    const completed = requests.filter(
      request => request.status === "completed"
    ).length;
    const cancelled = requests.filter(
      request => request.status === "cancelled"
    ).length;

    return [
      {
        label: "Solicitudes activas",
        value: active,
        detail: "Estados open, quoted, accepted o in_progress",
      },
      {
        label: "Completadas",
        value: completed,
        detail: `${
          total > 0 ? ((completed / total) * 100).toFixed(1) : "0"
        }% del total`,
      },
      {
        label: "Canceladas",
        value: cancelled,
        detail: "Impacto en SLA y experiencia",
      },
    ];
  }, [requests]);

  const fseCandidates = useMemo(() => {
    return inProgressRequests.filter(r => !!r.billing_id && !r.hasProviderInvoice);
  }, [inProgressRequests]);

  const operationalTips = useMemo(() => {
    const tips = [];
    const active = stats[0]?.value ?? 0;
    const cancelled = stats[2]?.value ?? 0;
    if (active > 0) {
      tips.push(
        `Hay ${active} solicitudes en curso; conviene monitorear SLA provocados.`
      );
    }
    if (cancelled > 0) {
      tips.push(
        `${cancelled} solicitudes canceladas recientemente. Revisa motivos para mantener la satisfacción.`
      );
    }
    if (tips.length === 0) {
      tips.push("No hay acciones urgentes detectadas en este momento.");
    }
    return tips;
  }, [stats]);

  return (
    <div className="space-y-8 text-slate-900">
      <header>
        <h2 className="text-2xl font-semibold text-slate-900">
          Solicitudes en vivo
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Datos provenientes de la tabla `requests`: estado operativo y desglose
          por cliente.
        </p>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Sección: Solicitudes con billing (Factura 01/03 al proveedor) */}
      <section className="rounded-3xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-xl">
          <header className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
                <span className="text-xl font-bold">!</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Solicitudes con Pago (billing)
                </h3>
                <p className="text-sm text-slate-600">
                  {fseCandidates.length} solicitud
                  {fseCandidates.length !== 1 ? "es" : ""} con billing. Genera
                  Factura (01/03) por la comisión 5% que retiene la app del proveedor.
                </p>
              </div>
            </div>
          </header>

          <div className="space-y-4">
            {loadingInProgress ? (
              <p className="py-4 text-sm text-slate-500">
                Cargando solicitudes en proceso…
              </p>
            ) : fseCandidates.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-white p-5 text-sm text-slate-600">
                No hay solicitudes <strong>completadas/en curso</strong> con{" "}
                <strong>billing</strong> asociado.
                <div className="mt-2 text-xs text-slate-500">
                  El botón FSE aparece sólo cuando existe un billing (pago
                  registrado) para esa solicitud.
                </div>
              </div>
            ) : (
              fseCandidates.map(req => (
                <div
                  key={req.id}
                  className="rounded-2xl border border-amber-200 bg-white p-6 shadow-lg"
                >
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Solicitud
                      </p>
                      <p className="mt-2 font-semibold text-slate-900">
                        {req.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {req.service_category} ·{" "}
                        {req.location || "Ubicación N/D"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Cliente: {req.client_name}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Estado del pago
                      </p>
                      {req.billing_id ? (
                        <>
                          <div className="mt-1 flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                req.billing_is_held
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-green-100 text-green-800"
                              }`}
                            >
                              {req.billing_is_held
                                ? "🔒 Retenido"
                                : "✅ Liberado"}
                            </span>
                          </div>
                          {req.billing_total_amount != null && (
                            <p className="mt-2 text-sm font-semibold text-slate-900">
                              Total pagado: $
                              {Number(req.billing_total_amount).toFixed(2)} USD
                            </p>
                          )}
                          {req.billing_created_at && (
                            <p className="mt-1 text-xs text-slate-500">
                              Pagado:{" "}
                              {new Date(req.billing_created_at).toLocaleString(
                                "es-AR"
                              )}
                            </p>
                          )}
                          {req.billing_released_at && (
                            <p className="mt-1 text-xs text-green-600">
                              Liberado:{" "}
                              {new Date(req.billing_released_at).toLocaleString(
                                "es-AR"
                              )}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-slate-500">
                          Sin billing registrado
                        </p>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Acción Requerida
                      </p>
                      {req.status === "completed" && req.billing_is_held ? (
                        <div className="mt-2 rounded-lg bg-green-100 p-3">
                          <p className="text-sm font-semibold text-green-900">
                            ✅ Servicio Completado
                          </p>
                          <p className="mt-1 text-xs text-green-700">
                            El pago puede ser liberado al proveedor.
                          </p>
                        </div>
                      ) : req.billing_is_held ? (
                        <div className="mt-2 rounded-lg bg-amber-100 p-3">
                          <p className="text-sm font-semibold text-amber-900">
                            ⚠️ Pago Retenido
                          </p>
                          <p className="mt-1 text-xs text-amber-700">
                            El cliente debe marcar el servicio como completado
                            para liberar el pago al proveedor.
                          </p>
                        </div>
                      ) : req.billing_released_at ? (
                        <div className="mt-2 rounded-lg bg-green-100 p-3">
                          <p className="text-sm font-semibold text-green-900">
                            ✅ Pago Liberado
                          </p>
                          <p className="mt-1 text-xs text-green-700">
                            El pago ya fue liberado al proveedor.
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Sin acción requerida
                        </p>
                      )}

                      {req.billing_id && (
                        <div className="mt-3">
                          <button
                            type="button"
                            className="inline-flex items-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                            title="Generar Factura Consumidor Final (01) o Crédito Fiscal (03) al proveedor"
                            onClick={() => {
                              const billingId = req.billing_id;
                              if (!billingId) return;
                              const ivaCommissionSeller =
                                req.billing_iva_commission_seller ??
                                (req.billing_platform_commission_seller != null
                                  ? req.billing_platform_commission_seller * 0.13
                                  : null);
                              setSelectedBillingForProviderInvoice({
                                id: billingId,
                                invoice_number: `BILL-${billingId.slice(0, 8)}`,
                                invoice_date:
                                  req.billing_created_at ||
                                  new Date().toISOString(),
                                total_amount: req.billing_total_amount || 0,
                                seller_amount: req.billing_seller_amount,
                                platform_commission_seller: req.billing_platform_commission_seller ?? null,
                                iva_commission_seller: ivaCommissionSeller,
                                description: req.billing_description,
                                providerData: req.provider_details ? {
                                  nombre_completo: [req.provider_details.name, req.provider_details.last_name].filter(Boolean).join(" ").trim() || undefined,
                                  email: req.provider_details.email ?? undefined,
                                  telefono: req.provider_details.cel_phone ?? undefined,
                                  tipo_persona: req.provider_details.tipo_persona ?? undefined,
                                  dui: req.provider_details.dui ?? undefined,
                                  nit: req.provider_details.nit ?? undefined,
                                  numero_registro_contribuyente: req.provider_details.numero_registro_contribuyente ?? undefined,
                                } : undefined,
                              });
                              setShowProviderInvoiceModal(true);
                            }}
                          >
                            Factura al proveedor (01/03)
                          </button>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Se factura la comisión 5% que retiene la app del proveedor (no lo que se le libera).
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desglose de pago: lado cliente y lado proveedor */}
                  {req.billing_id &&
                    (() => {
                      const serviceAmount =
                        req.billing_service_amount ??
                        req.quote_price ??
                        (req.billing_seller_amount != null
                          ? req.billing_seller_amount / (1 - 0.05 - 0.05 * 0.13)
                          : null);
                      const totalAmount = req.billing_total_amount ?? null;
                      const sellerAmount = req.billing_seller_amount ?? null;
                      const platformBuyer =
                        req.billing_platform_commission_buyer ??
                        (serviceAmount != null ? serviceAmount * 0.1 : null);
                      const platformSeller =
                        req.billing_platform_commission_seller ?? null;
                      const gatewayCommission =
                        req.billing_payment_gateway_commission ?? null;
                      const ivaCommissionSeller =
                        req.billing_iva_commission_seller ??
                        (platformSeller != null ? platformSeller * 0.13 : null);
                      const ivaOnBuyer =
                        req.billing_iva_amount ??
                        ((platformBuyer ?? 0) + (gatewayCommission ?? 0) > 0
                          ? ((platformBuyer ?? 0) + (gatewayCommission ?? 0)) * 0.13
                          : null);
                      // A liberar = servicio - comisión 5% - IVA 13% sobre esa comisión (siempre calcular para mostrar correcto)
                      const amountToRelease =
                        serviceAmount != null && platformSeller != null && ivaCommissionSeller != null
                          ? serviceAmount - platformSeller - ivaCommissionSeller
                          : req.billing_seller_amount;
                      const display = (n: number | null) =>
                        n != null ? Number(n).toFixed(2) : "—";
                      return (
                        <div className="mt-6 border-t border-slate-200 pt-6">
                          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                            Desglose de pago
                          </p>
                          <div className="mt-4 grid gap-6 sm:grid-cols-2">
                            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4">
                              <p className="text-xs font-semibold text-blue-700">
                                Lado cliente
                              </p>
                              <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Monto servicio</span>
                                  <span className="font-medium">${display(serviceAmount)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Comisión plataforma (10%)</span>
                                  <span className="font-medium">${display(platformBuyer)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Comisión pasarela</span>
                                  <span className="font-medium">${display(gatewayCommission)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">IVA (13% sobre comisiones cliente)</span>
                                  <span className="font-medium">${display(ivaOnBuyer)} USD</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-2">
                                  <span className="font-medium text-slate-700">Total pagado por cliente</span>
                                  <span className="font-semibold">${display(totalAmount)} USD</span>
                                </div>
                              </div>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-emerald-50/50 p-4">
                              <p className="text-xs font-semibold text-emerald-800">
                                Lado proveedor
                              </p>
                              <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Monto servicio (referencia)</span>
                                  <span className="font-medium">${display(serviceAmount)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">Comisión 5% (retiene la app)</span>
                                  <span className="font-medium">${display(platformSeller)} USD</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-500">IVA 13% sobre comisión</span>
                                  <span className="font-medium">${display(ivaCommissionSeller)} USD</span>
                                </div>
                                <div className="flex justify-between border-t border-slate-200 pt-2">
                                  <span className="font-medium text-slate-700">A liberar al proveedor</span>
                                  <span className="font-semibold text-emerald-700">${display(amountToRelease)} USD</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Datos del proveedor para liberar pago (solo en tabla users, no en billing) */}
                  {(req.provider_details || req.seller_name) && (
                    <div className="mt-6 border-t border-slate-200 pt-6">
                      <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Datos del proveedor para liberar pago
                      </p>
                      {(!req.provider_details ||
                        (!req.provider_details.bank_account_number &&
                          !req.provider_details.bank_name)) && (
                        <p className="mt-2 text-xs text-amber-700">
                          {req.provider_details
                            ? "El proveedor no ha completado datos bancarios en su perfil. Debe añadirlos en la app (Perfil → Editar perfil) o en la web para poder liberar el pago."
                            : "No se pudo cargar el perfil del proveedor. Comprueba que el admin use VITE_SUPABASE_SERVICE_ROLE_KEY para leer la tabla users, o que el proveedor exista en users con el mismo id que en la quote."}
                        </p>
                      )}
                      <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Nombre</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details
                              ? `${req.provider_details.name} ${req.provider_details.last_name}`.trim() ||
                                "—"
                              : req.seller_name || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Nº cuenta</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details?.bank_account_number || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Banco</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details?.bank_name || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Tipo cuenta</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details?.bank_account_type || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Email</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details?.email || "—"}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500">Teléfono</span>
                          <span className="font-medium text-slate-900">
                            {req.provider_details?.cel_phone || "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
      </section>

      {showProviderInvoiceModal && selectedBillingForProviderInvoice && (
        <CreateProviderInvoiceModal
          invoice={selectedBillingForProviderInvoice}
          onClose={() => {
            setShowProviderInvoiceModal(false);
            setSelectedBillingForProviderInvoice(null);
          }}
          onSuccess={() => {
            setShowProviderInvoiceModal(false);
            setSelectedBillingForProviderInvoice(null);
            setRefreshInProgressKey(k => k + 1);
          }}
        />
      )}
      {showFseModal && selectedBillingForFse && (
        <CreateFSEModal
          invoice={selectedBillingForFse}
          onClose={() => {
            setShowFseModal(false);
            setSelectedBillingForFse(null);
          }}
          onSuccess={async () => {
            setShowFseModal(false);
            setSelectedBillingForFse(null);
            // Recargar FSE después de crear una nueva
            const { data } = await supabase
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
            if (data) setFseInvoices(data);
          }}
        />
      )}

      {selectedFseForDetail && (
        <FSEDetailModal
          fse={selectedFseForDetail}
          onClose={() => setSelectedFseForDetail(null)}
        />
      )}

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(stat => (
          <article
            key={stat.label}
            className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-lg"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {loading ? "—" : stat.value}
            </p>
            <p className="text-xs text-slate-500">{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-lg">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Operaciones activas
            </h3>
            <p className="text-sm text-slate-500">
              Vista directa de cada solicitud (ordenada por `created_at`).
            </p>
          </div>
        </header>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100">
          <div className="grid grid-cols-[1fr,2fr,2fr,1fr,1fr] bg-slate-50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>ID</span>
            <span>Servicio</span>
            <span>Cliente</span>
            <span>Estado</span>
            <span className="text-right">Creada</span>
          </div>
          {loading ? (
            <p className="px-6 py-6 text-sm text-slate-500">
              Cargando solicitudes…
            </p>
          ) : (
            requests.map(request => (
              <div
                key={request.id}
                className="grid grid-cols-[1fr,2fr,2fr,1fr,1fr] items-center px-6 py-4 text-sm text-slate-600 odd:bg-white"
              >
                <span className="font-mono text-slate-500">
                  {request.id.slice(0, 8)}
                </span>
                <div>
                  <p className="font-medium text-slate-900">{request.title}</p>
                  <p className="text-xs text-slate-500">
                    {request.service_category} ·{" "}
                    {request.location ?? "Ubicación N/D"}
                  </p>
                </div>
                <span>{request.client_name}</span>
                <span className="font-semibold uppercase text-emerald-600">
                  {statusTexts[request.status] ?? request.status}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {new Date(request.created_at).toLocaleString("es-AR")}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-white/70 bg-slate-900 p-6 text-white shadow-xl">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">
              Recomendaciones operativas
            </h3>
            <p className="text-sm text-white/70">
              Construidas automáticamente según el estado real de las
              solicitudes.
            </p>
          </div>
        </header>
        <div className="mt-6 space-y-4">
          {operationalTips.map(tip => (
            <article
              key={tip}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/90"
            >
              {tip}
            </article>
          ))}
        </div>
      </section>

      {/* Sección aparte: Generar FSE (14) - Cuando ServiSV contrata un servicio a un proveedor */}
      <section className="rounded-3xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-xl">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">
              <span className="text-xl font-bold">14</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">
                Generar FSE (14) – Cuando ServiSV contrata un servicio a un proveedor
              </h3>
              <p className="text-sm text-slate-600">
                La FSE no va por solicitud. Selecciona un billing y genera la Factura de Sujeto Excluido aquí.
              </p>
            </div>
          </div>
        </header>

        <div className="mb-6 overflow-hidden rounded-2xl border border-emerald-100 bg-white">
          {loadingBillingsFse ? (
            <p className="px-6 py-6 text-sm text-slate-500">Cargando billings…</p>
          ) : billingsForFse.length === 0 ? (
            <p className="px-6 py-6 text-sm text-slate-500">No hay billings para generar FSE.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-emerald-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Billing</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Fecha</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">A proveedor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {billingsForFse.map((b: any) => (
                    <tr key={b.id} className="hover:bg-emerald-50/50">
                      <td className="px-4 py-3 font-mono text-sm text-slate-700">
                        {b.invoice_number || b.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        {b.created_at ? new Date(b.created_at).toLocaleDateString("es-AR") : "—"}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        ${Number(b.total_amount || 0).toFixed(2)} USD
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        ${Number(b.seller_amount ?? b.total_amount ?? 0).toFixed(2)} USD
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          className="inline-flex items-center rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                          onClick={() => {
                            setSelectedBillingForFse({
                              id: b.id,
                              invoice_number: b.invoice_number || `BILL-${b.id.slice(0, 8)}`,
                              invoice_date: b.created_at || new Date().toISOString(),
                              total_amount: b.total_amount || 0,
                              seller_amount: b.seller_amount,
                              description: b.description,
                              fiscal_data: {},
                            });
                            setShowFseModal(true);
                          }}
                        >
                          Generar FSE (14)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
    </div>
  );
}

export default Requests;
