import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../components/ui/use-toast';
import { Shield, Search, Star, Edit, Save, X } from 'lucide-react';

export default function LevelsAudit() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'provider' | 'client'>('all');
  const [page, setPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    provider_level: 'none',
    loyalty_points_balance: 0,
    is_level_locked: false,
  });
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    let query = supabase
      .from('users')
      .select('id, name, last_name, email, is_provider, provider_level, loyalty_points_balance, rating, is_level_locked', { count: 'exact' })
      .order('is_provider', { ascending: false })
      .order('name');
      
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    if (filterType === 'provider') {
      query = query.eq('is_provider', true);
    } else if (filterType === 'client') {
      query = query.eq('is_provider', false);
    }

    const { data, error, count } = await query.range((page - 1) * 10, page * 10 - 1);
    
    if (error) {
      console.error(error);
    } else {
      setUsers(data || []);
      setTotalUsers(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, [search, filterType, page]);

  const handleEdit = (user: any) => {
    setEditingId(user.id);
    setEditForm({
      provider_level: user.provider_level || 'none',
      loyalty_points_balance: user.loyalty_points_balance || 0,
      is_level_locked: user.is_level_locked || false,
    });
  };

  const handleSave = async (id: string) => {
    const { error } = await supabase
      .from('users')
      .update({
        provider_level: editForm.provider_level,
        loyalty_points_balance: editForm.loyalty_points_balance,
        is_level_locked: editForm.is_level_locked,
      })
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error al actualizar',
        description: error.message,
      });
    } else {
      toast({
        title: 'Usuario actualizado',
        description: 'Se han guardado los cambios correctamente.',
      });
      setEditingId(null);
      fetchUsers();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Auditoría de Niveles y Puntos
          </h2>
          <p className="text-slate-500 mt-1">
            Revisa los puntos de fidelización y ajusta los niveles de profesionales si es necesario.
          </p>
        </div>
      </div>

      <div className="flex items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 gap-3">
        <Search className="text-slate-400 w-5 h-5" />
        <input 
          placeholder="Buscar usuario..."
          className="w-full border-none shadow-none focus-visible:outline-none text-base bg-transparent"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select 
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 bg-white"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value as any);
            setPage(1);
          }}
        >
          <option value="all">Todos</option>
          <option value="provider">Proveedores</option>
          <option value="client">Clientes</option>
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Cargando usuarios...</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Usuario</th>
                <th className="px-6 py-4 font-semibold">Tipo</th>
                <th className="px-6 py-4 font-semibold">Nivel (Prov)</th>
                <th className="px-6 py-4 font-semibold">Puntos</th>
                <th className="px-6 py-4 font-semibold">Rating / Reseñas</th>
                <th className="px-6 py-4 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-900">{u.name} {u.last_name}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_provider ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {u.is_provider ? 'Proveedor' : 'Cliente'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === u.id && u.is_provider ? (
                      <select 
                        className="border border-slate-300 rounded p-1 text-sm"
                        value={editForm.provider_level}
                        onChange={(e) => setEditForm({...editForm, provider_level: e.target.value})}
                      >
                        <option value="none">Ninguno</option>
                        <option value="bronce">Bronce</option>
                        <option value="plata">Plata</option>
                        <option value="oro">Oro</option>
                      </select>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getLevelBadgeStyle(u.provider_level)}`}>
                          {u.provider_level?.toUpperCase() || 'NONE'}
                        </span>
                        {u.is_level_locked && (
                          <span title="Nivel bloqueado manualmente" className="text-amber-500">
                            🔒
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === u.id ? (
                      <input 
                        type="number" 
                        className="w-20 px-2 py-1 h-8 border border-slate-300 rounded focus:outline-none focus:border-indigo-500"
                        value={editForm.loyalty_points_balance}
                        onChange={(e) => setEditForm({...editForm, loyalty_points_balance: parseInt(e.target.value) || 0})}
                      />
                    ) : (
                      <span className="font-medium text-emerald-600">{u.loyalty_points_balance || 0} pts</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.is_provider ? (
                      <div className="flex items-center gap-1 text-slate-700">
                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                        <span>{parseFloat(u.rating || 0).toFixed(1)}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === u.id ? (
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-50">
                            <X className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleSave(u.id)} className="rounded-lg bg-indigo-600 px-2 py-1.5 text-white hover:bg-indigo-700">
                            <Save className="w-4 h-4" />
                          </button>
                        </div>
                        {u.is_provider && (
                          <div className="flex items-center gap-2 mt-2">
                            <input 
                              type="checkbox"
                              id={`lock-${u.id}`}
                              checked={editForm.is_level_locked}
                              onChange={(e) => setEditForm({...editForm, is_level_locked: e.target.checked})}
                              className="rounded border-slate-300"
                            />
                            <label htmlFor={`lock-${u.id}`} className="text-xs text-slate-600 flex items-center gap-1">
                              🔒 Bloquear Nivel (Evitar Auto-reset)
                            </label>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button onClick={() => handleEdit(u)} className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100">
                        <Edit className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && totalUsers > 10 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-6 py-4">
            <div className="text-sm text-slate-600">
              Página {page} de {Math.ceil(totalUsers / 10)} (Total: {totalUsers})
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(p => Math.min(Math.ceil(totalUsers / 10), p + 1))}
                disabled={page === Math.ceil(totalUsers / 10)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
