/**
 * Script para generar factura al PROVEEDOR (vendedor) vía create-provider-invoice.
 * Datos: Henry Melara – 5% + IVA = $2.26, concepto "Legal Assitance".
 *
 * 1. Inserta un billing con el desglose (servicio 40, comisión vendedor 2, IVA 0.26).
 * 2. Llama a create-provider-invoice con billingId, tipoDte "01", 2.26 y providerFiscalData del proveedor.
 *
 * Uso:
 *   node --env-file=.env.local scripts/create-factura-proveedor.js
 *   opcional: SELLER_ID=<uuid>, BUYER_ID=<uuid>
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_SERVICE_ROLE_KEY. Usa .env o exporta las variables.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Datos del proveedor (receptor de la factura) – Henry Melara
const providerFiscalData = {
  tipo_persona: "natural",
  nombre_completo: "Henry Melara",
  email: "melara96henry@gmail.com",
  dui: "05456560-4",
  direccion: "San Salvador",
  departamento: "06",
  municipio: "01",
  telefono: undefined,
};

// Servicio $40, comisión vendedor 5% = $2, IVA sobre comisión = $0.26 → factura al proveedor = $2.26
const totalAmount = 40;
const platformCommissionSeller = 2;
const ivaCommissionSeller = 0.26;
const providerInvoiceAmount = 2.26; // 5% + IVA (lo que se factura al proveedor)
const sellerAmount = totalAmount - platformCommissionSeller - ivaCommissionSeller;
const concept = "Legal Assitance";
const buyerId = process.env.BUYER_ID || "user_374rTWRq4xNWk03nx3waeo7MTfo";
const invoiceDate = new Date().toISOString().slice(0, 10);
const invoiceNumber = `PROV-${Date.now().toString(36).toUpperCase()}-01`;

async function main() {
  let sellerId = process.env.SELLER_ID;
  if (!sellerId) {
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (userError || !user?.id) {
      console.error("La tabla billing exige seller_id. Define SELLER_ID=<uuid> o asegura que exista al menos un usuario en users.");
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
      service_amount: totalAmount,
      platform_commission_buyer: 0,
      platform_commission_seller: platformCommissionSeller,
      iva_amount: 0,
      iva_commission_seller: ivaCommissionSeller,
      description: concept,
      fiscal_data: providerFiscalData,
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

  const body = {
    billingId,
    tipoDte: "01",
    providerInvoiceAmount,
    concept: concept.trim(),
    providerFiscalData: {
      tipo_persona: providerFiscalData.tipo_persona,
      nombre_completo: providerFiscalData.nombre_completo,
      email: providerFiscalData.email,
      dui: providerFiscalData.dui || undefined,
      nit: providerFiscalData.nit || undefined,
      numero_registro_contribuyente: providerFiscalData.numero_registro_contribuyente || undefined,
      direccion: providerFiscalData.direccion,
      departamento: providerFiscalData.departamento,
      municipio: providerFiscalData.municipio,
      telefono: providerFiscalData.telefono || undefined,
    },
  };

  console.log("Llamando a create-provider-invoice con body:", JSON.stringify(body, null, 2));

  const response = await fetch(`${SUPABASE_URL}/functions/v1/create-provider-invoice`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-region": "us-east-1",
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(body),
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

  console.log("Factura al proveedor (01) generada correctamente.");
  console.log("Resultado:", JSON.stringify(result, null, 2));
}

main();
