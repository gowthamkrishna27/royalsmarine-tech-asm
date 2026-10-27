import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PageSpinner } from './components/common/Spinner';

// Auth pages
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// Layout
import AdminLayout from './layouts/AdminLayout';

// Pages
import Dashboard from './pages/dashboard/Dashboard';
import Clients from './pages/clients/Clients';
import ClientDetail from './pages/clients/ClientDetail';
import ClientForm from './pages/clients/ClientForm';
import Visits from './pages/visits/Visits';
import VisitDetail from './pages/visits/VisitDetail';
import Followups from './pages/followups/Followups';
import Users from './pages/users/Users';
import Brands from './pages/brands/Brands';
import BillingImport from './pages/billing/BillingImport';
import Reports from './pages/reports/Reports';
import HarvestedTanks from './pages/tanks/HarvestedTanks';
import FcrTracker from './pages/fcr/FcrTracker';
import ProfilePage from './pages/profile/Profile';

const MapPage = lazy(() => import('./pages/map/Map'));

const ADMIN_ROLES = ['super_admin', 'admin', 'management', 'backend_ops'];

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <PageSpinner />;

  // Not logged in → auth routes
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Only admin roles can use this portal
  if (!ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-sm text-gray-500 mb-6">This portal is for administrators only. Please use the field app to access your account.</p>
          <button
            onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
            className="btn-primary"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Admin portal routes
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />

        <Route path="clients" element={<Clients />} />
        <Route path="clients/new" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />

        <Route path="visits" element={<Visits />} />
        <Route path="visits/new" element={<Navigate to="/visits" replace />} />
        <Route path="visits/:id" element={<VisitDetail />} />
        <Route path="visits/:id/edit" element={<Navigate to="/visits/:id" replace />} />

        <Route path="followups" element={<Followups />} />

        <Route path="map" element={<Suspense fallback={<PageSpinner />}><MapPage /></Suspense>} />
        <Route path="reports" element={<Reports />} />
        <Route path="harvested-tanks" element={<HarvestedTanks />} />
        <Route path="fcr" element={<FcrTracker />} />
        <Route path="brands" element={<Brands />} />
        <Route path="billing" element={<BillingImport />} />

        <Route path="admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="users" element={<Users />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}
