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
  seller_amount?: number | null;
  description?: string | null;
}

interface Props {
  /** Opcional: cuando ServiSV genera FSE sin asociar a un billing (servicio externo) */
  invoice: Invoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateFSEModal({ invoice, onClose, onSuccess }: Props) {
  const [observaciones, setObservaciones] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [totalCompra, setTotalCompra] = useState<string>("");
  const [reteRenta, setReteRenta] = useState<string>("0");
  const [ivaRete1, setIvaRete1] = useState<string>("0");

  const [tipoDocumento, setTipoDocumento] = useState("13");
  const [numDocumento, setNumDocumento] = useState("");
  const [nombre, setNombre] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [codActividad, setCodActividad] = useState("");
  const [descActividad, setDescActividad] = useState("");

  // Limpiar municipio cuando cambie el departamento
  const handleDepartamentoChange = (value: string) => {
    setDepartamento(value);
    setMunicipio(""); // Reset municipio cuando cambia departamento
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      setLoading(true);

      const total = Number(totalCompra || 0);
      if (!Number.isFinite(total) || total <= 0) {
        setError("Total compra debe ser mayor a 0");
        return;
      }

      if (!tipoDocumento || !numDocumento.trim() || !nombre.trim()) {
        setError("Completa tipo/número de documento y nombre del sujeto excluido");
        return;
      }
      if (!departamento.trim() || !municipio.trim() || !direccion.trim()) {
        setError("Completa dirección (departamento, municipio y complemento)");
        return;
      }

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
          billing_id: invoice?.id ?? null,
          observaciones: observaciones || null,
          descripcion: descripcion || invoice?.description || null,
          total_compra: total,
          rete_renta: Number(reteRenta || 0),
          iva_rete1: Number(ivaRete1 || 0),
          sujeto_excluido: {
            tipoDocumento,
            numDocumento: numDocumento.trim(),
            nombre: nombre.trim(),
            codActividad: codActividad.trim() ? codActividad.trim() : null,
            descActividad: descActividad.trim() ? descActividad.trim() : null,
            direccion: {
              departamento: departamento.trim(),
              municipio: municipio.trim(),
              complemento: direccion.trim(),
            },
            telefono: telefono.trim() ? telefono.trim() : null,
            correo: correo.trim() ? correo.trim() : null,
          },
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
              {invoice ? (
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
                        (Proveedor) Completar manualmente abajo
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-5 mb-6">
                  <p className="text-sm text-emerald-800">
                    Cuando <strong>ServiSV</strong> contrata un servicio externo, genera aquí la Factura de Sujeto Excluido (FSE). Completa los datos del proveedor y el monto abajo.
                  </p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total compra (USD) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={totalCompra}
                      onChange={(e) => setTotalCompra(e.target.value)}
                      placeholder={invoice ? String(invoice.seller_amount ?? invoice.total_amount ?? 0) : "0.00"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                    {invoice && (
                      <p className="text-xs text-gray-500 mt-1">
                        Sugerido: ${Number(invoice.seller_amount ?? invoice.total_amount ?? 0).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      maxLength={1000}
                      placeholder={invoice?.description || "Servicio adquirido a sujeto excluido (ej. consultoría, mantenimiento)"}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Retención Renta (opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={reteRenta}
                      onChange={(e) => setReteRenta(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IVA retenido (opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={ivaRete1}
                      onChange={(e) => setIvaRete1(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="text-sm font-semibold text-gray-900 mb-3">Datos del sujeto excluido (Proveedor)</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tipo documento *</label>
                      <select
                        value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="13">DUI (13)</option>
                        <option value="36">NIT (36)</option>
                        <option value="02">Carnet Residente (02)</option>
                        <option value="03">Pasaporte (03)</option>
                        <option value="37">Otro (37)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Número documento *</label>
                      <input
                        type="text"
                        value={numDocumento}
                        onChange={(e) => setNumDocumento(e.target.value)}
                        maxLength={20}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Nombre *</label>
                      <input
                        type="text"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        maxLength={250}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Departamento *</label>
                      <select
                        value={departamento}
                        onChange={(e) => handleDepartamentoChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      >
                        <option value="">Selecciona un departamento</option>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        disabled={!departamento}
                        required
                      >
                        <option value="">Selecciona un municipio</option>
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
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Teléfono (opcional)</label>
                      <input
                        type="text"
                        value={telefono}
                        onChange={(e) => setTelefono(e.target.value)}
                        maxLength={30}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Correo (opcional)</label>
                      <input
                        type="email"
                        value={correo}
                        onChange={(e) => setCorreo(e.target.value)}
                        maxLength={100}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Cod. actividad (opcional)</label>
                      <input
                        type="text"
                        value={codActividad}
                        onChange={(e) => setCodActividad(e.target.value)}
                        maxLength={6}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Desc. actividad (opcional)</label>
                      <input
                        type="text"
                        value={descActividad}
                        onChange={(e) => setDescActividad(e.target.value)}
                        maxLength={150}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

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

