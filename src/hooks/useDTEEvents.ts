import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface DTEEvent {
  id: string;
  event_type: 'invalidacion' | 'contingencia';
  billing_id: string | null;
  dte_codigo_generacion: string;
  dte_numero_control: string | null;
  dte_sello_recepcion: string | null;
  dte_estado: string;
  dte_json: any;
  dte_response: any;
  dte_observaciones: string[] | null;
  motivo: string;
  dtes_reportados: number;
  qr_url: string | null;
  created_at: string;
  updated_at: string;
  billing?: {
    invoice_number: string;
    fiscal_data: any;
  };
}

export function useDTEEvents() {
  const [events, setEvents] = useState<DTEEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from('dte_events')
        .select(`
          *,
          billing (
            invoice_number,
            fiscal_data
          )
        `)
        .order('created_at', { ascending: false });

      if (queryError) throw queryError;

      setEvents(data || []);
    } catch (err: any) {
      console.error('Error cargando eventos DTE:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  return {
    events,
    loading,
    error,
    refresh: loadEvents,
  };
}
