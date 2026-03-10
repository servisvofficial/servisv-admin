import { useState, useMemo, useEffect } from "react";
import { DEPARTAMENTOS, getMunicipios } from "../data/departamentosMunicipios";

interface StandaloneInvoiceResult {
  codigoGeneracion: string;
  numeroControl: string;
  selloRecepcion: string | null;
  estado: string;
  dte_json: unknown;
  qrURL: string | null;
  pdfBase64?: string | null;
}

const redondear = (n: number) => Math.round(n * 100) / 100;

type DestinoFactura = "cliente" | "proveedor";

export default function Facturador() {
  const [destino, setDestino] = useState<DestinoFactura>("cliente");
  const [incluirComisiones, setIncluirComisiones] = useState(false);
  const [montoBase, setMontoBase] = useState("");
  const [concept, setConcept] = useState("Costo de servicio");
  const [tipoDte, setTipoDte] = useState<"01" | "03">("01");

  const [usarDatosReceptor, setUsarDatosReceptor] = useState(false);
  const [tipoPersona, setTipoPersona] = useState<"natural" | "juridica">("natural");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [dui, setDui] = useState("");
  const [nit, setNit] = useState("");
  const [nrc, setNrc] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StandaloneInvoiceResult | null>(null);

  const montoNum = useMemo(() => (montoBase === "" ? 0 : Number(montoBase)), [montoBase]);

  // Factura para CLIENTE (con comisiones): servicio + 10% comprador + IVA 13% sobre ese 10%
  const comisionComprador = useMemo(() => redondear(montoNum * 0.1), [montoNum]);
  const ivaCliente = useMemo(() => redondear(comisionComprador * 0.13), [comisionComprador]);
  const totalFacturaCliente = useMemo(
    () => redondear(montoNum + comisionComprador + ivaCliente),
    [montoNum, comisionComprador, ivaCliente]
  );

  // Factura para PROVEEDOR (con comisiones): 5% vendedor + IVA 13% sobre ese 5%
  const comisionVendedor = useMemo(() => redondear(montoNum * 0.05), [montoNum]);
  const ivaProveedor = useMemo(() => redondear(comisionVendedor * 0.13), [comisionVendedor]);
  const totalFacturaProveedor = useMemo(
    () => redondear(comisionVendedor + ivaProveedor),
    [comisionVendedor, ivaProveedor]
  );

  const montoAFacturar = incluirComisiones
    ? (destino === "cliente" ? totalFacturaCliente : totalFacturaProveedor)
    : montoNum;

  // CCF (03) exige datos del receptor; al elegir 03 mostramos el formulario
  useEffect(() => {
    if (tipoDte === "03") setUsarDatosReceptor(true);
  }, [tipoDte]);

  const mostrarFormDatosReceptor = tipoDte === "03" || usarDatosReceptor;

  const handleDepartamentoChange = (value: string) => {
    setDepartamento(value);
    setMunicipio("");
  };
  const municipios = departamento ? getMunicipios(departamento) : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!Number.isFinite(montoAFacturar) || montoAFacturar <= 0) {
      setError("El monto a facturar debe ser mayor a 0");
      return;
    }
    if (!concept.trim()) {
      setError("El concepto es requerido");
      return;
    }
    const exigeDatosReceptor = tipoDte === "03";
    if (usarDatosReceptor || exigeDatosReceptor) {
      if (!nombreCompleto.trim()) {
        setError("Nombre completo del receptor es requerido");
        return;
      }
      if (!email.trim()) {
        setError("Email del receptor es requerido");
        return;
      }
      if (!dui.trim() && !nit.trim()) {
        setError("Indica DUI o NIT del receptor");
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
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      setError("Faltan variables de entorno (VITE_SUPABASE_URL / VITE_SUPABASE_SERVICE_ROLE_KEY)");
      return;
    }

    const fiscalData = (usarDatosReceptor || tipoDte === "03")
      ? {
          tipo_persona: tipoPersona,
          nombre_completo: nombreCompleto.trim(),
          email: email.trim(),
          dui: dui.trim() || undefined,
          nit: nit.trim() || undefined,
          numero_registro_contribuyente: tipoDte === "03" ? nrc.trim() : undefined,
          direccion: direccion.trim(),
          departamento,
          municipio,
          telefono: telefono.trim() || undefined,
        }
      : null;

    try {
      setLoading(true);
      const response = await fetch(`${supabaseUrl}/functions/v1/create-standalone-invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-region": "us-east-1",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          tipoDte,
          totalAmount: montoAFacturar,
          concept: concept.trim(),
          fiscalData,
          destino,
          montoBase: montoNum,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data?.success === false) {
        setError(data?.error || data?.message || "Error al generar factura");
        return;
      }

      setResult({
        codigoGeneracion: data.dte?.codigoGeneracion ?? data.codigoGeneracion ?? "",
        numeroControl: data.dte?.numeroControl ?? data.numeroControl ?? "",
        selloRecepcion: data.dte?.selloRecepcion ?? data.selloRecepcion ?? null,
        estado: data.dte?.estado ?? data.estado ?? "procesado",
        dte_json: data.dte?.dte_json ?? data.dte_json ?? {},
        qrURL: data.dte?.qrURL ?? data.qrURL ?? null,
        pdfBase64: data.pdfBase64 ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!result?.pdfBase64) return;
    try {
      const bytes = Uint8Array.from(atob(result.pdfBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Factura_${result.numeroControl || "DTE"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    }
  };

  const downloadJSON = () => {
    if (!result?.dte_json) return;
    const blob = new Blob([JSON.stringify(result.dte_json, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DTE_${result.codigoGeneracion || "factura"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Facturador</h1>
        <p className="mt-1 text-sm text-slate-600">
          Genera factura para un cliente o un proveedor. Podés marcar si incluir comisiones (cliente: 10% + IVA; proveedor: 5% + IVA) o facturar solo el monto que ingreses. Descargá PDF y JSON.
        </p>
      </div>

      <section className="rounded-3xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Nueva factura</h2>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border-2 border-violet-200 bg-white p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">¿Para quién es la factura? *</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="destino"
                  checked={destino === "cliente"}
                  onChange={() => setDestino("cliente")}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                />
                <span className="font-medium">Factura para cliente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="destino"
                  checked={destino === "proveedor"}
                  onChange={() => setDestino("proveedor")}
                  className="h-4 w-4 text-violet-600 focus:ring-violet-500"
                />
                <span className="font-medium">Factura para proveedor</span>
              </label>
            </div>
          </div>

          <div className="rounded-xl border-2 border-gray-200 bg-white p-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">Tipo de factura *</label>
            <select
              value={tipoDte}
              onChange={(e) => setTipoDte(e.target.value as "01" | "03")}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              <option value="01">01 - Consumidor Final (puede facturarse sin datos del receptor)</option>
              <option value="03">03 - Crédito Fiscal / CCF (requiere datos del receptor)</option>
            </select>
            {tipoDte === "03" && (
              <p className="mt-2 text-sm text-amber-700">
                Para CCF los datos del receptor son obligatorios (nombre, NIT, NRC, dirección, etc.).
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
            <input
              type="checkbox"
              id="incluir-comisiones"
              checked={incluirComisiones}
              onChange={(e) => setIncluirComisiones(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            <label htmlFor="incluir-comisiones" className="text-sm font-medium text-gray-700">
              Incluir comisiones en la factura (cliente: 10% + IVA; proveedor: 5% + IVA). Si no marcas, se factura solo el monto que ingreses.
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Monto base (USD) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoBase}
                onChange={(e) => setMontoBase(e.target.value)}
                placeholder={destino === "cliente" ? "Ej. 40 (servicio)" : "Ej. 40 (referencia)"}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Concepto del pago *</label>
              <input
                type="text"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                required
              />
            </div>
          </div>

          {montoNum > 0 && incluirComisiones && (
            <div className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4 text-sm">
              <div className="font-medium text-slate-800 mb-2">
                {destino === "cliente" ? "Desglose factura al cliente" : "Desglose factura al proveedor"}
              </div>
              {destino === "cliente" ? (
                <ul className="space-y-1 text-slate-700">
                  <li>Monto base (servicio): ${montoNum.toFixed(2)}</li>
                  <li>Comisión comprador (10%): ${comisionComprador.toFixed(2)}</li>
                  <li>IVA (13% sobre comisión): ${ivaCliente.toFixed(2)}</li>
                  <li className="font-semibold pt-1 border-t border-violet-200">Total a facturar al cliente: ${totalFacturaCliente.toFixed(2)}</li>
                </ul>
              ) : (
                <ul className="space-y-1 text-slate-700">
                  <li>Monto base (referencia): ${montoNum.toFixed(2)}</li>
                  <li>Comisión vendedor (5%): ${comisionVendedor.toFixed(2)}</li>
                  <li>IVA (13% sobre comisión): ${ivaProveedor.toFixed(2)}</li>
                  <li className="font-semibold pt-1 border-t border-violet-200">Total a facturar al proveedor: ${totalFacturaProveedor.toFixed(2)}</li>
                </ul>
              )}
            </div>
          )}

          {tipoDte === "01" && (
            <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
              <input
                type="checkbox"
                id="usar-datos-receptor"
                checked={usarDatosReceptor}
                onChange={(e) => setUsarDatosReceptor(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              />
              <label htmlFor="usar-datos-receptor" className="text-sm font-medium text-gray-700">
                Completar datos del receptor ({destino === "cliente" ? "cliente" : "proveedor"}). Si no marcas, se factura sin datos (Consumidor Final).
              </label>
            </div>
          )}

          {mostrarFormDatosReceptor && (
            <>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-sm font-semibold text-gray-900 mb-3">
                  Datos fiscales del receptor ({destino === "cliente" ? "cliente" : "proveedor"})
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tipo persona</label>
                    <select
                      value={tipoPersona}
                      onChange={(e) => setTipoPersona(e.target.value as "natural" | "juridica")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="natural">Natural</option>
                      <option value="juridica">Jurídica</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
                    <input
                      type="text"
                      value={nombreCompleto}
                      onChange={(e) => setNombreCompleto(e.target.value)}
                      maxLength={250}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">DUI</label>
                    <input
                      type="text"
                      value={dui}
                      onChange={(e) => setDui(e.target.value)}
                      placeholder="00000000-0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">NIT</label>
                    <input
                      type="text"
                      value={nit}
                      onChange={(e) => setNit(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  {tipoDte === "03" && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">NRC *</label>
                      <input
                        type="text"
                        value={nrc}
                        onChange={(e) => setNrc(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                      />
                    </div>
                  )}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Departamento *</label>
                    <select
                      value={departamento}
                      onChange={(e) => handleDepartamentoChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Selecciona</option>
                      {DEPARTAMENTOS.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Municipio *</label>
                    <select
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      disabled={!departamento}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">Selecciona</option>
                      {municipios.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección (complemento) *</label>
                    <input
                      type="text"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-violet-600 px-6 py-3 text-base font-semibold text-white shadow-md hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Generando y transmitiendo..." : "Generar factura"}
            </button>
          </div>
        </form>
      </section>

      {result && (
        <section className="rounded-3xl border-2 border-green-300 bg-gradient-to-br from-green-50 to-emerald-50 p-6 shadow-xl">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Factura generada</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium text-slate-700">Código de generación:</span> {result.codigoGeneracion}</p>
            <p><span className="font-medium text-slate-700">Número de control:</span> {result.numeroControl}</p>
            <p><span className="font-medium text-slate-700">Estado:</span> {result.estado}</p>
            {result.qrURL && (
              <p>
                <a href={result.qrURL} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline">
                  Ver en consulta pública (Hacienda)
                </a>
              </p>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {result.pdfBase64 && (
              <button
                type="button"
                onClick={downloadPDF}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-red-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                Descargar PDF
              </button>
            )}
            <button
              type="button"
              onClick={downloadJSON}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Descargar JSON
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
