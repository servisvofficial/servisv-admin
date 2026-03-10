import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export interface FacturadorInvoice {
  id: string;
  created_at: string;
  updated_at: string;
  destino: "cliente" | "proveedor";
  tipo_dte: "01" | "03";
  total_amount: number;
  concept: string | null;
  fiscal_data: any;
  invoice_number: string;
  invoice_date: string;
  dte_codigo_generacion: string | null;
  dte_numero_control: string | null;
  dte_sello_recepcion: string | null;
  dte_estado: string | null;
  dte_json: any;
  dte_fecha_emision: string | null;
  dte_hora_emision: string | null;
}

export function useFacturadorInvoices() {
  const [invoices, setInvoices] = useState<FacturadorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from("facturador_invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setInvoices(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar facturas del Facturador");
      console.error("Error en useFacturadorInvoices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return {
    invoices,
    loading,
    error,
    fetchInvoices,
  };
}
