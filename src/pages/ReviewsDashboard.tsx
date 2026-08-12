import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/ui/use-toast';
import { Link2, RefreshCw, CheckCircle, Star, Plus, X } from 'lucide-react';
import { format } from 'date-fns';

export default function ReviewsDashboard() {
  const [completedRequests, setCompletedRequests] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [manualForm, setManualForm] = useState({ providerId: '', name: '', comment: '', rating: 5 });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();

  const fetchCompletedRequests = async (page = 1) => {
    setLoading(true);
    
    const fromIndex = (page - 1) * itemsPerPage;
    const toIndex = fromIndex + itemsPerPage - 1;

    // Obtener solicitudes completadas con su reseña
    const { data, error } = await supabase
      .from('requests')
      .select(`
        id, 
        title, 
        client_name, 
        client_id,
        created_at,
        reviews!left (
          id,
          review_token,
          review_status,
          rating,
          reviewed_id,
          token_expires_at
        )
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error al cargar', description: error.message });
      setLoading(false);
      return;
    }

    // Obtener reseñas manuales (sin request_id y con custom_reviewer_name)
    const { data: manualData, error: manualError } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        created_at,
        reviewed_id,
        custom_reviewer_name,
        provider:users!reviews_reviewed_id_fkey(name, last_name)
      `)
      .is('request_id', null)
      .not('custom_reviewer_name', 'is', null)
      .order('created_at', { ascending: false })
      .range(fromIndex, toIndex);

    if (manualError) {
      console.error(manualError);
    }

    // Adaptar reseñas manuales al formato de solicitudes
    const manualItems = (manualData || []).map((r: any) => ({
      id: `manual-${r.id}`,
      title: `Reseña Manual a ${r.provider?.name || ''} ${r.provider?.last_name || ''}`,
      client_name: r.custom_reviewer_name || 'Anónimo',
      client_id: null,
      created_at: r.created_at,
      reviews: [{
        id: r.id,
        review_token: null,
        review_status: 'completed',
        rating: r.rating,
        reviewed_id: r.reviewed_id,
        token_expires_at: null
      }]
    }));

    // Combinar y ordenar por fecha (más reciente primero)
    const allItems = [...(data || []), ...manualItems].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setCompletedRequests(allItems);
    
    // Fetch providers for manual reviews
    const { data: provs } = await supabase
      .from('users')
      .select('id, name, last_name')
      .eq('is_provider', true)
      .order('name');
    if (provs) setProviders(provs);
    
    setLoading(false);
  };

  useEffect(() => {
    fetchCompletedRequests(currentPage);
  }, [currentPage]);

  const createManualReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualForm.providerId || !manualForm.name || manualForm.rating < 1) {
      toast({ variant: 'destructive', title: 'Datos incompletos', description: 'Llena todos los campos requeridos.' });
      return;
    }

    try {
      const { error } = await supabase
        .from('reviews')
        .insert({
          reviewed_id: manualForm.providerId,
          custom_reviewer_name: manualForm.name,
          comment: manualForm.comment,
          rating: manualForm.rating,
          review_status: 'completed',
          is_visible: true
        });

      if (error) throw error;
      
      toast({ title: 'Reseña Creada', description: 'La reseña se guardó correctamente y ya afecta al profesional.' });
      setShowModal(false);
      setManualForm({ providerId: '', name: '', comment: '', rating: 5 });
      fetchCompletedRequests(currentPage);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const generateToken = async (requestId: string, clientId: string) => {
    try {
      // Necesitamos el proveedor que hizo el servicio para que sea calificado.
      // Primero buscamos la quote aceptada para saber quién fue el proveedor
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('provider_id')
        .eq('request_id', requestId)
        .eq('status', 'accepted')
        .single();
        
      if (quoteError || !quote) throw new Error("No se encontró el proveedor para esta solicitud");
      
      const providerId = quote.provider_id;
      
      const { error } = await supabase
        .from('reviews')
        .insert({
          request_id: requestId,
          reviewer_id: clientId,
          reviewed_id: providerId,
          review_status: 'pending',
          rating: 0,
        })
        .select()
        .single();

      if (error) throw error;
      
      toast({
        title: 'URL Generada',
        description: 'Se ha creado el enlace de calificación',
      });
      fetchCompletedRequests();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    }
  };

  const regenerateToken = async (reviewId: string) => {
     const { error } = await supabase
        .from('reviews')
        .update({
          // El token se autogenera en la BD por el trigger si nullificamos u otro campo?
          // No, el token se genera con uuid_generate_v4() si está vacío.
          review_token: crypto.randomUUID(),
          token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        })
        .eq('id', reviewId);
        
    if (error) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } else {
      toast({ title: 'Token renovado' });
      fetchCompletedRequests();
    }
  };

  const copyUrl = (token: string) => {
    const url = `https://servisv.com/rate/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'URL Copiada al portapapeles' });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Panel de Reseñas
          </h2>
          <p className="text-slate-500 mt-1">
            Gestiona los enlaces de calificación para clientes olvidadizos.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            <Plus className="w-4 h-4" /> Reseña Manual
          </button>
          <button onClick={() => fetchCompletedRequests(currentPage)} className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="w-4 h-4" /> Refrescar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando solicitudes...</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Solicitud</th>
                <th className="px-6 py-4 font-semibold">Cliente</th>
                <th className="px-6 py-4 font-semibold">Estado Reseña</th>
                <th className="px-6 py-4 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {completedRequests.map((req) => {
                const review = req.reviews && req.reviews.length > 0 ? req.reviews[0] : null;
                const isPending = review && review.review_status === 'pending';
                const isCompleted = review && review.review_status === 'completed';
                
                return (
                  <tr key={req.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-900">{req.title}</p>
                      <p className="text-xs text-slate-500">{format(new Date(req.created_at), 'dd/MM/yyyy')}</p>
                    </td>
                    <td className="px-6 py-4">{req.client_name}</td>
                    <td className="px-6 py-4">
                      {!review && <span className="inline-flex items-center text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md text-xs font-medium">Sin Reseña</span>}
                      {isPending && <span className="inline-flex items-center text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs font-medium border border-amber-200 shadow-sm">Pendiente</span>}
                      {isCompleted && (
                        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md text-xs font-medium border border-emerald-200 shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Completada</span>
                          <div className="flex items-center gap-1 ml-1 border-l border-emerald-300 pl-1.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span className="font-bold leading-none">{review.rating}</span>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2 items-center">
                        {!review && (
                          <button onClick={() => generateToken(req.id, req.client_id)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 flex items-center">
                            <Link2 className="w-4 h-4 mr-2" />
                            Generar URL
                          </button>
                        )}
                        {isPending && review.review_token && (
                          <>
                            <button onClick={() => copyUrl(review.review_token)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              Copiar URL
                            </button>
                            <button onClick={() => regenerateToken(review.id)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
                              Renovar
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Controles de paginación */}
      {!loading && completedRequests.length > 0 && (
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-slate-500">
            Página {currentPage}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
                currentPage === 1
                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(prev => prev + 1)}
              disabled={completedRequests.length < itemsPerPage}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg border ${
                completedRequests.length < itemsPerPage
                  ? 'border-slate-200 text-slate-400 bg-slate-50 cursor-not-allowed'
                  : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50'
              }`}
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-slate-100">
              <h3 className="font-bold text-lg text-slate-900">Crear Reseña Manual</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={createManualReview} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Profesional a calificar</label>
                <select 
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  value={manualForm.providerId}
                  onChange={(e) => setManualForm({...manualForm, providerId: e.target.value})}
                  required
                >
                  <option value="">Selecciona un proveedor...</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.last_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre (Inventado/Manual)</label>
                <input 
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  value={manualForm.name}
                  onChange={(e) => setManualForm({...manualForm, name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Calificación (1 a 5)</label>
                <input 
                  type="number"
                  min="1"
                  max="5"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  value={manualForm.rating}
                  onChange={(e) => setManualForm({...manualForm, rating: parseInt(e.target.value)})}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Comentario (Opcional)</label>
                <textarea 
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-indigo-500 focus:outline-none"
                  rows={3}
                  value={manualForm.comment}
                  onChange={(e) => setManualForm({...manualForm, comment: e.target.value})}
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
                  Guardar Reseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
