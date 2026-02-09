import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export interface ProviderInvoice {
  id: string;
  created_at: string;
  updated_at: string;
  billing_id: string;
  seller_id: string | null;
  dte_tipo_documento: "01" | "03";
  dte_codigo_generacion: string | null;
  dte_numero_control: string | null;
  dte_fecha_emision: string | null;
  dte_hora_emision: string | null;
  dte_sello_recepcion: string | null;
  dte_json: any;
  dte_estado: "pendiente" | "procesado" | "rechazado" | "contingencia";
  dte_observaciones: string[] | null;
  total_compra: number;
  descripcion: string | null;
  receptor_fiscal_data: any;
  billing?: {
    id: string;
    invoice_number?: string;
    total_amount?: number;
    description?: string;
    created_at?: string;
  };
}

export function useProviderInvoices() {
  const [invoices, setInvoices] = useState<ProviderInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("provider_invoices")
        .select(`
          *,
          billing:billing_id (
            id,
            invoice_number,
            total_amount,
            description,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setInvoices(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar facturas al proveedor");
      console.error("Error en useProviderInvoices:", err);
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
