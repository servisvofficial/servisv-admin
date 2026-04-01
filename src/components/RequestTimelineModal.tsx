import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type QuoteRecord = {
  id: string;
  provider_name: string | null;
  price: number | null;
  status: string | null;
  description: string | null;
  estimated_duration: string | null;
  estimated_date: string | null;
  warranty: string | null;
  includes_supplies: boolean | null;
  is_priority: boolean | null;
  valid_until: string | null;
  created_at: string;
  is_selected: boolean;
};

type RequestDetail = {
  id: string;
  title: string;
  description: string | null;
  client_name: string;
  service_category: string;
  subcategory: string | null;
  location: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  selected_quote_id: string | null;
  budget_range: { min?: number; max?: number } | null;
  scheduled_date: string | null;
  photos: string[] | null;
};

type BillingRecord = {
  id: string;
  total_amount: number | null;
  seller_amount: number | null;
  is_held: boolean | null;
  created_at: string | null;
  released_at: string | null;
};

type Props = {
  requestId: string;
  requestTitle: string;
  onClose: () => void;
};

const statusTexts: Record<string, string> = {
  open: "Abierta",
  quoted: "Cotizada",
  accepted: "Aceptada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  accepted: "bg-amber-100 text-amber-800",
  in_progress: "bg-indigo-100 text-indigo-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function display(n: number | null) {
  return n != null ? `$${Number(n).toFixed(2)} USD` : "—";
}

