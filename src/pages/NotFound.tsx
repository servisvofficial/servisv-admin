import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center text-white">
      <p className="text-sm uppercase tracking-[0.35em] text-white/40">404</p>
      <h2 className="mt-2 text-3xl font-semibold">Página no encontrada</h2>
      <p className="mt-2 text-white/60">
        No pudimos encontrar la ruta solicitada. Verifica la URL o vuelve al panel.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-2 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300"
      >
        Volver al inicio
      </Link>
    </div>
  )
}

export default NotFound

