import { useState } from "react";

/** Datos del proveedor para rellenar el formulario (vienen del perfil al abrir desde una request) */
interface ProviderData {
  nombre_completo?: string;
  email?: string;
  telefono?: string;
  tipo_persona?: "natural" | "juridica";
  dui?: string;
  nit?: string;
  numero_registro_contribuyente?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  seller_amount?: number | null;
  /** Comisión que retiene la app del proveedor (5%) – es lo que se factura al proveedor */
  platform_commission_seller?: number | null;
  /** IVA 13% sobre la comisión al proveedor (se descuenta del monto a liberar). Monto a facturar = comisión + este IVA. */
  iva_commission_seller?: number | null;
  description?: string | null;
  /** Datos del proveedor registrado para rellenar automáticamente */
  providerData?: ProviderData | null;
}

interface Props {
  invoice: Invoice;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateProviderInvoiceModal({ invoice, onClose, onSuccess }: Props) {
  const [tipoDte, setTipoDte] = useState<"01" | "03">("01");
  const commissionAmount = invoice.platform_commission_seller ?? 0;
  const ivaOnCommission = invoice.iva_commission_seller ?? (commissionAmount > 0 ? commissionAmount * 0.13 : 0);
  const defaultInvoiceAmount = commissionAmount + ivaOnCommission;
  const [amount, setAmount] = useState<string>(
    String(defaultInvoiceAmount > 0 ? defaultInvoiceAmount : invoice.seller_amount ?? invoice.total_amount ?? 0)
  );
  const [concept, setConcept] = useState("Costo de servicio");

  const provider = invoice.providerData;
  const [tipoPersona, setTipoPersona] = useState<"natural" | "juridica">(
    provider?.tipo_persona === "juridica" ? "juridica" : "natural"
  );
  const [nombreCompleto, setNombreCompleto] = useState(provider?.nombre_completo ?? "");
  const [dui, setDui] = useState(provider?.dui ?? "");
  const [nit, setNit] = useState(provider?.nit ?? "");
  const [nrc, setNrc] = useState(provider?.numero_registro_contribuyente ?? "");
  const [email, setEmail] = useState(provider?.email ?? "");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState(provider?.telefono ?? "");

  const handleDepartamentoChange = (value: string) => {
    setDepartamento(value);
    setMunicipio("");
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (!nombreCompleto.trim()) {
      setError("Nombre completo del proveedor es requerido");
      return;
    }
    if (!email.trim()) {
      setError("Email del proveedor es requerido");
      return;
    }
    if (!dui.trim() && !nit.trim()) {
      setError("Indica DUI o NIT del proveedor");
      return;
    }
    if (tipoDte === "03" && !nrc.trim()) {
      setError("Para Crédito Fiscal (03) el NRC es requerido");
      return;
    }
    if (!departamento || !municipio || !direccion.trim()) {
      setError("Dirección completa (departamento, municipio y complemento) es requerida");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        setError("Faltan variables de entorno (VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY)");
        return;
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/create-provider-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-region": "us-east-1",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          billingId: invoice.id,
          tipoDte,
          providerInvoiceAmount: amountNum,
          concept: concept.trim(),
          providerFiscalData: {
            tipo_persona: tipoPersona,
            nombre_completo: nombreCompleto.trim(),
            email: email.trim(),
            dui: dui.trim() || undefined,
            nit: nit.trim() || undefined,
            numero_registro_contribuyente: nrc.trim() || undefined,
            direccion: direccion.trim(),
            departamento,
            municipio,
            telefono: telefono.trim() || undefined,
          },
        }),
      });

      let result: { success?: boolean; error?: string; message?: string };
      try {
        result = await response.json();
      } catch (_) {
        setError(response.ok ? "Error al leer la respuesta del servidor." : "Error del servidor (tiempo agotado o respuesta no válida). Vuelve a intentar.");
        return;
      }

      if (!response.ok || result?.success === false) {
        const msg = result?.error || result?.message || "Error al generar factura al proveedor";
        setError(msg);
        return;
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || "Error al generar factura";
      setError(msg);
      console.error(err);
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
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex justify-between items-center flex-shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">Factura al proveedor</h2>
                <p className="text-blue-100 text-sm mt-1">
                  Factura Consumidor Final (01) o Crédito Fiscal (03)
                </p>
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

            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-5 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">Billing</div>
                    <div className="text-sm font-semibold text-gray-900">{invoice.invoice_number || invoice.id.slice(0, 8)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-700 font-medium uppercase tracking-wide mb-1">Monto a facturar (Comisión 5% + IVA 13%)</div>
                    <div className="text-sm font-semibold text-gray-900">
                      Comisión: ${Number(commissionAmount).toFixed(2)} USD · IVA: ${Number(ivaOnCommission).toFixed(2)} USD · Total: ${Number(defaultInvoiceAmount).toFixed(2)} USD
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Se factura al proveedor la comisión que retiene la app más el IVA sobre esa comisión.</p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de factura *</label>
                    <select
                      value={tipoDte}
                      onChange={(e) => setTipoDte(e.target.value as "01" | "03")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="01">01 - Consumidor Final</option>
                      <option value="03">03 - Crédito Fiscal (CCF)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Monto (USD) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Descripción / Concepto *</label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-gray-900">Datos fiscales del proveedor (receptor)</span>
                    {provider && (provider.nombre_completo || provider.email) && (
                      <span className="text-xs text-blue-600">Precargados del perfil del proveedor</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo persona</label>
                      <select
                        value={tipoPersona}
                        onChange={(e) => setTipoPersona(e.target.value as "natural" | "juridica")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="natural">Natural</option>
                        <option value="juridica">Jurídica</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo *</label>
                      <input
                        type="text"
                        value={nombreCompleto}
                        onChange={(e) => setNombreCompleto(e.target.value)}
                        maxLength={250}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">DUI</label>
                      <input
                        type="text"
                        value={dui}
                        onChange={(e) => setDui(e.target.value)}
                        maxLength={20}
                        placeholder="00000000-0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">NIT</label>
                      <input
                        type="text"
                        value={nit}
                        onChange={(e) => setNit(e.target.value)}
                        maxLength={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {tipoDte === "03" && (
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">NRC * (para Crédito Fiscal)</label>
                        <input
                          type="text"
                          value={nrc}
                          onChange={(e) => setNrc(e.target.value)}
                          maxLength={20}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required={tipoDte === "03"}
                        />
                      </div>
                    )}
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departamento *</label>
                      <select
                        value={departamento}
                        onChange={(e) => handleDepartamentoChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      >
                        <option value="">Selecciona</option>
                        <option value="01">Ahuachapán</option>
                        <option value="02">Santa Ana</option>
                        <option value="03">Sonsonate</option>
                        <option value="04">Chalatenango</option>
                        <option value="05">La Libertad</option>
                        <option value="06">San Salvador</option>
                        <option value="07">Cuscatlán</option>
                        <option value="08">La Paz</option>
                        <option value="09">Cabañas</option>
                        <option value="10">San Vicente</option>
                        <option value="11">Usulután</option>
                        <option value="12">San Miguel</option>
                        <option value="13">Morazán</option>
                        <option value="14">La Unión</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Municipio *</label>
                      <select
                        value={municipio}
                        onChange={(e) => setMunicipio(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!departamento}
                        required
                      >
                        <option value="">Selecciona</option>
                        {departamento === "06" && (
                          <>
                            <option value="01">San Salvador</option>
                            <option value="02">Aguilares</option>
                            <option value="03">Apopa</option>
                            <option value="04">Ayutuxtepeque</option>
                            <option value="05">Cuscatancingo</option>
                            <option value="06">Delgado</option>
                            <option value="07">Ilopango</option>
                            <option value="08">Mejicanos</option>
                            <option value="09">Nejapa</option>
                            <option value="10">Panchimalco</option>
                            <option value="11">Rosario de Mora</option>
                            <option value="12">San Marcos</option>
                            <option value="13">San Martín</option>
                            <option value="14">Santiago Texacuangos</option>
                            <option value="15">Santo Tomás</option>
                            <option value="16">Soyapango</option>
                            <option value="17">Tonacatepeque</option>
                            <option value="18">Guazapa</option>
                            <option value="19">San Bartolomé Perulapía</option>
                          </>
                        )}
                        {departamento === "05" && (
                          <>
                            <option value="01">Santa Tecla</option>
                            <option value="02">Antiguo Cuscatlán</option>
                            <option value="03">Ciudad Arce</option>
                            <option value="04">Colón</option>
                            <option value="05">Comasagua</option>
                            <option value="06">Huizúcar</option>
                            <option value="07">Jayaque</option>
                            <option value="08">Jicalapa</option>
                            <option value="09">La Libertad</option>
                            <option value="10">Nuevo Cuscatlán</option>
                            <option value="11">San Juan Opico</option>
                            <option value="12">Quezaltepeque</option>
                            <option value="13">Sacacoyo</option>
                            <option value="14">San José Villanueva</option>
                            <option value="15">San Matías</option>
                            <option value="16">San Pablo Tacachico</option>
                            <option value="17">Tamanique</option>
                            <option value="18">Talnique</option>
                            <option value="19">Teotepeque</option>
                            <option value="20">Tepecoyo</option>
                            <option value="21">Zaragoza</option>
                          </>
                        )}
                        {departamento && !["05", "06"].includes(departamento) && (
                          <option value="01">Municipio 01</option>
                        )}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Dirección (complemento) *</label>
                      <input
                        type="text"
                        value={direccion}
                        onChange={(e) => setDireccion(e.target.value)}
                        maxLength={200}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono</label>
                      <input
                        type="text"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        maxLength={30}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Importante:</strong> Se factura la comisión 5% que retiene la app del proveedor (no el monto que se le libera). La factura (01 o 03) se transmitirá a Hacienda; el receptor es el proveedor.
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
                    {loading ? "Generando..." : "Generar factura al proveedor"}
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
