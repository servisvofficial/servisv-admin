/**
 * Edge Function para generar DTE 01 (Factura Consumidor Final) o 03 (Crédito Fiscal)
 * al proveedor. Invocada desde el admin con datos fiscales ingresados manualmente.
 * Mismo flujo de autenticación que FSE y notas crédito/débito (Bearer service role).
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============================================================================
// TIPOS DTE
// ============================================================================

type Ambiente = "00" | "01"; // 00 = Pruebas, 01 = Producción

interface FiscalData {
  tipo_persona: "natural" | "juridica";
  nombre_completo: string;
  email: string;
  dui?: string;
  nit?: string;
  numero_registro_contribuyente?: string;
  direccion?: string;
  departamento?: string; // Departamento (01-14)
  municipio?: string; // Municipio/Alcaldía según CAT-013 2024 (01-44)
  distrito?: string; // Distrito según CAT-013 2024 (01-XX)
}

interface DTEIdentificacion {
  version: number;
  ambiente: Ambiente;
  tipoDte: string;
  numeroControl: string;
  codigoGeneracion: string;
  tipoModelo: number;
  tipoOperacion: number;
  tipoContingencia?: any;
  motivoContin?: any;
  fecEmi: string;
  horEmi: string;
  tipoMoneda: string;
}

interface DTEEmisor {
  nit: string;
  nrc: string;
  nombre: string;
  codActividad: string;
  descActividad: string;
  nombreComercial?: string | null;
  tipoEstablecimiento?: string; // Opcional para tipo 14 (Sujeto Excluido)
  direccion: {
    departamento: string;
    municipio: string;
    complemento: string;
  };
  telefono: string;
  correo: string;
  codEstableMH?: string | null;
  codEstable?: string | null;
  codPuntoVentaMH?: string | null;
  codPuntoVenta?: string | null;
}

interface DTEReceptor {
  // Para tipo 01 (Factura Consumidor Final): usar tipoDocumento y numDocumento
  tipoDocumento?: string | null; // "13" para DUI, "36" para NIT
  numDocumento?: string | null;
  // Para tipo 03 (Crédito Fiscal): usar nit y nrc
  nit?: string;
  nrc?: string | null;
  nombre: string;
  codActividad?: string;
  descActividad?: string;
  nombreComercial?: string | null;
  direccion?: {
    departamento: string;
    municipio: string;
    complemento: string;
  };
  telefono?: string | null;
  correo: string;
}

interface DTECuerpoDocumento {
  numItem: number;
  tipoItem: number;
  numeroDocumento?: string | null;
  codigo?: string | null;
  codTributo?: string | null;
  descripcion: string;
  cantidad: number;
  uniMedida: number;
  precioUni: number;
  montoDescu: number;
  ventaNoSuj: number;
  ventaExenta: number;
  ventaGravada: number;
  tributos: string[] | null;
  psv: number;
  noGravado: number;
  ivaItem?: number; // Solo para tipo 01 (Factura Consumidor Final), NO para tipo 03 (CCF)
}

interface DTEResumen {
  totalNoSuj: number;
  totalExenta: number;
  totalGravada: number;
  subTotalVentas: number;
  descuNoSuj: number;
  descuExenta: number;
  descuGravada: number;
  porcentajeDescuento: number;
  totalDescu: number;
  tributos: Array<{
    codigo: string;
    descripcion: string;
    valor: number;
  }> | null;
  subTotal: number;
  ivaPerci1?: number; // REQUERIDO para tipo 03 (CCF v3) - IVA Percibido
  ivaRete1: number;
  reteRenta: number; // Requerido según MH
  montoTotalOperacion: number;
  totalNoGravado: number;
  totalIva?: number; // Solo para tipo 01 (Factura Consumidor Final), NO para tipo 03 (CCF)
  totalPagar: number;
  totalLetras: string;
  saldoFavor: number;
  condicionOperacion: number;
  pagos: Array<{
    codigo: string;
    montoPago: number;
    referencia: string | null;
    plazo: string | null;
    periodo: number | null;
  }> | null;
  numPagoElectronico: string | null;
}

interface DTE_CreditoFiscal {
  identificacion: DTEIdentificacion;
  documentoRelacionado?: any[] | null;
  emisor: DTEEmisor;
  receptor: DTEReceptor;
  otrosDocumentos?: any[] | null;
  ventaTercero?: any | null;
  cuerpoDocumento: DTECuerpoDocumento[];
  resumen: DTEResumen;
  extension?: {
    nombEntrega?: string | null;
    docuEntrega?: string | null;
    nombRecibe?: string | null;
    docuRecibe?: string | null;
    observaciones?: string | null;
    placaVehiculo?: string | null;
  } | null;
  apendice?: any[] | null;
}

interface DTEResponse {
  version: number;
  ambiente: Ambiente;
  versionApp: number;
  estado: string;
  codigoGeneracion: string;
  selloRecibido?: string;
  fhProcesamiento: string;
  descripcionMsg?: string;
  observaciones?: string[];
}

interface DTEAuthResponse {
  status: {
    code: number;
    message: string;
  };
  body: {
    token: string;
  };
}

// ============================================================================
// CONFIGURACIÓN DTE
// ============================================================================

const DTE_MH_API_URL =
  Deno.env.get("DTE_MH_API_URL") || "https://apitest.dtes.mh.gob.sv";
const DTE_USER = Deno.env.get("DTE_USER") || "";
const DTE_PASSWORD = Deno.env.get("DTE_PASSWORD") || "";
const DTE_AMBIENTE: Ambiente = (Deno.env.get("DTE_AMBIENTE") ||
  "00") as Ambiente;
const DTE_HABILITADO = Deno.env.get("DTE_HABILITADO") === "true";
const EJECUTAR_DTE = DTE_HABILITADO;
const SERVISV_NIT = Deno.env.get("SERVISV_NIT") || "0623101225120-7";
const SERVISV_NRC = Deno.env.get("SERVISV_NRC") || "377367-0";
const SERVISV_RAZON_SOCIAL =
  Deno.env.get("SERVISV_RAZON_SOCIAL") ||
  "SERVICIOSSV, SOCIEDAD POR ACCIONES SIMPLIFICADA DE CAPITAL VARIABLE";
const SERVISV_NOMBRE_COMERCIAL =
  Deno.env.get("SERVISV_NOMBRE_COMERCIAL") || "ServiSV";
const SERVISV_COD_ACTIVIDAD = Deno.env.get("SERVISV_COD_ACTIVIDAD") || "62010";
const SERVISV_DESC_ACTIVIDAD =
  Deno.env.get("SERVISV_DESC_ACTIVIDAD") || "PORTALES WEB";
const SERVISV_DEPTO = Deno.env.get("SERVISV_DEPTO") || "03"; // La Libertad
const SERVISV_MUNICIPIO = Deno.env.get("SERVISV_MUNICIPIO") || "18"; // CAT-013 (2024): Alcaldía correcta
// Solo dirección física (no incluir teléfono ni actividad). Siguiente variable: SERVISV_TELEFONO
const SERVISV_DIRECCION =
  Deno.env.get("SERVISV_DIRECCION") ||
  "Ciudad Marsella, quartier 1, poligono j casa 4, San Juan Opico, La Libertad";
const SERVISV_TELEFONO = Deno.env.get("SERVISV_TELEFONO") || "74701132";
const SERVISV_CORREO =
  Deno.env.get("SERVISV_CORREO") || "facturacion@servisv.com";
const SERVISV_COD_ESTABLE = Deno.env.get("SERVISV_COD_ESTABLE") || "M001";
const SERVISV_COD_PUNTO_VENTA =
  Deno.env.get("SERVISV_COD_PUNTO_VENTA") || "P001";
const DTE_FIRMADOR_URL = (
  Deno.env.get("DTE_FIRMADOR_URL") || "http://localhost:8080"
).trim();
const DTE_USAR_SERVICIO_FIRMADOR =
  Deno.env.get("DTE_USAR_SERVICIO_FIRMADOR") === "true";
const DTE_CERTIFICADO_PASSWORD = Deno.env.get("DTE_CERTIFICADO_PASSWORD") || "";

// ============================================================================
// CONSTANTES DTE (Valores estándar del Ministerio de Hacienda)
// ============================================================================
const TIPO_DOCUMENTO_NIT = "36"; // Código MH para NIT
const TIPO_DOCUMENTO_DUI = "13"; // Código MH para DUI
const CODIGO_TRIBUTO_IVA = "20"; // Código MH para IVA
const CODIGO_FORMA_PAGO_CONTADO = "01"; // Código MH para pago contado
const TIPO_ITEM_SERVICIO = 2; // Código MH: 2 = Servicio
const UNIDAD_MEDIDA_SERVICIO = 99; // Código MH: 99 = Servicios
const TIPO_ESTABLECIMIENTO_CASA_MATRIZ = "01"; // Código MH: 01 = Casa Matriz
const CONDICION_OPERACION_CONTADO = 1; // Código MH: 1 = Contado

// Valores por defecto configurables
const RECEPTOR_COD_ACTIVIDAD_DEFAULT =
  Deno.env.get("RECEPTOR_COD_ACTIVIDAD") || "62010";
const RECEPTOR_DESC_ACTIVIDAD_DEFAULT =
  Deno.env.get("RECEPTOR_DESC_ACTIVIDAD") || "Servicios digitales";
const RECEPTOR_TELEFONO_DEFAULT = Deno.env.get("RECEPTOR_TELEFONO") || "";
const RECEPTOR_DEPTO_DEFAULT = Deno.env.get("RECEPTOR_DEPTO_DEFAULT") || "06"; // San Salvador
const RECEPTOR_MUNICIPIO_DEFAULT =
  Deno.env.get("RECEPTOR_MUNICIPIO_DEFAULT") || "01";
const RECEPTOR_DIRECCION_DEFAULT =
  Deno.env.get("RECEPTOR_DIRECCION_DEFAULT") || "";
const RECEPTOR_NUM_DOC_DEFAULT =
  Deno.env.get("RECEPTOR_NUM_DOC_DEFAULT") || "000000000";
const RECEPTOR_NRC_DEFAULT = Deno.env.get("RECEPTOR_NRC_DEFAULT") || "1";

// ============================================================================
// FUNCIONES DTE: AUTENTICACIÓN
// ============================================================================

let tokenCache: { token: string; expiresAt: number } | null = null;
let authDebugFingerprintLogged = false;
let runtimeDebugLogged = false;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

async function logEgressDebugInfo(prefix: string) {
  try {
    const region =
      Deno.env.get("SB_REGION") ||
      Deno.env.get("REGION") ||
      Deno.env.get("DENO_REGION") ||
      "(desconocida)";
    console.log(`${prefix} Runtime region:`, region);
  } catch {
    // ignore
  }

  try {
    const ipRes = await fetch("https://api.ipify.org?format=json");
    if (ipRes.ok) {
      const ipJson = await ipRes.json().catch(() => null);
      console.log(`${prefix} Egress IP (ipify):`, ipJson?.ip || "(no parseable)");
    } else {
      console.log(`${prefix} Egress IP (ipify) status:`, ipRes.status);
    }
  } catch (e) {
    console.log(`${prefix} No se pudo obtener egress IP:`, e?.message || e);
  }
}

async function getValidToken(
  credentials: { user: string; pwd: string },
  environment: "TEST" | "PROD" = "TEST"
): Promise<string> {
  if (!runtimeDebugLogged) {
    runtimeDebugLogged = true;
    console.log("🔎 Runtime debug (create-invoice):");
    console.log("  - DTE_MH_API_URL:", DTE_MH_API_URL);
    console.log("  - DTE_AMBIENTE:", DTE_AMBIENTE);
    await logEgressDebugInfo("🛰️");
  }

  const user = (credentials.user || "").trim();
  const pwd = (credentials.pwd || "").trim();

  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    console.log("✓ Usando token en cache");
    return tokenCache.token;
  }

  if (!authDebugFingerprintLogged) {
    authDebugFingerprintLogged = true;
    try {
      const userHash = (await sha256Hex(user)).slice(0, 12);
      const pwdHash = (await sha256Hex(pwd)).slice(0, 12);
      const urlHash = (await sha256Hex(DTE_MH_API_URL)).slice(0, 12);
      console.log("🧪 Fingerprint auth (no sensible):");
      console.log("  - user_sha256_12:", userHash);
      console.log("  - pwd_sha256_12:", pwdHash);
      console.log("  - mh_url_sha256_12:", urlHash);
    } catch (e) {
      console.warn("⚠️ No se pudo generar fingerprint de auth:", e?.message || e);
    }
  }

  console.log("⚡ Solicitando nuevo token al MH...");
  const authUrl = `${DTE_MH_API_URL}/seguridad/auth`;

  try {
    const bodyParams = new URLSearchParams({
      user,
      pwd,
    }).toString();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout

    console.log("📤 Conectando a:", authUrl);

    const response = await fetch(authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; ServiSV-Client/1.0)",
        "Accept": "application/json",
      },
      body: bodyParams,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const rawText = await response.text();

    if (!response.ok) {
      console.error(`❌ Error HTTP ${response.status} en Auth:`, rawText.slice(0, 500));
      if (response.status === 403) {
        throw new Error(
          "MH Auth 403 Forbidden: credenciales incorrectas (DTE_USER/DTE_PASSWORD), URL incorrecta (DTE_MH_API_URL: pruebas vs producción), o IP de Supabase no autorizada por Hacienda. Revisa los secrets de la Edge Function."
        );
      }
      throw new Error(`Error MH Auth: ${response.status} ${response.statusText}`);
    }

    // Log para ver exactamente qué devuelve Hacienda (útil si no devuelve token)
    console.log("📥 Respuesta raw MH (primeros 800 chars):", rawText.slice(0, 800));

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("❌ MH no devolvió JSON válido. Respuesta raw:", rawText.slice(0, 500));
      throw new Error("MH no devolvió JSON válido (¿URL correcta? DTE_MH_API_URL)");
    }

    // MH puede devolver token en body.token, token, accessToken o data.token
    const token =
      data.body?.token ??
      data.token ??
      data.accessToken ??
      data.data?.token;

    if (!token || typeof token !== "string") {
      console.error("❌ MH no devolvió token. Respuesta parseada:", JSON.stringify(data, null, 2));
      console.error("   URL usada:", authUrl);
      console.error("   Revisa: DTE_USER, DTE_PASSWORD, DTE_MH_API_URL en Supabase Edge Function Secrets.");
      throw new Error("MH no devolvió token");
    }
    tokenCache = {
      token,
      expiresAt: Date.now() + 14 * 60 * 1000,
    };

    console.log("✅ Autenticación exitosa con MH");
    return token;
  } catch (error: any) {
    if (error.name === "AbortError") {
      console.error("❌ TIMEOUT: Hacienda no respondió en 15 segundos. Posible bloqueo de IP.");
      throw new Error("Timeout conectando con Hacienda. Tu IP de Supabase podría estar bloqueada.");
    }
    console.error("❌ Error crítico en getValidToken:", error.message);
    throw error;
  }
}

// ============================================================================
// FUNCIONES DTE: FIRMA
// ============================================================================

async function firmarDTEAuto(
  dteJson: any,
  options: {
    nit: string;
    certificatePassword: string;
    firmadorUrl: string;
    usarServicioFirmador: boolean;
  }
): Promise<string> {
  const { nit, certificatePassword, firmadorUrl, usarServicioFirmador } =
    options;

  if (!usarServicioFirmador) {
    console.warn(
      "⚠️  Servicio firmador deshabilitado, generando firma simulada para ambiente de pruebas"
    );

    // Generar firma simulada en formato JWS (JSON Web Signature)
    // Formato: header.payload.signature (base64url)

    // Header JWS estándar
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    // Payload es el DTE JSON
    const payload = dteJson;

    // Convertir a base64url
    const base64url = (obj: any) => {
      const json = JSON.stringify(obj);
      const base64 = btoa(unescape(encodeURIComponent(json)));
      return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    };

    const headerB64 = base64url(header);
    const payloadB64 = base64url(payload);

    // Firma simulada (en producción esto sería la firma RSA real)
    const signatureSimulada =
      "FIRMA_SIMULADA_PRUEBAS_" + Math.random().toString(36).substring(2);
    const signatureB64 = base64url({ signature: signatureSimulada });

    // Formato JWS completo
    const jws = `${headerB64}.${payloadB64}.${signatureB64}`;

    console.log("✓ Firma simulada generada (formato JWS)");
    return jws;
  }

  console.log("🔏 Firmando DTE con servicio firmador...");

  // Limpiar la URL del firmador (eliminar espacios y barras finales)
  const firmadorUrlLimpio = firmadorUrl.trim().replace(/\/+$/, "");

  console.log("  - firmadorUrl (original):", firmadorUrl);
  console.log("  - firmadorUrl (limpio):", firmadorUrlLimpio);
  console.log("  - NIT original:", nit);
  console.log("  - NIT sin guiones:", nit.replace(/-/g, ""));
  console.log(
    "  - passwordPri:",
    certificatePassword ? "***configurada***" : "VACÍA"
  );

  try {
    const nitSinGuiones = nit.replace(/-/g, "");
    const requestBody = {
      nit: nitSinGuiones,
      activo: true,
      passwordPri: certificatePassword,
      dteJson: dteJson,
    };

    console.log(
      "  - Request al firmador:",
      JSON.stringify({
        nit: nitSinGuiones,
        activo: true,
        passwordPri: certificatePassword ? "***" : "",
        dteJson: "...",
      })
    );

    // Construir URL final asegurándonos de que no haya espacios
    const urlFinal = `${firmadorUrlLimpio}/firma/firmardocumento/`;
    console.log("  - URL final:", urlFinal);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 s timeout firmador

    const response = await fetch(urlFinal, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌❌❌ ERROR HTTP EN FIRMADO DTE ❌❌❌");
      console.error("URL:", urlFinal);
      console.error("HTTP Status:", response.status);
      console.error("HTTP Status Text:", response.statusText);
      console.error("Respuesta del firmador:", errorText);
      
      throw new Error(`Error al firmar DTE: ${response.status} - ${errorText}`);
    }

    console.log("  - Firmador respondió OK, parseando JSON...");
    const responseData = await response.json();
    console.log("  - JSON parseado OK, keys:", responseData ? Object.keys(responseData) : "null");
    console.log("📋 Respuesta del firmador:", JSON.stringify(responseData, null, 2));
    
    if (responseData.status === "OK" && responseData.body) {
      const firma = responseData.body;
      console.log("✅ DTE firmado exitosamente");
      console.log("   Longitud firma:", firma.length);
      console.log("  - Retornando firma al caller (longitud:", firma.length, ")");
      return firma;
    } else {
      console.error("❌ Respuesta del firmador no válida:", JSON.stringify(responseData, null, 2));
      throw new Error(
        `Error en respuesta del firmador: ${JSON.stringify(responseData)}`
      );
    }
  } catch (error: any) {
    console.error("❌❌❌ EXCEPCIÓN EN firmarDTEAuto ❌❌❌");
    console.error("Tipo:", typeof error);
    console.error("Mensaje:", error?.message || "Sin mensaje");
    console.error("Stack:", error?.stack || "Sin stack");
    if (error?.name === "AbortError") {
      console.error("Causa: TIMEOUT (firmador no respondió en 30 s)");
    }
    console.error("Error completo:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}

// ============================================================================
// FUNCIONES DTE: TRANSMISIÓN
// ============================================================================

async function transmitirDTE(
  dteFirmado: string,
  nitEmisor: string,
  token: string,
  ambiente: Ambiente,
  tipoDte: "01" | "03" | "05" | "06" | "14",
  version: number
): Promise<DTEResponse> {
  console.log("📤 Transmitiendo DTE al Ministerio de Hacienda...");
  const transmissionUrl = `${DTE_MH_API_URL}/fesv/recepciondte`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 s timeout MH

    const response = await fetch(transmissionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: token,
        "User-Agent": "ServiSV-DTE-Client/1.0",
      },
      body: JSON.stringify({
        ambiente: ambiente,
        idEnvio: Math.floor(Math.random() * 1000000),
        version: version,
        tipoDte: tipoDte,
        documento: dteFirmado,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌❌❌ ERROR HTTP EN TRANSMISIÓN DTE ❌❌❌");
      console.error("URL:", transmissionUrl);
      console.error("HTTP Status:", response.status);
      console.error("HTTP Status Text:", response.statusText);
      console.error("Respuesta del MH:", errorText);
      
      throw new Error(
        `Error al transmitir DTE: ${response.status} - ${errorText}`
      );
    }

    const data: DTEResponse = await response.json();
    console.log("✅ DTE transmitido exitosamente, respuesta del MH:");
    console.log("   Estado:", data.estado);
    console.log("   Código Generación:", data.codigoGeneracion);
    console.log("   Sello Recibido:", data.selloRecibido);
    console.log("   Descripción:", data.descripcionMsg);
    console.log("   Respuesta completa:", JSON.stringify(data, null, 2));

    return data;
  } catch (error: any) {
    console.error("❌❌❌ EXCEPCIÓN EN transmitirDTE ❌❌❌");
    console.error("Tipo:", typeof error);
    console.error("Mensaje:", error?.message || "Sin mensaje");
    console.error("Stack:", error?.stack || "Sin stack");
    if (error?.name === "AbortError") {
      console.error("Causa: TIMEOUT (MH no respondió en 20 s)");
    }
    console.error("Error completo:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    throw error;
  }
}

function numeroALetras(numero: number): string {
  let entero = Math.floor(numero);
  const decimal = Math.round((numero - entero) * 100);

  if (entero === 0) {
    return `CERO DÓLARES CON ${decimal.toString().padStart(2, "0")}/100`;
  }

  const unidades = [
    "",
    "UN",
    "DOS",
    "TRES",
    "CUATRO",
    "CINCO",
    "SEIS",
    "SIETE",
    "OCHO",
    "NUEVE",
  ];
  const decenas = [
    "",
    "",
    "VEINTE",
    "TREINTA",
    "CUARENTA",
    "CINCUENTA",
    "SESENTA",
    "SETENTA",
    "OCHENTA",
    "NOVENTA",
  ];
  const centenas = [
    "",
    "CIENTO",
    "DOSCIENTOS",
    "TRESCIENTOS",
    "CUATROCIENTOS",
    "QUINIENTOS",
    "SEISCIENTOS",
    "SETECIENTOS",
    "OCHOCIENTOS",
    "NOVECIENTOS",
  ];
  const especiales = [
    "DIEZ",
    "ONCE",
    "DOCE",
    "TRECE",
    "CATORCE",
    "QUINCE",
    "DIECISÉIS",
    "DIECISIETE",
    "DIECIOCHO",
    "DIECINUEVE",
  ];

  function convertirGrupo(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "CIEN";

    let resultado = "";
    const c = Math.floor(n / 100);
    if (c > 0) {
      resultado += centenas[c];
      if (n % 100 !== 0) resultado += " ";
    }

    const du = n % 100;
    if (du >= 10 && du < 20) {
      resultado += especiales[du - 10];
    } else {
      const d = Math.floor(du / 10);
      const u = du % 10;
      if (d > 0) {
        resultado += decenas[d];
        if (u > 0) resultado += " Y ";
      }
      if (u > 0) {
        resultado += unidades[u];
      }
    }

    return resultado;
  }

  let letras = "";
  if (entero >= 1000) {
    const miles = Math.floor(entero / 1000);
    if (miles === 1) {
      letras += "MIL ";
    } else {
      letras += convertirGrupo(miles) + " MIL ";
    }
    entero = entero % 1000;
  }

  if (entero > 0) {
    letras += convertirGrupo(entero);
  }

  letras = letras.trim();
  return `${letras} DÓLARES CON ${decimal.toString().padStart(2, "0")}/100`;
}

// ============================================================================
// FUNCIONES DTE: GENERADOR
// ============================================================================

interface GenerarCCFOptions {
  serviceAmount: number;
  platformCommissionBuyer: number;
  platformCommissionSeller: number;
  paymentGatewayCommission: number;
  totalCommissions: number;
  ivaAmount: number;
  totalAmount: number;
  fiscalData: FiscalData;
  concept: string;
  createdAt: string;
}

// Función para redondear correctamente a 2 decimales
function redondear(valor: number): number {
  // Usar notación exponencial para evitar errores de precisión de punto flotante en JS
  return Number(Math.round(Number(valor + "e2")) + "e-2");
}

function generarNumeroControl(tipoDte: string, ambiente: Ambiente): string {
  // Formato según MH: DTE-TT-EEEEEEEE-CCCCCCCCCCCCCCC
  // Total: 31 caracteres exactos
  // DTE (3) + - (1) + TipoDTE (2) + - (1) + Establecimiento [A-Z0-9]{8} + - (1) + Correlativo [0-9]{15} = 31
  // Patrón: ^DTE-03-[A-Z0-9]{8}-[0-9]{15}$ para tipo 03
  // Patrón: ^DTE-01-[A-Z0-9]{8}-[0-9]{15}$ para tipo 01

  // Generar correlativo: 15 dígitos numéricos
  const timestamp = Date.now().toString();
  // Usar los últimos 15 dígitos del timestamp, rellenar con ceros a la izquierda
  let correlativo = timestamp.slice(-15);
  if (correlativo.length < 15) {
    correlativo = correlativo.padStart(15, "0");
  }
  correlativo = correlativo.substring(0, 15);

  // Validar que el correlativo tenga exactamente 15 dígitos
  if (!/^[0-9]{15}$/.test(correlativo)) {
    throw new Error(
      `Correlativo inválido: debe ser exactamente 15 dígitos, generado: ${correlativo} (${correlativo.length} chars)`
    );
  }

  // Según manual del MH: 4 dígitos alfanuméricos (Casa Matriz/Sucursal/Bodega)
  // + 4 dígitos alfanuméricos (Punto de Venta) = 8 caracteres totales
  // Formato: CCCCPPPP donde C=Código establecimiento, P=Punto de venta
  // IMPORTANTE: El establecimiento debe ser exactamente 8 caracteres alfanuméricos [A-Z0-9]{8}
  // Ejemplo válido: "M001P001" (M001 = establecimiento, P001 = punto de venta)
  // NOTA: Usar los mismos códigos en ambiente de pruebas y producción

  // Limpiar y formatear códigos: solo alfanuméricos [A-Z0-9]
  // Mantener letras mayúsculas y números, eliminar solo caracteres especiales
  const codEstableRaw = SERVISV_COD_ESTABLE.replace(
    /[^A-Z0-9]/gi,
    ""
  ).toUpperCase();
  const codPuntoVentaRaw = SERVISV_COD_PUNTO_VENTA.replace(
    /[^A-Z0-9]/gi,
    ""
  ).toUpperCase();

  // Si codEstableRaw tiene 8 caracteres (ej: "M001P001"), dividir: primeros 4 = establecimiento, últimos 4 = punto de venta
  let codEstable: string;
  let codPuntoVenta: string;

  if (codEstableRaw.length === 8 && codPuntoVentaRaw.length <= 4) {
    // Si establecimiento tiene 8 chars y punto de venta tiene 4 o menos, dividir establecimiento
    codEstable = codEstableRaw.substring(0, 4);
    codPuntoVenta =
      codPuntoVentaRaw.length > 0
        ? codPuntoVentaRaw.substring(0, 4)
        : codEstableRaw.substring(4, 8);
  } else if (codPuntoVentaRaw.length === 8 && codEstableRaw.length <= 4) {
    // Si punto de venta tiene 8 chars y establecimiento tiene 4 o menos, dividir punto de venta
    codPuntoVenta = codPuntoVentaRaw.substring(0, 4);
    codEstable =
      codEstableRaw.length > 0
        ? codEstableRaw.substring(0, 4)
        : codPuntoVentaRaw.substring(4, 8);
  } else {
    // Caso normal: ambos tienen 4 caracteres o menos
    codEstable = codEstableRaw.substring(0, 4);
    codPuntoVenta = codPuntoVentaRaw.substring(0, 4);
  }

  // Asegurar exactamente 4 caracteres cada uno, rellenar con ceros a la derecha si es necesario
  if (codEstable.length < 4) {
    codEstable = codEstable.padEnd(4, "0");
  }
  if (codPuntoVenta.length < 4) {
    codPuntoVenta = codPuntoVenta.padEnd(4, "0");
  }

  // Combinar: exactamente 8 caracteres alfanuméricos [A-Z0-9]
  let establecimiento = `${codEstable}${codPuntoVenta}`.toUpperCase();
  // Asegurar exactamente 8 caracteres
  if (establecimiento.length < 8) {
    establecimiento = establecimiento.padEnd(8, "0");
  } else if (establecimiento.length > 8) {
    establecimiento = establecimiento.substring(0, 8);
  }

  // Validar que el establecimiento tenga exactamente 8 caracteres alfanuméricos
  if (!/^[A-Z0-9]{8}$/.test(establecimiento)) {
    throw new Error(
      `Establecimiento inválido: debe ser exactamente 8 caracteres alfanuméricos [A-Z0-9], generado: ${establecimiento} (${establecimiento.length} chars)`
    );
  }

  // Construir número de control
  const numeroControl = `DTE-${tipoDte}-${establecimiento}-${correlativo}`;

  // Validar longitud total: debe ser exactamente 31 caracteres
  if (numeroControl.length !== 31) {
    throw new Error(
      `Número de control inválido: debe tener exactamente 31 caracteres, generado: ${numeroControl} (${numeroControl.length} chars)`
    );
  }

  // Validar formato del número de control según el patrón del esquema
  // Patrón dinámico que acepta cualquier tipo de DTE (01, 03, 14, etc.)
  const patronNumeroControl = new RegExp(
    `^DTE-${tipoDte}-[A-Z0-9]{8}-[0-9]{15}$`
  );
  if (!patronNumeroControl.test(numeroControl)) {
    throw new Error(
      `Número de control inválido: no cumple el patrón requerido. Generado: ${numeroControl} (${numeroControl.length} chars), patrón: ${patronNumeroControl}`
    );
  }

  console.log("🔢 Número de Control generado:");
  console.log("  - tipoDte:", tipoDte);
  console.log("  - ambiente:", ambiente);
  console.log("  - SERVISV_COD_ESTABLE (raw):", SERVISV_COD_ESTABLE);
  console.log("  - SERVISV_COD_PUNTO_VENTA (raw):", SERVISV_COD_PUNTO_VENTA);
  console.log(
    "  - codEstable (formateado):",
    codEstable,
    `(${codEstable.length} chars)`
  );
  console.log(
    "  - codPuntoVenta (formateado):",
    codPuntoVenta,
    `(${codPuntoVenta.length} chars)`
  );
  console.log(
    "  - establecimiento:",
    establecimiento,
    `(${establecimiento.length} chars)`
  );
  console.log("  - correlativo:", correlativo, `(${correlativo.length} chars)`);
  console.log(
    "  - numeroControl:",
    numeroControl,
    `(${numeroControl.length} chars)`
  );
  console.log("  - patrón esperado:", `DTE-${tipoDte}-[A-Z0-9]{8}-[0-9]{15}`);
  console.log("  - cumple patrón:", patronNumeroControl.test(numeroControl));
  console.log("    * DTE:", numeroControl.substring(0, 3));
  console.log("    * Guión 1:", numeroControl.substring(3, 4));
  console.log("    * Tipo DTE:", numeroControl.substring(4, 6));
  console.log("    * Guión 2:", numeroControl.substring(6, 7));
  console.log(
    "    * Establecimiento:",
    numeroControl.substring(7, 15),
    `(${numeroControl.substring(7, 15).length} chars)`
  );
  console.log("    * Guión 3:", numeroControl.substring(15, 16));
  console.log(
    "    * Correlativo:",
    numeroControl.substring(16),
    `(${numeroControl.substring(16).length} chars)`
  );

  return numeroControl;
}

// Borro este duplicate implementation y dejo solo 1

async function generarCreditoFiscal(
  options: GenerarCCFOptions,
  ambiente: Ambiente
): Promise<DTE_CreditoFiscal> {
  const now = new Date();
  const fecEmi = now.toISOString().split("T")[0];
  const horEmi = now.toTimeString().split(" ")[0];
  const codigoGeneracion = crypto.randomUUID().toUpperCase();
  const numeroControl = generarNumeroControl("03", ambiente);

  const identificacion: DTEIdentificacion = {
    version: 3,
    ambiente: ambiente,
    tipoDte: "03",
    numeroControl: numeroControl,
    codigoGeneracion: codigoGeneracion,
    tipoModelo: 1,
    tipoOperacion: 1,
    tipoContingencia: null,
    motivoContin: null,
    fecEmi: fecEmi,
    horEmi: horEmi,
    tipoMoneda: "USD",
  };

  const emisor: DTEEmisor = {
    nit: SERVISV_NIT.replace(/-/g, ""),
    nrc: SERVISV_NRC.replace(/-/g, ""),
    nombre: SERVISV_RAZON_SOCIAL,
    codActividad: SERVISV_COD_ACTIVIDAD,
    descActividad: SERVISV_DESC_ACTIVIDAD,
    nombreComercial: SERVISV_NOMBRE_COMERCIAL,
    tipoEstablecimiento: TIPO_ESTABLECIMIENTO_CASA_MATRIZ,
    direccion: {
      departamento: SERVISV_DEPTO,
      municipio: SERVISV_MUNICIPIO,
      complemento: SERVISV_DIRECCION,
    },
    telefono: SERVISV_TELEFONO,
    correo: SERVISV_CORREO,
    codEstableMH: null,
    codEstable: SERVISV_COD_ESTABLE,
    codPuntoVentaMH: null,
    codPuntoVenta: SERVISV_COD_PUNTO_VENTA,
  };

  // Según esquema fe-ccf-v3.json, el receptor DEBE tener:
  // nit, nrc, nombre, codActividad, descActividad, nombreComercial, direccion, telefono, correo
  // IMPORTANTE: Para tipo 03 (Crédito Fiscal), NO se usa tipoDocumento/numDocumento, sino nit/nrc
  // Formatear NRC: máximo 8 dígitos, rellenar con ceros a la izquierda
  let nrcFormateado =
    options.fiscalData.numero_registro_contribuyente?.replace(/-/g, "") ||
    RECEPTOR_NRC_DEFAULT;
  nrcFormateado = nrcFormateado
    .padStart(Math.min(nrcFormateado.length, 8), "0")
    .substring(0, 8);

  // Asegurar que departamento y municipio sean códigos de 2 dígitos (strings)
  const deptoRaw = options.fiscalData.departamento || RECEPTOR_DEPTO_DEFAULT;
  const muniRaw = options.fiscalData.municipio || RECEPTOR_MUNICIPIO_DEFAULT;
  const deptoFormateado = String(deptoRaw).padStart(2, "0").substring(0, 2);
  const muniFormateado = String(muniRaw).padStart(2, "0").substring(0, 2);

  // Para tipo 03, el receptor debe tener nit (no tipoDocumento/numDocumento)
  // El NIT debe cumplir el patrón: ^([0-9]{14}|[0-9]{9})$
  // NUEVA LÓGICA: Soportar persona natural con DUI o persona jurídica con NIT
  // - Si tiene NIT: usarlo directamente (persona jurídica o natural con actividad económica)
  // - Si no tiene NIT pero tiene DUI: usar el DUI como NIT (9 dígitos)
  let nitReceptor = (options.fiscalData.nit || "").replace(/-/g, "");
  if (!nitReceptor && options.fiscalData.dui) {
    // Si no hay NIT pero hay DUI, usar el DUI (persona natural)
    nitReceptor = options.fiscalData.dui.replace(/-/g, "");
    console.log(`📝 CCF - Usando DUI como NIT para persona natural: ${nitReceptor}`);
  }
  
  if (!nitReceptor || (nitReceptor.length !== 9 && nitReceptor.length !== 14)) {
    throw new Error(
      `NIT/DUI del receptor inválido: debe tener 9 o 14 dígitos, recibido: ${nitReceptor}`
    );
  }

  // Para tipo 03, nombreComercial es requerido según el esquema
  const nombreComercialReceptor =
    (options.fiscalData as any).nombre_comercial ||
    options.fiscalData.nombre_completo ||
    "Consumidor Final";

  const receptor: DTEReceptor = {
    nit: nitReceptor, // Para tipo 03, usar nit directamente
    nrc: nrcFormateado,
    nombre: options.fiscalData.nombre_completo,
    codActividad: (options.fiscalData as any).cod_actividad || RECEPTOR_COD_ACTIVIDAD_DEFAULT,
    descActividad: (options.fiscalData as any).desc_actividad || RECEPTOR_DESC_ACTIVIDAD_DEFAULT,
    nombreComercial: nombreComercialReceptor, // Requerido para tipo 03
    direccion: {
      departamento: deptoFormateado,
      municipio: muniFormateado,
      complemento: options.fiscalData.direccion || RECEPTOR_DIRECCION_DEFAULT,
    },
    telefono: (options.fiscalData as any).telefono || RECEPTOR_TELEFONO_DEFAULT || null,
    correo: options.fiscalData.email,
  };

  console.log("👤 Datos del RECEPTOR (comprador - Crédito Fiscal):");
  console.log("  - NIT:", receptor.nit, `(${receptor.nit?.length || 0} chars)`);
  console.log("  - NRC:", receptor.nrc, `(${receptor.nrc?.length || 0} chars)`);
  console.log("  - Nombre:", receptor.nombre);
  console.log("  - Departamento:", receptor.direccion?.departamento || "N/A");
  console.log("  - Municipio:", receptor.direccion?.municipio || "N/A");
  console.log("  - Email:", receptor.correo);

  // REGLA DE ORO PARA CCF (tipo 03):
  // - precioUni y ventaGravada deben ser SIN IVA (valor neto)
  // - El IVA se calcula sobre la suma de ventas gravadas
  // - totalPagar = montoTotalOperacion - retenciones (sin retenciones = montoTotalOperacion)

  // Calcular venta gravada (sin IVA) - esto es el precio neto
  const ventaGravada = redondear(
    options.platformCommissionBuyer + options.paymentGatewayCommission
  );

  // Calcular IVA sobre la venta gravada (13% del neto)
  // IMPORTANTE: Calcular sobre la suma de ventas gravadas, luego redondear
  const ivaCalculado = redondear(ventaGravada * 0.13);

  console.log("💰 Cálculo CCF (tipo 03) - Valores SIN IVA en cuerpoDocumento:");
  console.log("  - Venta Gravada (neto, sin IVA):", ventaGravada);
  console.log("  - IVA (13% sobre venta gravada):", ivaCalculado);

  const cuerpoDocumento: DTECuerpoDocumento[] = [
    {
      numItem: 1,
      tipoItem: TIPO_ITEM_SERVICIO,
      numeroDocumento: null,
      codigo: null,
      codTributo: null,
      descripcion: options.concept,
      cantidad: 1,
      uniMedida: UNIDAD_MEDIDA_SERVICIO,
      precioUni: ventaGravada, // SIN IVA - valor neto
      montoDescu: 0,
      ventaNoSuj: 0,
      ventaExenta: 0,
      ventaGravada: ventaGravada, // SIN IVA - precioUni * cantidad
      tributos: [CODIGO_TRIBUTO_IVA],
      psv: 0,
      noGravado: 0,
      // NOTA: Para CCF v3, NO existe el campo ivaItem en cuerpoDocumento
    },
  ];

  // FÓRMULA CORRECTA DE HACIENDA PARA CCF (tipo 03):
  // montoTotalOperacion = ventaGravada + IVA
  // totalPagar = montoTotalOperacion - ivaRete1 - reteRenta + saldoFavor
  //
  // Ejemplo: si ventaGravada=13.85, IVA=1.80, entonces:
  // - montoTotalOperacion = 13.85 + 1.80 = 15.65
  // - totalPagar = 15.65 - 0 - 0 = 15.65
  //
  // IMPORTANTE:
  // - ivaPerci1 es un campo REQUERIDO pero solo informativo
  // - ivaPerci1 NO se suma de nuevo porque ya está en montoTotalOperacion
  // - totalPagar = montoTotalOperacion (cuando no hay retenciones)

  const ivaRete1 = 0;
  const reteRenta = 0;
  const totalNoGravado = 0;

  // subTotal = ventaGravada (neto, sin IVA)
  const subTotal = ventaGravada;

  // Suma de Tributos = ivaCalculado (el valor del IVA en el array tributos)
  const sumaTributos = ivaCalculado;

  // IMPORTANTE: ivaPerci1 es SOLO para agentes de percepción del IVA
  // Para casos normales (como ServiSV), debe ser 0.00
  // Fuente: Manual DTE v1.2, Página 57 - Campo "IVA Percibido"
  const ivaPerci1 = 0;

  // montoTotalOperacion = ventaGravada + IVA calculado
  const montoTotalOperacion = redondear(ventaGravada + ivaCalculado);

  // Fórmula de Hacienda para totalPagar en CCF:
  // totalPagar = montoTotalOperacion + ivaPerci1 - ivaRete1 - reteRenta + saldoFavor
  //
  // En nuestro caso (sin percepción, retenciones ni saldo a favor):
  // totalPagar = montoTotalOperacion = ventaGravada + IVA = 13.85 + 1.80 = 15.65
  const totalPagar = redondear(montoTotalOperacion + ivaPerci1 - ivaRete1 - reteRenta);

  console.log("💰 Validación de cálculo CCF (tipo 03):");
  console.log("  - Venta Gravada (neto, sin IVA):", ventaGravada);
  console.log("  - IVA (13% sobre venta gravada):", ivaCalculado);
  console.log("  - subTotal:", subTotal);
  console.log("  - Suma de Tributos:", sumaTributos);
  console.log("  - ivaPerci1 (0 para no agentes):", ivaPerci1);
  console.log("  - ivaRete1:", ivaRete1);
  console.log("  - reteRenta:", reteRenta);
  console.log("  - Monto Total Operación (ventaGravada + IVA):", montoTotalOperacion);
  console.log("  - Total Pagar (montoTotalOperacion + ivaPerci1 - ivaRete1 - reteRenta):", totalPagar);
  const totalLetras = numeroALetras(totalPagar);

  const resumen: DTEResumen = {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada: ventaGravada, // Suma de todas las ventas gravadas (sin IVA)
    subTotalVentas: ventaGravada, // Suma de operaciones sin impuestos
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    porcentajeDescuento: 0,
    totalDescu: 0,
    tributos: [
      {
        codigo: CODIGO_TRIBUTO_IVA, // Código para IVA según MH (20 = IVA)
        descripcion: "Impuesto al Valor Agregado 13%",
        valor: ivaCalculado, // IVA calculado sobre la suma de ventas gravadas
      },
    ],
    subTotal: subTotal, // Sub-total sin impuestos (ventaGravada)
    ivaPerci1: ivaPerci1, // REQUERIDO para CCF v3 - IVA Percibido (0.00 para no agentes)
    ivaRete1: ivaRete1, // REQUERIDO en CCF (aunque sea 0)
    reteRenta: reteRenta, // REQUERIDO en CCF (aunque sea 0)
    montoTotalOperacion: montoTotalOperacion, // totalGravada + IVA (total con IVA)
    totalNoGravado: totalNoGravado,
    // NOTA: Para CCF v3, NO existe el campo totalIva en resumen
    // Fórmula correcta: totalPagar = montoTotalOperacion + ivaPerci1 - ivaRete1 - reteRenta
    totalPagar: totalPagar, // montoTotalOperacion cuando ivaPerci1=0 y no hay retenciones
    totalLetras: totalLetras,
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: totalPagar,
        referencia: null,
        plazo: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };

  const dte: DTE_CreditoFiscal = {
    identificacion,
    documentoRelacionado: null,
    emisor,
    receptor,
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen,
    extension: {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: null,
      placaVehiculo: null,
    },
    apendice: null,
  };

  return dte;
}

// Interfaz para Factura Consumidor Final (tipo 01)
interface DTESujetoExcluido {
  tipoDocumento: string; // "36", "13", "02", "03", "37"
  numDocumento: string;
  nombre: string;
  codActividad: string | null;
  descActividad: string | null;
  direccion: {
    departamento: string;
    municipio: string;
    complemento: string;
  };
  telefono: string | null;
  correo: string;
}

interface DTE_FacturaSujetoExcluido {
  identificacion: DTEIdentificacion;
  emisor: DTEEmisor;
  sujetoExcluido: DTESujetoExcluido;
  cuerpoDocumento: Array<{
    numItem: number;
    tipoItem: number;
    cantidad: number;
    codigo: string | null;
    uniMedida: number;
    descripcion: string;
    precioUni: number;
    montoDescu: number;
    compra: number; // En lugar de ventaGravada
  }>;
  resumen: {
    totalCompra: number; // En lugar de totalGravada
    descu: number;
    totalDescu: number; // IMPORTANTE: Debe ser number (0 si no hay descuentos), no null
    subTotal: number;
    ivaRete1: number;
    reteRenta: number;
    totalPagar: number;
    totalLetras: string;
    condicionOperacion: number;
    pagos: Array<{
      codigo: string;
      montoPago: number;
      referencia: string | null;
      plazo: string | null;
      periodo: number | null;
    }>;
    observaciones: string | null;
  };
  apendice?: Array<{
    campo: string;
    etiqueta: string;
    valor: string;
  }> | null;
}

interface DTE_FacturaConsumidorFinal {
  identificacion: DTEIdentificacion;
  documentoRelacionado?: any[] | null;
  emisor: DTEEmisor;
  receptor: DTEReceptor;
  otrosDocumentos?: any[] | null;
  ventaTercero?: any | null;
  cuerpoDocumento: DTECuerpoDocumento[];
  resumen: DTEResumen;
  extension?: {
    nombEntrega?: string | null;
    docuEntrega?: string | null;
    nombRecibe?: string | null;
    docuRecibe?: string | null;
    observaciones?: string | null;
    placaVehiculo?: string | null;
  } | null;
  apendice?: any[] | null;
}

async function generarFacturaConsumidorFinal(
  options: GenerarCCFOptions,
  ambiente: Ambiente
): Promise<DTE_FacturaConsumidorFinal> {
  const now = new Date();
  const fecEmi = now.toISOString().split("T")[0];
  const horEmi = now.toTimeString().split(" ")[0];
  const codigoGeneracion = crypto.randomUUID().toUpperCase();
  const numeroControl = generarNumeroControl("01", ambiente);

  const identificacion: DTEIdentificacion = {
    version: 1, // Factura tipo 01 usa versión 1
    ambiente: ambiente,
    tipoDte: "01",
    numeroControl: numeroControl,
    codigoGeneracion: codigoGeneracion,
    tipoModelo: 1,
    tipoOperacion: 1,
    tipoContingencia: null,
    motivoContin: null,
    fecEmi: fecEmi,
    horEmi: horEmi,
    tipoMoneda: "USD",
  };

  // Según el esquema fe-fc-v1.json:
  // - codEstable: minLength: 4, maxLength: 4 (exactamente 4 caracteres)
  // - codPuntoVenta: minLength: 1, maxLength: 15
  const codEstableFormateado = SERVISV_COD_ESTABLE.padStart(4, "0").substring(
    0,
    4
  );
  const codPuntoVentaFormateado = SERVISV_COD_PUNTO_VENTA.substring(0, 15);

  const emisor: DTEEmisor = {
    nit: SERVISV_NIT.replace(/-/g, ""),
    nrc: SERVISV_NRC.replace(/-/g, ""),
    nombre: SERVISV_RAZON_SOCIAL,
    codActividad: SERVISV_COD_ACTIVIDAD,
    descActividad: SERVISV_DESC_ACTIVIDAD,
    nombreComercial: SERVISV_NOMBRE_COMERCIAL,
    tipoEstablecimiento: TIPO_ESTABLECIMIENTO_CASA_MATRIZ,
    direccion: {
      departamento: SERVISV_DEPTO,
      municipio: SERVISV_MUNICIPIO,
      complemento: SERVISV_DIRECCION,
    },
    telefono: SERVISV_TELEFONO,
    correo: SERVISV_CORREO,
    codEstableMH: null,
    codEstable: codEstableFormateado, // Exactamente 4 caracteres
    codPuntoVentaMH: null,
    codPuntoVenta: codPuntoVentaFormateado, // Máximo 15 caracteres
  };

  // Para factura tipo 01, el receptor puede ser consumidor final
  const deptoRaw = options.fiscalData.departamento || RECEPTOR_DEPTO_DEFAULT;
  const muniRaw = options.fiscalData.municipio || RECEPTOR_MUNICIPIO_DEFAULT;
  const deptoFormateado = String(deptoRaw).padStart(2, "0").substring(0, 2);
  const muniFormateado = String(muniRaw).padStart(2, "0").substring(0, 2);

  // Determinar tipoDocumento y numDocumento según el esquema fe-fc-v1.json
  // Para tipo 01 (Factura Consumidor Final):
  // - Si tiene NIT (tipoDocumento="36"), numDocumento debe cumplir: ^([0-9]{14}|[0-9]{9})$
  // - Si tiene DUI (tipoDocumento="13"), numDocumento debe cumplir: ^[0-9]{8}-[0-9]{1}$ (con guión)
  // - Si tipoDocumento NO es "36", entonces nrc debe ser null
  const tieneNIT = !!options.fiscalData?.nit;
  const tipoDocumento = tieneNIT ? TIPO_DOCUMENTO_NIT : TIPO_DOCUMENTO_DUI;

  let numDocumento: string;
  if (tieneNIT) {
    // Para NIT: sin guiones, debe tener 9 o 14 dígitos
    numDocumento = (options.fiscalData.nit || "").replace(/-/g, "");
    if (numDocumento.length !== 9 && numDocumento.length !== 14) {
      throw new Error(
        `NIT del receptor inválido para tipo 01: debe tener 9 o 14 dígitos, recibido: ${numDocumento}`
      );
    }
  } else {
    // Para DUI: formato con guión ^[0-9]{8}-[0-9]{1}$
    const duiRaw =
      options.fiscalData?.dui?.replace(/-/g, "") || RECEPTOR_NUM_DOC_DEFAULT;
    if (duiRaw.length === 9) {
      // Formato: 12345678-9
      numDocumento = `${duiRaw.substring(0, 8)}-${duiRaw.substring(8, 9)}`;
    } else if (duiRaw.length === 8) {
      // Si solo tiene 8 dígitos, agregar un 0 al final
      numDocumento = `${duiRaw}-0`;
    } else {
      throw new Error(
        `DUI del receptor inválido para tipo 01: debe tener 8 o 9 dígitos, recibido: ${duiRaw}`
      );
    }
  }

  // Si tipoDocumento NO es "36" (NIT), entonces nrc debe ser null
  const nrcReceptor =
    tipoDocumento === TIPO_DOCUMENTO_NIT
      ? options.fiscalData.numero_registro_contribuyente?.replace(/-/g, "") ||
        null
      : null;

  const receptor: DTEReceptor = {
    tipoDocumento: tipoDocumento,
    numDocumento: numDocumento,
    nrc: nrcReceptor, // null si no es NIT, o el NRC si es NIT
    nombre: options.fiscalData.nombre_completo || "Consumidor Final",
    codActividad: RECEPTOR_COD_ACTIVIDAD_DEFAULT,
    descActividad: RECEPTOR_DESC_ACTIVIDAD_DEFAULT,
    direccion: {
      departamento: deptoFormateado,
      municipio: muniFormateado,
      complemento: options.fiscalData.direccion || RECEPTOR_DIRECCION_DEFAULT,
    },
    telefono: RECEPTOR_TELEFONO_DEFAULT || null,
    correo: options.fiscalData.email,
  };

  console.log("👤 Datos del RECEPTOR (Consumidor Final):");
  console.log("  - Tipo Documento:", receptor.tipoDocumento);
  console.log("  - Num Documento:", receptor.numDocumento);
  console.log("  - Nombre:", receptor.nombre);
  console.log("  - Email:", receptor.correo);

  // Para tipo 01 (Factura Consumidor Final), REGLA DE ORO:
  // ventaGravada SIEMPRE debe ser igual a precioUni * cantidad (si no hay descuentos)
  // Ambos valores (ventaGravada y precioUni * cantidad) deben INCLUIR el IVA
  // El IVA solo se "muestra" en ivaItem para fines informativos, pero NO se resta de ventaGravada
  //
  // Fórmula de validación de Hacienda: (precioUni * cantidad) - montoDescu = ventaGravada
  //
  // IMPORTANTE: Para factura tipo 01, solo se facturan las comisiones (no el servicio completo)
  // Cálculo correcto:
  // 1. comisionesComprador = platformCommissionBuyer + paymentGatewayCommission (sin IVA)
  // 2. ivaSobreComisiones = comisionesComprador * 0.13
  // 3. totalConIva = comisionesComprador + ivaSobreComisiones (total a facturar CON IVA)
  // 4. baseImponible = comisionesComprador (base sin IVA, solo para calcular el IVA)
  // 5. ivaExtraido = ivaSobreComisiones (IVA desglosado, solo informativo)
  // 6. En cuerpoDocumento:
  //    - precioUni = totalConIva (CON IVA)
  //    - ventaGravada = totalConIva (CON IVA también)
  //    - ivaItem = ivaExtraido (solo informativo, no se resta)

  // Calcular solo las comisiones del comprador (sin IVA)
  const comisionesComprador = redondear(
    options.platformCommissionBuyer + options.paymentGatewayCommission
  );
  
  // Calcular IVA sobre las comisiones del comprador
  const ivaSobreComisiones = redondear(comisionesComprador * 0.13);
  
  // Total a facturar: comisiones + IVA (solo esto, NO incluye el servicio)
  const totalConIva = redondear(comisionesComprador + ivaSobreComisiones);

  // Base imponible es solo las comisiones (sin IVA)
  const baseImponible = comisionesComprador;
  
  // IMPORTANTE: Para evitar el error "El iva calculado es diferente al proporcionado",
  // calculamos el IVA extraído EXACTAMENTE con la fórmula que usa el Ministerio de Hacienda
  // a partir del precio unitario (totalConIva), que es (precio / 1.13) * 0.13
  const ivaExtraido = redondear((totalConIva / 1.13) * 0.13);

  // Definir componentes del ítem según la regla de oro para tipo 01
  const cantidad = 1;
  const montoDescu = 0;
  const ventaNoSuj = 0;
  const ventaExenta = 0;
  const ventaGravada = totalConIva; // IMPORTANTE: Para tipo 01, ventaGravada = total CON IVA
  const noGravado = 0;
  const ivaItem = ivaExtraido; // IVA solo informativo, no se resta de ventaGravada
  const precioUniFinal = totalConIva; // precioUni también debe ser el total CON IVA

  // Validar la fórmula de Hacienda: (precioUni * cantidad) - montoDescu = ventaGravada
  const totalPorPrecio = redondear(precioUniFinal * cantidad);
  const ventaGravadaCalculada = redondear(totalPorPrecio - montoDescu);
  const diferencia = Math.abs(ventaGravadaCalculada - ventaGravada);

  console.log("💰 Validación de cálculo por ítem (Factura 01):");
  console.log("  - Comisiones Comprador (sin IVA):", comisionesComprador);
  console.log("  - IVA sobre Comisiones:", ivaSobreComisiones);
  console.log("  - totalConIva (total a facturar, solo comisiones + IVA):", totalConIva);
  console.log("  - baseImponible (sin IVA):", baseImponible);
  console.log("  - ivaExtraido (desglose):", ivaExtraido);
  console.log("  - precioUni:", precioUniFinal);
  console.log("  - cantidad:", cantidad);
  console.log("  - precioUni * cantidad:", totalPorPrecio);
  console.log("  - montoDescu:", montoDescu);
  console.log(
    "  - (precioUni * cantidad) - montoDescu:",
    ventaGravadaCalculada
  );
  console.log("  - ventaGravada:", ventaGravada);
  console.log("  - ivaItem (informativo):", ivaItem);
  console.log("  - diferencia:", diferencia);

  if (diferencia > 0.01) {
    throw new Error(
      `Error en cálculo de total por ítem: (precioUni * cantidad) - montoDescu (${ventaGravadaCalculada}) debe ser igual a ventaGravada (${ventaGravada}). Diferencia: ${diferencia}`
    );
  }

  const cuerpoDocumento: DTECuerpoDocumento[] = [
    {
      numItem: 1,
      tipoItem: TIPO_ITEM_SERVICIO,
      numeroDocumento: null,
      codigo: null,
      codTributo: null,
      descripcion: options.concept,
      cantidad: cantidad,
      uniMedida: UNIDAD_MEDIDA_SERVICIO,
      precioUni: precioUniFinal, // Precio unitario con IVA incluido (ajustado si es necesario)
      montoDescu: montoDescu,
      ventaNoSuj: ventaNoSuj,
      ventaExenta: ventaExenta,
      ventaGravada: ventaGravada, // Base gravada sin IVA
      tributos: null, // Tipo 01 no lleva tributos en cuerpoDocumento
      psv: 0,
      noGravado: noGravado,
      ivaItem: ivaItem, // Requerido según MH
    },
  ];

  const totalRedondeado = totalConIva; // Total a facturar (solo comisiones + IVA)
  const totalLetras = numeroALetras(totalRedondeado);

  console.log("💰 Valores monetarios (Factura Consumidor Final):");
  console.log("  - Comisiones Comprador (sin IVA):", comisionesComprador);
  console.log("  - IVA sobre Comisiones:", ivaSobreComisiones);
  console.log("  - Precio unitario (con IVA):", precioUniFinal);
  console.log("  - Base imponible (sin IVA):", baseImponible);
  console.log("  - IVA extraído:", ivaExtraido);
  console.log("  - Total a facturar (solo comisiones + IVA):", totalConIva);

  // Según el esquema fe-fc-v1.json para tipo 01 y la regla de oro:
  // - Para factura tipo 01, el IVA se incluye en el precio
  // - IMPORTANTE: Solo se facturan las comisiones (NO el servicio completo)
  // - En resumen, totalGravada debe ser el total CON IVA (igual que en cuerpoDocumento)
  // - totalIva es el IVA extraído (solo informativo)
  // - Los códigos de tributo permitidos en resumen NO incluyen "20"
  // - Para factura tipo 01, tributos puede ser null
  const resumen: DTEResumen = {
    totalNoSuj: 0,
    totalExenta: 0,
    totalGravada: totalConIva, // IMPORTANTE: Solo comisiones + IVA (NO incluye servicio)
    subTotalVentas: totalConIva, // Total con IVA
    descuNoSuj: 0,
    descuExenta: 0,
    descuGravada: 0,
    porcentajeDescuento: 0,
    totalDescu: 0,
    tributos: null, // Para tipo 01, el IVA está incluido en el precio, no se declara en tributos
    subTotal: totalConIva, // Total con IVA
    ivaRete1: 0,
    reteRenta: 0, // Requerido según MH
    montoTotalOperacion: totalRedondeado,
    totalNoGravado: 0,
    totalIva: ivaExtraido, // Requerido según MH - IVA extraído (solo informativo)
    totalPagar: totalRedondeado,
    totalLetras: totalLetras,
    saldoFavor: 0,
    condicionOperacion: 1,
    pagos: [
      {
        codigo: "01",
        montoPago: totalRedondeado,
        referencia: null,
        plazo: null,
        periodo: null,
      },
    ],
    numPagoElectronico: null,
  };

  const dte: DTE_FacturaConsumidorFinal = {
    identificacion,
    documentoRelacionado: null,
    emisor,
    receptor,
    otrosDocumentos: null,
    ventaTercero: null,
    cuerpoDocumento,
    resumen,
    extension: {
      nombEntrega: null,
      docuEntrega: null,
      nombRecibe: null,
      docuRecibe: null,
      observaciones: null,
      placaVehiculo: null,
    },
    apendice: null,
  };

  return dte;
}

// ============================================================================
// EMAIL AL PROVEEDOR (como create-invoice: si se genera el DTE se manda el mail)
// ============================================================================

function generarURLQR(
  codigoGeneracion: string,
  fechaEmision: string,
  ambiente: Ambiente
): string {
  return `https://admin.factura.gob.sv/consultaPublica?ambiente=${ambiente}&codGen=${codigoGeneracion}&fechaEmi=${fechaEmision}`;
}

function generateProviderInvoiceEmailHTML(
  providerName: string,
  dteInfo: {
    tipoDte: string;
    codigoGeneracion: string;
    numeroControl: string | null;
    selloRecepcion: string | null;
    fechaEmision: string | null;
    total: number;
    concepto: string;
    qrURL: string | null;
  }
): string {
  const tipoLabel = dteInfo.tipoDte === "03" ? "Crédito Fiscal" : "Factura Consumidor Final";
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura electrónica - ServiSV</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">ServiSV</h1>
  </div>
  <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #1f2937; margin-top: 0;">Factura electrónica al proveedor</h2>
    <p style="font-size: 16px;">Hola <strong>${providerName}</strong>,</p>
    <p style="font-size: 16px;">Adjuntamos la información de tu documento tributario electrónico (DTE) emitido por ServiSV.</p>
    <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
      <h3 style="margin-top: 0; color: #1f2937;">Detalles del DTE</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0; font-weight: bold;">Tipo:</td><td style="padding: 8px 0;">${tipoLabel}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold;">Concepto:</td><td style="padding: 8px 0;">${dteInfo.concepto}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold;">Total:</td><td style="padding: 8px 0;">${formatCurrency(dteInfo.total)}</td></tr>
        <tr><td style="padding: 8px 0; font-weight: bold;">Código de generación:</td><td style="padding: 8px 0;">${dteInfo.codigoGeneracion}</td></tr>
        ${dteInfo.numeroControl ? `<tr><td style="padding: 8px 0; font-weight: bold;">Número de control:</td><td style="padding: 8px 0;">${dteInfo.numeroControl}</td></tr>` : ""}
        ${dteInfo.fechaEmision ? `<tr><td style="padding: 8px 0; font-weight: bold;">Fecha emisión:</td><td style="padding: 8px 0;">${dteInfo.fechaEmision}</td></tr>` : ""}
      </table>
    </div>
    ${dteInfo.qrURL ? `
    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #f59e0b; text-align: center;">
      <h3 style="margin-top: 0; color: #92400e;">Documento Tributario Electrónico (DTE)</h3>
      <p style="margin: 10px 0; font-size: 14px;"><strong>Código de Generación:</strong> ${dteInfo.codigoGeneracion}</p>
      <div style="margin: 20px 0;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(dteInfo.qrURL)}" alt="Código QR DTE" style="width: 200px; height: 200px; border: 3px solid #9333ea; padding: 10px; background: #fff; display: block; margin: 0 auto;" />
        <p style="margin-top: 10px; font-size: 12px; font-weight: bold; color: #9333ea;">Escanea para verificar el documento</p>
      </div>
      <p style="margin: 15px 0; font-size: 14px;">Verificar en: <a href="${dteInfo.qrURL}">${dteInfo.qrURL}</a></p>
    </div>
    ` : ""}
    <p style="font-size: 14px; color: #6b7280;">Saludos,<br/>Equipo ServiSV</p>
  </div>
</body>
</html>`;
}

async function sendProviderInvoiceEmail(
  providerEmail: string,
  providerName: string,
  dteInfo: {
    tipoDte: string;
    codigoGeneracion: string;
    numeroControl: string | null;
    selloRecepcion: string | null;
    fechaEmision: string | null;
    total: number;
    concepto: string;
    ambiente: Ambiente;
  }
): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.warn("[CreateProviderInvoice] RESEND_API_KEY no configurada, no se enviará email al proveedor");
    return;
  }
  const qrURL = dteInfo.codigoGeneracion && dteInfo.fechaEmision
    ? generarURLQR(dteInfo.codigoGeneracion, dteInfo.fechaEmision, dteInfo.ambiente)
    : null;
  const html = generateProviderInvoiceEmailHTML(providerName, {
    ...dteInfo,
    qrURL,
  });
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: "ServiSV <notificaciones@servisv.com>",
      to: providerEmail,
      subject: `Factura electrónica (DTE) - ServiSV`,
      html,
    }),
  });
  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    throw new Error(`Error al enviar email: ${errorText}`);
  }
  console.log("[CreateProviderInvoice] ✅ Email de factura enviado al proveedor:", providerEmail);
}

// ============================================================================
// SERVE - Solo factura al proveedor (01/03), mismo flujo que FSE y notas
// ============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, x-region",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("es-SV", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

const formatNumber = (amount: number) =>
  new Intl.NumberFormat("es-SV", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

// Ya hay un numeroALetras definido arriba

async function generatePDFFromHTML(html: string): Promise<Uint8Array> {
  const pdfApiKey = Deno.env.get("HTML_PDF_API_KEY");
  const pdfApiUrl = Deno.env.get("HTML_PDF_API_URL") || "https://api.pdfshift.io/v3/convert/pdf";
  if (!pdfApiKey) return new Uint8Array(0);
  try {
    const isPdfShift = pdfApiUrl.includes("pdfshift.io");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isPdfShift) headers["Authorization"] = `Basic ${btoa(`api:${pdfApiKey}`)}`;
    else headers["Authorization"] = `Bearer ${pdfApiKey}`;
    const body = isPdfShift
      ? { source: html, format: "A4", margin: "10mm" }
      : { html, format: "A4", margin: "10mm", printBackground: true };
    const res = await fetch(pdfApiUrl, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await res.text());
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.error("PDF error:", e);
    return new Uint8Array(0);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const bodyParams = await req.json().catch(() => ({}));
    const tipoDte = (bodyParams.tipoDte === "03" ? "03" : "01") as "01" | "03";
    const totalAmount = Number(bodyParams.totalAmount);
    const concept = String(bodyParams.concept || "Costo de servicio").trim();
    const destino = bodyParams.destino === "proveedor" ? "proveedor" : "cliente";
    let fiscalData = bodyParams.fiscalData ?? null;

    if (bodyParams.duplicarParaContingencia === true) {
      console.log("[CreateStandaloneInvoice] Rama: duplicarParaContingencia");
      const facturadorInvoiceId = bodyParams.facturadorInvoiceId as string | undefined;
      if (!facturadorInvoiceId) throw new Error("facturadorInvoiceId es requerido");

      const { data: existing, error: existingError } = await supabase
        .from("facturador_invoices")
        .select("*")
        .eq("id", facturadorInvoiceId)
        .single();
      if (existingError || !existing) throw new Error("No se encontró la factura para duplicar");

      const invoiceNumber = `FAC-${new Date().toISOString().split("T")[0].replace(/-/g, "")}-${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
      const invoiceDate = new Date().toISOString().split("T")[0];

      const { data: duplicated, error: duplicateError } = await supabase
        .from("facturador_invoices")
        .insert({
          destino: existing.destino,
          tipo_dte: existing.tipo_dte,
          total_amount: existing.total_amount,
          concept: existing.concept || "Factura para contingencia",
          fiscal_data: existing.fiscal_data,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          dte_estado: null,
          dte_codigo_generacion: null,
          dte_numero_control: null,
          dte_sello_recepcion: null,
          dte_fecha_emision: null,
          dte_hora_emision: null,
          dte_json: null,
        })
        .select()
        .single();

      if (duplicateError) throw new Error(`Error al duplicar factura: ${duplicateError.message}`);

      return new Response(
        JSON.stringify({ success: true, invoiceId: duplicated.id, invoiceNumber, invoiceDate }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let existingInvoice: any = null;
    let amount = 0;
    let conceptDte = "";
    let destinoDte = "";
    let tipoDteFinal: "01" | "03" = "01";

    if (bodyParams.emitirEnContingencia === true) {
      console.log("[CreateStandaloneInvoice] Rama: emitirEnContingencia");
      const facturadorInvoiceId = bodyParams.facturadorInvoiceId as string | undefined;
      if (!facturadorInvoiceId) throw new Error("facturadorInvoiceId es requerido");

      const { data: existing, error: existingError } = await supabase
        .from("facturador_invoices")
        .select("*")
        .eq("id", facturadorInvoiceId)
        .single();
      if (existingError || !existing) throw new Error("No se encontró la factura");
      if (existing.dte_codigo_generacion) throw new Error("Esta factura ya tiene DTE generado");

      existingInvoice = existing;
      amount = Number(existing.total_amount);
      conceptDte = existing.concept;
      destinoDte = existing.destino;
      fiscalData = existing.fiscal_data;
      tipoDteFinal = existing.tipo_dte as "01" | "03";
    } else {
      amount = redondear(totalAmount);
      conceptDte = concept;
      destinoDte = destino;
      tipoDteFinal = tipoDte;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("totalAmount debe ser un número mayor a 0");
    }

    if (!fiscalData || !fiscalData.nombre_completo) {
      fiscalData = {
        tipo_persona: "natural",
        nombre_completo: "Consumidor Final",
        email: Deno.env.get("SERVISV_CORREO") || "facturacion@servisv.com",
        dui: "00000000-0",
        direccion: "San Salvador",
        departamento: "06",
        municipio: "01",
      };
    }

    const fiscalDataProvider: FiscalData = {
      tipo_persona: fiscalData.tipo_persona === "juridica" ? "juridica" : "natural",
      nombre_completo: String(fiscalData.nombre_completo).trim(),
      email: String(fiscalData.email).trim(),
      dui: fiscalData.dui?.trim() || undefined,
      nit: fiscalData.nit?.trim() || undefined,
      numero_registro_contribuyente: fiscalData.numero_registro_contribuyente?.trim() || undefined,
      direccion: String(fiscalData.direccion || "San Salvador").trim(),
      departamento: String(fiscalData.departamento || "06").padStart(2, "0").substring(0, 2),
      municipio: String(fiscalData.municipio || "01").padStart(2, "0").substring(0, 2),
    };

    const baseImponible = redondear(amount / 1.13);
    const ivaSobreBase = redondear(baseImponible * 0.13);
    const optionsProvider: GenerarCCFOptions = {
      serviceAmount: amount,
      platformCommissionBuyer: baseImponible,
      platformCommissionSeller: 0,
      paymentGatewayCommission: 0,
      totalCommissions: baseImponible,
      ivaAmount: ivaSobreBase,
      totalAmount: amount,
      fiscalData: fiscalDataProvider,
      concept: conceptDte,
      createdAt: existingInvoice ? existingInvoice.created_at : new Date().toISOString(),
    };

    let dteCodigoProv: string | null = null;
    let dteNumeroControlProv: string | null = null;
    let dteSelloProv: string | null = null;
    let dteEstadoProv = "pendiente";
    let dteJsonProv: DTE_CreditoFiscal | DTE_FacturaConsumidorFinal | null = null;
    let dteFechaProv: string | null = null;
    let dteHoraProv: string | null = null;
    
    // Validar en que ambiente estamos corriendo para ver si generamos DTE
    if (EJECUTAR_DTE) {
      try {
        let dteGeneradoProv: DTE_CreditoFiscal | DTE_FacturaConsumidorFinal;
        if (tipoDteFinal === "03") {
          dteGeneradoProv = await generarCreditoFiscal(optionsProvider, DTE_AMBIENTE);
        } else {
          dteGeneradoProv = await generarFacturaConsumidorFinal(optionsProvider, DTE_AMBIENTE);
        }
        const tokenProv = await getValidToken(
          { user: DTE_USER, pwd: DTE_PASSWORD },
          DTE_AMBIENTE === "00" ? "TEST" : "PROD"
        );
        const dteFirmadoProv = await firmarDTEAuto(dteGeneradoProv, {
          nit: SERVISV_NIT.replace(/-/g, ""),
          certificatePassword: DTE_CERTIFICADO_PASSWORD,
          firmadorUrl: DTE_FIRMADOR_URL,
          usarServicioFirmador: DTE_USAR_SERVICIO_FIRMADOR,
        });
        const responseProv = await transmitirDTE(
          dteFirmadoProv,
          SERVISV_NIT,
          tokenProv,
          DTE_AMBIENTE,
          tipoDteFinal as "01" | "03",
          dteGeneradoProv.identificacion.version
        );

        dteCodigoProv = responseProv.codigoGeneracion || dteGeneradoProv.identificacion.codigoGeneracion;
        dteNumeroControlProv = dteGeneradoProv.identificacion.numeroControl;
        dteSelloProv = responseProv.selloRecibido || null;
        dteFechaProv = dteGeneradoProv.identificacion.fecEmi;
        dteHoraProv = dteGeneradoProv.identificacion.horEmi;
        dteJsonProv = dteGeneradoProv;
        dteEstadoProv =
          responseProv.estado === "PROCESADO" || responseProv.estado === "RECIBIDO"
            ? "procesado"
            : responseProv.estado === "CONTINGENCIA"
              ? "contingencia"
              : "rechazado";
      } catch (errProv: any) {
        console.error("Error DTE (excepción):", errProv?.message || errProv);
        dteEstadoProv = "rechazado";
      }
    } else {
      console.log("DTE no ejecutado. Configure DTE_HABILITADO=true para generar y transmitir.");
    }

    const invoiceNumber = dteNumeroControlProv || `FAC-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 1000000).toString().padStart(6, "0")}`;
    const invoiceDate = dteFechaProv || new Date().toISOString().slice(0, 10);

    let insertedInvoice: any = null;
    let insertError: any = null;

    if (existingInvoice) {
      const { data, error } = await supabase
        .from("facturador_invoices")
        .update({
          dte_codigo_generacion: dteCodigoProv,
          dte_numero_control: dteNumeroControlProv,
          dte_sello_recepcion: dteSelloProv,
          dte_fecha_emision: dteFechaProv,
          dte_hora_emision: dteHoraProv,
          dte_json: dteJsonProv,
          dte_estado: dteEstadoProv,
        })
        .eq("id", existingInvoice.id)
        .select()
        .single();
      insertedInvoice = data;
      insertError = error;
    } else {
      const { data, error } = await supabase
        .from("facturador_invoices")
        .insert({
          destino: destinoDte,
          tipo_dte: tipoDteFinal,
          total_amount: amount,
          concept: conceptDte,
          fiscal_data: fiscalDataProvider,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          dte_codigo_generacion: dteCodigoProv,
          dte_numero_control: dteNumeroControlProv,
          dte_sello_recepcion: dteSelloProv,
          dte_fecha_emision: dteFechaProv,
          dte_hora_emision: dteHoraProv,
          dte_json: dteJsonProv,
          dte_estado: dteEstadoProv,
        })
        .select()
        .single();
      insertedInvoice = data;
      insertError = error;
    }

    if (insertError) {
      console.error("Error insert facturador_invoices:", insertError);
      throw new Error(`Error al guardar factura: ${insertError.message}`);
    }

    const dteJson = dteJsonProv as any;
    const emisor = dteJson?.emisor || {};
    const emisorNombre = emisor.nombre || Deno.env.get("SERVISV_RAZON_SOCIAL") || "SERVICIOSSV, SOCIEDAD POR ACCIONES SIMPLIFICADA DE CAPITAL VARIABLE";
    const emisorNit = emisor.nit || (Deno.env.get("SERVISV_NIT") || "").replace(/-/g, "");
    const emisorNrc = emisor.nrc || (Deno.env.get("SERVISV_NRC") || "").replace(/-/g, "");
    const emisorActividad = emisor.descActividad || Deno.env.get("SERVISV_DESC_ACTIVIDAD") || "PORTALES WEB";
    const emisorDireccion = emisor.direccion?.complemento || Deno.env.get("SERVISV_DIRECCION") || "";
    const emisorTelefono = emisor.telefono || Deno.env.get("SERVISV_TELEFONO") || "";
    const emisorCorreo = emisor.correo || Deno.env.get("SERVISV_CORREO") || "";

    const receptor = dteJson?.receptor || {};
    const receptorNombre = receptor.nombre || fiscalDataProvider.nombre_completo;
    const receptorNumDocumento = receptor.numDocumento || fiscalDataProvider.dui || fiscalDataProvider.nit || "";
    const receptorTipoDocumento = receptor.tipoDocumento || "";
    const receptorDui = receptorTipoDocumento === "13" ? receptorNumDocumento : "";
    const receptorNit = receptorTipoDocumento === "36" ? receptorNumDocumento : "";
    const receptorNrc = receptor.nrc || "";
    const receptorCorreo = receptor.correo || fiscalDataProvider.email;
    const receptorDireccion = receptor.direccion?.complemento || fiscalDataProvider.direccion || "";

    const cuerpoDocumento = dteJson?.cuerpoDocumento || [];
    const primerItem = cuerpoDocumento[0] || {};
    const descripcionItem = primerItem.descripcion || concept;
    const cantidadItem = primerItem.cantidad || 1;
    const precioUniItem = primerItem.precioUni || amount;
    const ventaGravadaItem = primerItem.ventaGravada || amount;

    const resumen = dteJson?.resumen || {};
    const totalGravada = resumen.totalGravada || amount;
    const subTotalVentas = resumen.subTotalVentas || amount;
    const subTotal = resumen.subTotal || amount;
    const totalIva = resumen.totalIva || 0;
    const montoTotalOperacion = resumen.montoTotalOperacion || amount;
    const totalPagar = resumen.totalPagar || amount;
    const totalLetras = resumen.totalLetras || numeroALetras(amount);

    const formatNIT = (nit: string) => {
      if (!nit) return "";
      const clean = nit.replace(/-/g, "");
      if (clean.length === 14) {
        return `${clean.substring(0, 4)}-${clean.substring(4, 10)}-${clean.substring(10, 13)}-${clean.substring(13)}`;
      } else if (clean.length === 9) {
        return `${clean.substring(0, 4)}-${clean.substring(4, 8)}-${clean.substring(8)}`;
      }
      return nit;
    };

    let pdfBase64: string | null = null;
    const qrURL = dteCodigoProv && dteFechaProv ? generarURLQR(dteCodigoProv, dteFechaProv, DTE_AMBIENTE) : null;
    
    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 15px; line-height: 1.4; }
    .content { position: relative; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #9333ea; padding-bottom: 10px; }
    .header-logo { display: flex; align-items: center; justify-content: center; gap: 15px; margin-bottom: 10px; }
    .header-logo img { height: 50px; width: auto; }
    .header h1 { font-size: 16px; font-weight: bold; margin-bottom: 5px; color: #9333ea; }
    .header h2 { font-size: 14px; font-weight: bold; color: #9333ea; }
    .dte-info { background: #f3f0ff; padding: 10px; margin-bottom: 15px; border: 1px solid #9333ea; }
    .dte-info p { margin: 3px 0; font-size: 10px; }
    .section { margin-bottom: 15px; }
    .section-title { background: #9333ea; color: #fff; padding: 5px 10px; font-size: 11px; font-weight: bold; }
    .section-content { border: 1px solid #ddd; border-top: none; padding: 10px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
    th { background: #f5f5f5; padding: 6px; text-align: left; border: 1px solid #ddd; font-weight: bold; }
    td { padding: 6px; border: 1px solid #ddd; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .summary { margin-top: 15px; }
    .summary table { width: 100%; }
    .summary td:first-child { width: 70%; }
    .summary td:last-child { text-align: right; font-weight: bold; }
    .total-row { background: #f3f0ff; font-weight: bold; }
    .qr-section { margin-top: 20px; text-align: center; padding: 20px; border: 3px solid #9333ea; background: #f3f0ff; page-break-inside: avoid; }
    .qr-section p { margin: 5px 0; font-size: 10px; }
    .qr-section a { color: #9333ea; text-decoration: underline; word-break: break-all; }
    .footer { margin-top: 20px; text-align: center; font-size: 9px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
    .qr-small { width: 120px; height: 120px; background: white; padding: 5px; border: 1px solid #ddd; float: right; margin-top: -85px; }
  </style>
</head>
<body>
  <div class="content">
    <div class="header">
      <div class="header-logo">
        <img src="https://servisv.com/assets/logoServiSVpng.png" alt="ServiSV Logo" />
        <div>
          <h1>DOCUMENTO TRIBUTARIO ELECTRÓNICO</h1>
          <h2>${tipoDte === "03" ? "COMPROBANTE DE CRÉDITO FISCAL" : "FACTURA"}</h2>
        </div>
      </div>
    </div>

    <div class="dte-info">
      <div class="dte-info-left">
        <p><strong>Código de Generación:</strong> ${dteCodigoProv || "-"}</p>
        <p><strong>Número de Control:</strong> ${dteNumeroControlProv || "-"}</p>
        <p><strong>Sello de Recepción:</strong> ${dteSelloProv || "Pendiente"}</p>
        <p><strong>Modelo de Facturación:</strong> Previo</p>
        <p><strong>Tipo de Transmisión:</strong> Normal</p>
        <p><strong>Fecha y Hora de Generación:</strong> ${dteFechaProv || "-"} ${dteHoraProv || "-"}</p>
      </div>
      ${qrURL ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrURL)}" alt="QR" class="qr-small" />` : ""}
    </div>

    <div class="section">
      <div class="section-title">EMISOR</div>
      <div class="section-content">
        <table>
          <tr><td style="width: 30%; font-weight: bold;">Nombre o razón social:</td><td>${emisorNombre}</td></tr>
          <tr><td style="font-weight: bold;">NIT:</td><td>${formatNIT(emisorNit)}</td></tr>
          <tr><td style="font-weight: bold;">NRC:</td><td>${formatNIT(emisorNrc)}</td></tr>
          <tr><td style="font-weight: bold;">Actividad económica:</td><td>${emisorActividad}</td></tr>
          <tr><td style="font-weight: bold;">Dirección:</td><td>${emisorDireccion}</td></tr>
          <tr><td style="font-weight: bold;">Número de teléfono:</td><td>${emisorTelefono}</td></tr>
          <tr><td style="font-weight: bold;">Correo electrónico:</td><td>${emisorCorreo}</td></tr>
          <tr><td style="font-weight: bold;">Tipo de establecimiento:</td><td>Casa Matriz</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">RECEPTOR</div>
      <div class="section-content">
        <table>
          <tr><td style="width: 30%; font-weight: bold;">Nombre o razón social:</td><td>${receptorNombre}</td></tr>
          ${receptorDui ? `<tr><td style="font-weight: bold;">DUI:</td><td>${receptorDui}</td></tr>` : ""}
          ${receptorNit ? `<tr><td style="font-weight: bold;">NIT:</td><td>${receptorNit}</td></tr>` : ""}
          ${receptorNrc ? `<tr><td style="font-weight: bold;">NRC:</td><td>${receptorNrc}</td></tr>` : ""}
          ${receptor.nit ? `<tr><td style="font-weight: bold;">NIT:</td><td>${formatNIT(receptor.nit)}</td></tr>` : ""}
          ${receptorDireccion ? `<tr><td style="font-weight: bold;">Dirección:</td><td>${receptorDireccion}</td></tr>` : ""}
          <tr><td style="font-weight: bold;">Correo electrónico:</td><td>${receptorCorreo}</td></tr>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">DOCUMENTOS RELACIONADOS</div>
      <div class="section-content">
        <table>
          <thead><tr><th>Tipo de Documento</th><th>N° de Documento</th><th>Fecha de Documento</th></tr></thead>
          <tbody><tr><td>-</td><td>-</td><td>-</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">OTROS DOCUMENTOS ASOCIADOS</div>
      <div class="section-content">
        <table>
          <thead><tr><th>Identificación del documento</th><th>Descripción del documento</th></tr></thead>
          <tbody><tr><td>-</td><td>-</td></tr></tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <div class="section-title">CUERPO DEL DOCUMENTO</div>
      <div class="section-content">
        <table>
          <thead>
            <tr>
              <th>N°</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Descripción</th>
              <th class="text-right">Precio Unitario</th>
              <th class="text-right">Otros montos no afectos</th>
              <th class="text-right">Descuento por ítem</th>
              <th class="text-right">Ventas No Sujetas</th>
              <th class="text-right">Ventas Exentas</th>
              <th class="text-right">Ventas Gravadas</th>
            </tr>
          </thead>
          <tbody>
            ${cuerpoDocumento.length > 0 ? cuerpoDocumento.map((item: any, index: number) => `
              <tr>
                <td>${item.numItem || index + 1}</td>
                <td>${formatNumber(item.cantidad || 1)}</td>
                <td>Otra</td>
                <td>${item.descripcion || descripcionItem}</td>
                <td class="text-right">${formatCurrency(item.precioUni || precioUniItem)}</td>
                <td class="text-right">0.00</td>
                <td class="text-right">${formatNumber(item.montoDescu || 0)}</td>
                <td class="text-right">${formatNumber(item.ventaNoSuj || 0)}</td>
                <td class="text-right">${formatNumber(item.ventaExenta || 0)}</td>
                <td class="text-right">${formatCurrency(item.ventaGravada || ventaGravadaItem)}</td>
              </tr>
            `).join("") : `
              <tr>
                <td>1</td>
                <td>1.00</td>
                <td>Otra</td>
                <td>${descripcionItem}</td>
                <td class="text-right">${formatCurrency(precioUniItem)}</td>
                <td class="text-right">0.00</td>
                <td class="text-right">0.00</td>
                <td class="text-right">0.00</td>
                <td class="text-right">0.00</td>
                <td class="text-right">${formatCurrency(ventaGravadaItem)}</td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="summary">
          <table>
            <tr><td>Suma de Ventas:</td><td class="text-right">${formatCurrency(totalGravada)}</td></tr>
            <tr><td>Sumatoria de ventas:</td><td class="text-right">${formatCurrency(totalGravada)}</td></tr>
            <tr><td>Monto global Desc., Rebajas y otros a ventas no sujetas:</td><td class="text-right">0.00</td></tr>
            <tr><td>Monto global Desc., Rebajas y otros a ventas Exentas:</td><td class="text-right">0.00</td></tr>
            <tr><td>Monto global Desc., Rebajas y otros a ventas gravadas:</td><td class="text-right">0.00</td></tr>
            <tr><td>Sub-Total:</td><td class="text-right">${formatCurrency(subTotal)}</td></tr>
            <tr><td>IVA (13%):</td><td class="text-right">${formatCurrency(tipoDte === "01" ? (resumen.totalIva || 0) : (resumen.tributos?.[0]?.valor || 0))}</td></tr>
            <tr><td>IVA Percibido:</td><td class="text-right">${formatCurrency(resumen.ivaPerci1 || 0)}</td></tr>
            <tr><td>IVA Retenido:</td><td class="text-right">${formatCurrency(resumen.ivaRete1 || 0)}</td></tr>
            <tr><td>Retención Renta:</td><td class="text-right">${formatCurrency(resumen.reteRenta || 0)}</td></tr>
            <tr><td>Monto Total de la Operación:</td><td class="text-right">${formatCurrency(montoTotalOperacion)}</td></tr>
            <tr><td>Total Otros Montos No Afectos:</td><td class="text-right">0.00</td></tr>
            <tr class="total-row"><td>Total a Pagar:</td><td class="text-right">${formatCurrency(totalPagar)}</td></tr>
            <tr><td colspan="2"><strong>Valor en Letras:</strong> ${totalLetras}</td></tr>
            <tr><td colspan="2"><strong>Condición de la Operación:</strong> Contado</td></tr>
            ${dteJson?.extension?.observaciones ? `<tr><td colspan="2"><strong>Observaciones:</strong> ${dteJson.extension.observaciones}</td></tr>` : ""}
          </table>
        </div>
      </div>
    </div>
    
    ${qrURL ? `
    <div class="qr-section">
      <p style="font-size: 14px; font-weight: bold; margin-bottom: 10px;">Comprobante Electrónico</p>
      <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrURL)}" alt="QR Code" style="background: white; padding: 5px; display: block; margin: 0 auto;" />
      <p style="margin-top: 10px;">Escanea este código para verificar el documento o visita:</p>
      <a href="${qrURL}">${qrURL}</a>
    </div>
    ` : ""}

    <div class="footer">
      <p>Este es un documento tributario electrónico válido en El Salvador.</p>
    </div>
  </div>
</body>
</html>`;

    const pdfBytes = await generatePDFFromHTML(html);
    if (pdfBytes.length > 0) {
      let binary = "";
      for (let i = 0; i < pdfBytes.length; i++) {
        binary += String.fromCharCode(pdfBytes[i]);
      }
      pdfBase64 = btoa(binary);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dte: {
          codigoGeneracion: dteCodigoProv ?? "",
          numeroControl: dteNumeroControlProv ?? "",
          selloRecepcion: dteSelloProv ?? null,
          estado: dteEstadoProv ?? "pendiente",
          dte_json: dteJsonProv ?? {},
          qrURL: qrURL,
          fechaEmision: dteFechaProv,
          horaEmision: dteHoraProv,
        },
        pdfBase64,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error global:", error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Error desconocido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
