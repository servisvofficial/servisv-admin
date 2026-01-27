import { useState } from "react";

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS_CONTINGENCIA = [
  { value: 1, label: "Falla en el servicio del MH" },
  { value: 2, label: "Falla en el servicio de internet" },
  { value: 3, label: "Falla eléctrica" },
  { value: 4, label: "Falla en el sistema del contribuyente" },
  { value: 5, label: "Otro" },
];

export function CreateContingencyModal({ onClose, onSuccess }: Props) {
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [tipoContingencia, setTipoContingencia] = useState<number>(1);
  const [descripcion, setDescripcion] = useState("");
  const [dtesText, setDtesText] = useState("");
  const [responsable, setResponsable] = useState({
    nombre: "",
    tipoDoc: "13",
    numDoc: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseDTEs = (text: string) => {
    // Formato esperado: CODIGO|TIPO (uno por línea)
    // Ejemplo:
    // 43D356D7-C293-4191-BBB3-1C6D077B93AA|03
    // 8F2A9B1C-5E4F-3A2B-1C0D-9E8F7A6B5C4D|01
    const lines = text.trim().split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => {
        const [codigo, tipo] = line.split('|').map(s => s.trim());
        return { codigo, tipo };
      })
      .filter(dte => dte.codigo && dte.tipo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validaciones
    if (!fechaInicio || !fechaFin || !horaInicio || !horaFin) {
      setError("Debes completar las fechas y horas de la contingencia");
      return;
    }

    if (!responsable.nombre || !responsable.numDoc) {
      setError("Debes completar los datos del responsable");
      return;
    }

    if (tipoContingencia === 5 && !descripcion) {
      setError("Debes especificar el motivo cuando seleccionas 'Otro'");
      return;
    }

    const dtes = parseDTEs(dtesText);
    if (dtes.length === 0) {
      setError("Debes agregar al menos un DTE para reportar");
      return;
    }

    try {
      setLoading(true);

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-dte-events`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-region": "us-east-1",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            type: "contingencia",
            dtes: dtes,
            motivo: {
              fechaInicio,
              fechaFin,
              horaInicio,
              horaFin,
              tipoContingencia,
              descripcion: descripcion || TIPOS_CONTINGENCIA.find(t => t.value === tipoContingencia)?.label || "",
            },
            responsable,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Error al crear evento de contingencia");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || "Error al crear evento de contingencia");
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
        onClick={onClose}
      />
      
      <div className="fixed inset-0 z-[9999] overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-600 to-orange-700 px-6 py-5 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Reportar Contingencia
                </h2>
                <p className="text-orange-100 text-sm mt-1">Evento de Contingencia - MH</p>
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

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 mb-6">
                <p className="text-sm text-orange-800">
                  <strong>ℹ️ Información:</strong> Usa este evento para reportar DTEs
                  que fueron emitidos cuando el sistema del Ministerio de Hacienda
                  estaba fuera de servicio.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Período de contingencia */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Período de Contingencia
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Inicio *
                      </label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hora Inicio *
                      </label>
                      <input
                        type="time"
                        value={horaInicio}
                        onChange={(e) => setHoraInicio(e.target.value + ":00")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha Fin *
                      </label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Hora Fin *
                      </label>
                      <input
                        type="time"
                        value={horaFin.substring(0, 5)}
                        onChange={(e) => setHoraFin(e.target.value + ":00")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Tipo y motivo */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tipo de Contingencia *
                  </label>
                  <select
                    value={tipoContingencia}
                    onChange={(e) => setTipoContingencia(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  >
                    {TIPOS_CONTINGENCIA.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {tipoContingencia === 5 && (
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      placeholder="Describe el motivo de la contingencia..."
                      rows={2}
                      maxLength={500}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 mt-2"
                      required
                    />
                  )}
                </div>

                {/* DTEs a reportar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    DTEs a Reportar *
                  </label>
                  <textarea
                    value={dtesText}
                    onChange={(e) => setDtesText(e.target.value)}
                    rows={6}
                    placeholder={`Ingresa un DTE por línea en formato: CODIGO|TIPO\n\nEjemplo:\n43D356D7-C293-4191-BBB3-1C6D077B93AA|03\n8F2A9B1C-5E4F-3A2B-1C0D-9E8F7A6B5C4D|01\n\nTipos: 01=Factura, 03=CCF, 14=FSE`}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-sm"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {parseDTEs(dtesText).length} DTE(s) válido(s)
                  </p>
                </div>

                {/* Responsable */}
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Responsable del Establecimiento
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={responsable.nombre}
                        onChange={(e) =>
                          setResponsable({ ...responsable, nombre: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo Doc
                      </label>
                      <select
                        value={responsable.tipoDoc}
                        onChange={(e) =>
                          setResponsable({ ...responsable, tipoDoc: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                      >
                        <option value="13">DUI</option>
                        <option value="36">NIT</option>
                        <option value="03">Pasaporte</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Número de Documento *
                      </label>
                      <input
                        type="text"
                        value={responsable.numDoc}
                        onChange={(e) =>
                          setResponsable({ ...responsable, numDoc: e.target.value })
                        }
                        placeholder="Ej: 039153636"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ Importante:</strong> Este evento se transmitirá
                    al Ministerio de Hacienda reportando todos los DTEs listados
                    como emitidos durante contingencia.
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
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50"
                    disabled={loading}
                  >
                    {loading ? "Procesando..." : "Reportar Contingencia"}
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
