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
import CreditDebitNotes from './pages/CreditDebitNotes'
import ProviderInvoices from './pages/ProviderInvoices'
import DTEEvents from './pages/DTEEvents'

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
        path: 'facturas-proveedor',
        element: <ProviderInvoices />,
      },
      {
        path: 'notas',
        element: <CreditDebitNotes />,
      },
      {
        path: 'eventos-dte',
        element: <DTEEvents />,
      },
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
])

