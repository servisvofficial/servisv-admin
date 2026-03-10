/**
 * Script para generar una factura Consumidor Final (01) vía la edge function create-provider-invoice.
 * 1. Inserta un registro en la tabla billing con los datos fiscales y monto.
 * 2. Llama a create-provider-invoice con billingId, tipoDte "01", monto, concepto y providerFiscalData.
 *
 * create-provider-invoice tiene menos restricciones que create-invoice (no exige quote_id, etc.).
 *
 * Uso (desde la raíz del proyecto):
 *   node --env-file=.env.local scripts/create-consumidor-final.js
 *   opcional: SELLER_ID=<uuid>, BUYER_ID=<uuid> (por defecto buyer_id: user_374rTWRq4xNWk03nx3waeo7MTfo).
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY. Usa .env o exporta las variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Datos del cliente (receptor) – nombre, celular, DUI del cliente; email donde enviar la factura: el tuyo
const fiscalData = {
  tipo_persona: "natural",
  nombre_completo: "Jose Roberto Galdámez González",
  email: "jrvivoporfe@gmail.com",
  dui: "01980517-4",
  direccion: "San Salvador",
  departamento: "06",   // San Salvador
  municipio: "01",     // San Salvador
  telefono: "7157-8557",
};

// Desglose del servicio: total 40, comisión comprador 10% = 4, comisión vendedor 5% = 2, IVA comprador 0.52, IVA vendedor 0.26
const totalAmount = 40;
const serviceAmount = 40;
const platformCommissionBuyer = 4;
const platformCommissionSeller = 2;
const ivaAmount = 0.52;           // IVA comprador
const ivaCommissionSeller = 0.26; // IVA vendedor
const sellerAmount = totalAmount - platformCommissionSeller - ivaCommissionSeller; // 37.74
const concept = "Costo de servicio";
const buyerId = process.env.BUYER_ID || "user_374rTWRq4xNWk03nx3waeo7MTfo";
const invoiceDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const invoiceNumber = `CF-${Date.now().toString(36).toUpperCase()}-01`;

async function main() {
  let sellerId = process.env.SELLER_ID;
  if (!sellerId) {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (userError || !user?.id) {
      console.error("La tabla billing exige seller_id. Define SELLER_ID=<uuid> o asegura que exista al menos un usuario en la tabla users.");
      process.exit(1);
    }
    sellerId = user.id;
    console.log("Usando seller_id del primer usuario:", sellerId);
  }

  console.log("Creando registro en billing...");
  const { data: billing, error: insertError } = await supabase
    .from("billing")
    .insert({
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      invoice_type: "consumidor_final",
      total_amount: totalAmount,
      seller_amount: sellerAmount,
      service_amount: serviceAmount,
      platform_commission_buyer: platformCommissionBuyer,
      platform_commission_seller: platformCommissionSeller,
      iva_amount: ivaAmount,
      iva_commission_seller: ivaCommissionSeller,
      description: concept,
      fiscal_data: fiscalData,
      quote_id: null,
      seller_id: sellerId,
      buyer_id: buyerId,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error al insertar en billing:", insertError.message);
    console.error("Detalle:", insertError);
    process.exit(1);
  }

  const billingId = billing.id;
  console.log("Billing creado:", billingId);

  // Mismo cuerpo que CreateProviderInvoiceModal: create-provider-invoice (menos restricciones que create-invoice)
  const providerInvoiceAmount = 4.52; // Monto a facturar (costo de servicio sobre los 40)
  const createProviderInvoiceBody = {
    billingId,
    tipoDte: "01",
    providerInvoiceAmount,
    concept: concept.trim(),
    providerFiscalData: {
      tipo_persona: fiscalData.tipo_persona,
      nombre_completo: fiscalData.nombre_completo,
      email: fiscalData.email,
      dui: fiscalData.dui || undefined,
      nit: fiscalData.nit || undefined,
      numero_registro_contribuyente: fiscalData.numero_registro_contribuyente || undefined,
      direccion: fiscalData.direccion,
      departamento: fiscalData.departamento,
      municipio: fiscalData.municipio,
      telefono: fiscalData.telefono || undefined,
    },
  };

  console.log("Llamando a create-provider-invoice con body:", JSON.stringify(createProviderInvoiceBody, null, 2));

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-provider-invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-region": "us-east-1",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(createProviderInvoiceBody),
  });

  let result;
  try {
    result = await response.json();
  } catch (e) {
    console.error("Respuesta no es JSON:", e.message);
    process.exit(1);
  }

  if (!response.ok || result?.success === false) {
    console.error("Error de create-provider-invoice:", result?.error || result?.message || response.statusText);
    console.error("Respuesta:", result);
    process.exit(1);
  }

  console.log("Factura consumidor final (01) generada correctamente.");
  console.log("Resultado:", JSON.stringify(result, null, 2));
}

main();
