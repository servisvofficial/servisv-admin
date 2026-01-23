import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

export interface CreditDebitNote {
  id: string;
  created_at: string;
  updated_at: string;
  note_type: "credit" | "debit";
  billing_id: string;
  dte_tipo_documento: "05" | "06";
  dte_codigo_generacion: string | null;
  dte_numero_control: string | null;
  dte_fecha_emision: string | null;
  dte_hora_emision: string | null;
  dte_sello_recepcion: string | null;
  dte_json: any;
  dte_response: any;
  dte_estado: "pendiente" | "procesado" | "rechazado" | "contingencia" | "invalidado";
  dte_observaciones: string[] | null;
  dte_contingencia: boolean;
  motivo: string;
  monto_afectado: number;
  qr_url: string | null;
  created_by: string | null;
  metadata: any;
  billing?: {
    invoice_number: string;
    invoice_date: string;
    total_amount: number;
    fiscal_data: any;
  };
}

export function useCreditDebitNotes() {
  const [notes, setNotes] = useState<CreditDebitNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("credit_debit_notes")
        .select(`
          *,
          billing:billing_id (
            invoice_number,
            invoice_date,
            total_amount,
            fiscal_data
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;

      setNotes(data || []);
    } catch (err: any) {
      setError(err.message || "Error al cargar notas");
      console.error("Error en useCreditDebitNotes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  return {
    notes,
    loading,
    error,
    fetchNotes,
  };
}
