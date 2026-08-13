import { createBrowserRouter } from 'react-router-dom'
import App from './App'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'
import PendingUsers from './pages/PendingUsers'
import Reports from './pages/Reports'
import Requests from './pages/Requests'
import Services from './pages/Services'
import Users from './pages/Users'
import Invoices from './pages/Invoices'
import Facturador from './pages/Facturador'
import FSE from './pages/FSE'
import CreditDebitNotes from './pages/CreditDebitNotes'
import DTEEvents from './pages/DTEEvents'
import LevelsAudit from './pages/LevelsAudit'
import ReviewsDashboard from './pages/ReviewsDashboard'
import ProviderLinks from './pages/ProviderLinks'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: 'usuarios',
        element: <Users />,
      },
      {
        path: 'usuarios/pendientes',
        element: <PendingUsers />,
      },
      {
        path: 'reportes',
        element: <Reports />,
      },
      {
        path: 'servicios',
        element: <Services />,
      },
      {
        path: 'solicitudes',
        element: <Requests />,
      },
      {
        path: 'facturas',
        element: <Invoices />,
      },
      {
        path: 'facturador',
        element: <Facturador />,
      },
      {
        path: 'fse',
        element: <FSE />,
      },
      {
        path: 'notas',
        element: <CreditDebitNotes />,
      },
      {
        path: 'eventos-dte',
        element: <DTEEvents />,
      },
      {
        path: 'auditoria-niveles',
        element: <LevelsAudit />,
      },
      {
        path: 'dashboard-resenas',
        element: <ReviewsDashboard />,
      },
      {
        path: 'enlaces-proveedores',
        element: <ProviderLinks />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