export function RequestTimelineModal({ requestId, requestTitle, onClose }: Props) {
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [quotes, setQuotes] = useState<QuoteRecord[]>([]);
  const [billing, setBilling] = useState<BillingRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      // 1. Detalle de la solicitud
      const { data: reqData, error: reqErr } = await supabase
        .from("requests")
        .select(
          "id,title,description,client_name,service_category,subcategory,location,status,created_at,updated_at,selected_quote_id,budget_range,scheduled_date,photos"
        )
        .eq("id", requestId)
        .single();

      if (ignore) return;
      if (reqErr || !reqData) {
        setError(reqErr?.message ?? "No se pudo cargar la solicitud");
        setLoading(false);
        return;
      }

      setRequest(reqData as RequestDetail);

      // 2. Todas las cotizaciones de esta solicitud
      const { data: quotesData, error: quotesError } = await supabase
        .from("quotes")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: true });

      if (quotesError) {
        console.error("[RequestTimelineModal] Error cargando cotizaciones:", quotesError);
      }

      if (!ignore && quotesData) {
        const mapped: QuoteRecord[] = quotesData.map((q: any) => ({
          id: q.id,
          provider_name: q.provider_name ?? null,
          price: q.price ?? null,
          status: q.status ?? null,
          description: q.description ?? null,
          estimated_duration: q.estimated_duration ?? null,
          estimated_date: q.estimated_date ?? null,
          warranty: q.warranty ?? null,
          includes_supplies: q.includes_supplies ?? null,
          is_priority: q.is_priority ?? null,
          valid_until: q.valid_until ?? null,
          created_at: q.created_at,
          is_selected: q.id === reqData.selected_quote_id,
        }));
        setQuotes(mapped);

        // 3. Billing asociado a la quote seleccionada
        if (reqData.selected_quote_id) {
          const { data: billingData } = await supabase
            .from("billing")
            .select("id,total_amount,seller_amount,is_held,created_at,released_at")
            .eq("quote_id", reqData.selected_quote_id)
            .maybeSingle();

          if (!ignore && billingData) {
            setBilling(billingData as BillingRecord);
          }
        }
      }

      if (!ignore) setLoading(false);
    };

    load();
    return () => { ignore = true; };
  }, [requestId]);

  // Construir eventos del timeline
  const events: {
    id: string;
    icon: string;
    color: string;
    label: string;
    detail: string | null;
    extraDescription?: string | null;
    time: string | null;
    tag?: string;
    tagColor?: string;
  }[] = [];

  if (request) {
    // Paso 1: Publicación
    events.push({
      id: "published",
      icon: "📋",
      color: "bg-blue-500",
      label: "Solicitud publicada por el cliente",
      detail: `${request.client_name} · ${request.service_category}${request.subcategory ? ` › ${request.subcategory}` : ""}${request.location ? ` · ${request.location}` : ""}`,
      time: request.created_at,
      tag: statusTexts[request.status] ?? request.status,
      tagColor: statusColors[request.status] ?? "bg-slate-100 text-slate-700",
    });

    // Pasos intermedios: cotizaciones
    if (quotes.length === 0 && ["quoted", "accepted", "in_progress", "completed"].includes(request.status)) {
      events.push({
        id: "no-quotes",
        icon: "📨",
        color: "bg-slate-300",
        label: "Sin cotizaciones registradas en el sistema",
        detail: null,
        time: null,
      });
    }

      quotes.forEach((q) => {
      const isAccepted = q.is_selected;
      const isRejected = !isAccepted && (q.status === "rejected" || (request.selected_quote_id && q.status !== "pending"));

      const detailParts: string[] = [];
      if (q.price != null) detailParts.push(`Precio: ${display(q.price)}`);
      if (q.estimated_duration) detailParts.push(`Duración estimada: ${q.estimated_duration}`);
      if (q.estimated_date) detailParts.push(`Fecha estimada: ${fmt(q.estimated_date)}`);
      if (q.warranty) detailParts.push(`Garantía: ${q.warranty}`);
      if (q.includes_supplies != null) detailParts.push(q.includes_supplies ? "Incluye materiales" : "No incluye materiales");
      if (q.is_priority) detailParts.push("⚡ Cotización prioritaria");
      if (q.valid_until) detailParts.push(`Válida hasta: ${fmt(q.valid_until)}`);

      events.push({
        id: `quote-${q.id}`,
        icon: isAccepted ? "✅" : isRejected ? "❌" : "📨",
        color: isAccepted ? "bg-green-500" : isRejected ? "bg-red-400" : "bg-purple-400",
        label: isAccepted
          ? `Cotización aceptada — ${q.provider_name ?? "proveedor desconocido"}`
          : isRejected
          ? `Cotización rechazada — ${q.provider_name ?? "proveedor desconocido"}`
          : `Cotización recibida — ${q.provider_name ?? "proveedor desconocido"}`,
        detail: detailParts.length > 0 ? detailParts.join(" · ") : "Sin detalles adicionales",
        extraDescription: q.description ?? null,
        time: q.created_at,
        tag: isAccepted ? "Aceptada" : isRejected ? "Rechazada" : "Pendiente",
        tagColor: isAccepted
          ? "bg-green-100 text-green-800"
          : isRejected
          ? "bg-red-100 text-red-800"
          : "bg-purple-100 text-purple-800",
      });
    });

    // Pago (billing)
    if (billing) {
      events.push({
        id: "billing",
        icon: "💳",
        color: "bg-amber-500",
        label: "Pago registrado",
        detail: `Total: ${display(billing.total_amount)} · A proveedor: ${display(billing.seller_amount)}`,
        time: billing.created_at,
        tag: billing.is_held ? "🔒 Retenido" : "✅ Liberado",
        tagColor: billing.is_held ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800",
      });

      if (billing.released_at) {
        events.push({
          id: "released",
          icon: "🏦",
          color: "bg-emerald-500",
          label: "Pago liberado al proveedor",
          detail: `Monto liberado: ${display(billing.seller_amount)}`,
          time: billing.released_at,
        });
      }
    }

    // Estado final
    if (request.status === "completed") {
      events.push({
        id: "completed",
        icon: "🏁",
        color: "bg-green-600",
        label: "Servicio completado",
        detail: "El cliente marcó el servicio como completado.",
        time: request.updated_at,
        tag: "Completado",
        tagColor: "bg-green-100 text-green-800",
      });
    } else if (request.status === "cancelled") {
      events.push({
        id: "cancelled",
        icon: "🚫",
        color: "bg-red-500",
        label: "Solicitud cancelada",
        detail: null,
        time: request.updated_at,
        tag: "Cancelada",
        tagColor: "bg-red-100 text-red-800",
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Seguimiento de solicitud
            </p>
            <h2 className="mt-1 truncate text-lg font-semibold text-slate-900">
              {requestTitle}
            </h2>
            {request && (
              <p className="mt-0.5 text-xs text-slate-500">
                ID: <span className="font-mono">{request.id.slice(0, 8)}…</span>
                {" · "}
                {request.service_category}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex items-center gap-3 py-10 text-sm text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
              Cargando seguimiento…
            </div>
          ) : error ? (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : (
            <>
              {/* Resumen rápido */}
              {request && (
                <div className="mb-6 space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-400">Cliente</p>
                      <p className="font-medium text-slate-900">{request.client_name}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Estado actual</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[request.status] ?? "bg-slate-100 text-slate-700"}`}>
                        {statusTexts[request.status] ?? request.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Cotizaciones recibidas</p>
                      <p className="font-medium text-slate-900">{quotes.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Categoría</p>
                      <p className="font-medium text-slate-900">
                        {request.service_category}{request.subcategory ? ` › ${request.subcategory}` : ""}
                      </p>
                    </div>
                    {request.location && (
                      <div>
                        <p className="text-xs text-slate-400">Ubicación</p>
                        <p className="font-medium text-slate-900">{request.location}</p>
                      </div>
                    )}
                    {request.budget_range && (
                      <div>
                        <p className="text-xs text-slate-400">Presupuesto cliente</p>
                        <p className="font-medium text-slate-900">
                          ${request.budget_range.min ?? "—"} – ${request.budget_range.max ?? "—"} USD
                        </p>
                      </div>
                    )}
                    {request.scheduled_date && (
                      <div>
                        <p className="text-xs text-slate-400">Fecha programada</p>
                        <p className="font-medium text-slate-900">{fmt(request.scheduled_date)}</p>
                      </div>
                    )}
                    {billing && (
                      <div>
                        <p className="text-xs text-slate-400">Monto pagado</p>
                        <p className="font-semibold text-emerald-700">{display(billing.total_amount)}</p>
                      </div>
                    )}
                  </div>

                  {/* Descripción de la solicitud */}
                  {request.description && (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="text-xs text-slate-400">Descripción del cliente</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-700">{request.description}</p>
                    </div>
                  )}

                  {/* Fotos adjuntas */}
                  {request.photos && request.photos.length > 0 && (
                    <div className="border-t border-slate-200 pt-3">
                      <p className="mb-2 text-xs text-slate-400">Fotos adjuntas ({request.photos.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {request.photos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={url}
                              alt={`Foto ${i + 1}`}
                              className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 hover:ring-indigo-400 transition-all"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              <div className="relative">
                {/* Línea vertical */}
                <div className="absolute left-5 top-0 h-full w-0.5 bg-slate-100" />

                <ol className="space-y-6">
                  {events.map((event) => (
                    <li key={event.id} className="relative flex gap-4">
                      {/* Ícono del paso */}
                      <div className={`relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${event.color} text-lg shadow-sm`}>
                        {event.icon}
                      </div>

                      {/* Contenido */}
                      <div className="min-w-0 flex-1 pb-2 pt-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {event.label}
                          </p>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            {event.tag && (
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${event.tagColor}`}>
                                {event.tag}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.detail && (
                          <p className="mt-0.5 text-xs text-slate-500">{event.detail}</p>
                        )}
                        {event.extraDescription && (
                          <p className="mt-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs italic text-slate-600 ring-1 ring-slate-100">
                            "{event.extraDescription}"
                          </p>
                        )}
                        {event.time && (
                          <p className="mt-1 text-xs text-slate-400">{fmt(event.time)}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
