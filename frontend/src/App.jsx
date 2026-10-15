import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './routes/PrivateRoute';
import AppLayout from './layouts/AppLayout';
import { PageSpinner } from './components/common/Spinner';

// Auth pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// App pages
import Dashboard from './pages/dashboard/Dashboard';
import Clients from './pages/clients/Clients';
import ClientDetail from './pages/clients/ClientDetail';
import ClientForm from './pages/clients/ClientForm';
import Visits from './pages/visits/Visits';
import VisitForm from './pages/visits/VisitForm';
import Followups from './pages/followups/Followups';
import Opportunities from './pages/opportunities/Opportunities';
import OpportunityDetail from './pages/opportunities/OpportunityDetail';
import OpportunityForm from './pages/opportunities/OpportunityForm';
import Users from './pages/users/Users';
import Brands from './pages/brands/Brands';
import Reports from './pages/reports/Reports';
import BillingImport from './pages/billing/BillingImport';
import QuotationsPage from './pages/quotations/Quotations';
import PurchaseOrdersPage from './pages/purchaseOrders/PurchaseOrders';
import ProfilePage from './pages/profile/Profile';
import TanksPage from './pages/tanks/Tanks';
import TeamListPage from './pages/team/TeamList';
import SettingsPage from './pages/settings/Settings';

const MapPage = lazy(() => import('./pages/map/Map'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* Protected */}
          <Route path="/" element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />

            <Route path="clients" element={<Clients />} />
            <Route path="clients/new" element={<ClientForm />} />
            <Route path="clients/:id" element={<ClientDetail />} />
            <Route path="clients/:id/edit" element={<ClientForm />} />

            <Route path="tanks" element={<TanksPage />} />
            <Route path="team/asms" element={<TeamListPage defaultRole="sales_manager" />} />
            <Route path="team/technical-executives" element={<TeamListPage defaultRole="sales_executive" />} />

            <Route path="visits" element={<Visits />} />
            <Route path="visits/new" element={<VisitForm />} />
            <Route path="visits/:id" element={<VisitForm />} />

            <Route path="followups" element={<Followups />} />

            <Route path="opportunities" element={<PrivateRoute roles={['super_admin','admin','sales_manager','management']}><Opportunities /></PrivateRoute>} />
            <Route path="opportunities/new" element={<PrivateRoute roles={['super_admin','admin','sales_manager','management']}><OpportunityForm /></PrivateRoute>} />
            <Route path="opportunities/:id" element={<PrivateRoute roles={['super_admin','admin','sales_manager','management']}><OpportunityDetail /></PrivateRoute>} />

            <Route path="map" element={<Suspense fallback={<PageSpinner />}><MapPage /></Suspense>} />
            <Route path="quotations" element={<Navigate to="/map" replace />} />
            <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
            <Route path="billing" element={<BillingImport />} />
            <Route path="reports" element={<Reports />} />
            <Route path="brands" element={<Brands />} />
            <Route path="users" element={<PrivateRoute roles={['super_admin','admin']}><Users /></PrivateRoute>} />
            <Route path="settings" element={<PrivateRoute roles={['super_admin','admin']}><SettingsPage /></PrivateRoute>} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
