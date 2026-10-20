import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { PageSpinner } from '../components/common/Spinner';

// Admin App pages
import Dashboard from '../pages/dashboard/Dashboard';
import Clients from '../pages/clients/Clients';
import ClientDetail from '../pages/clients/ClientDetail';
import ClientForm from '../pages/clients/ClientForm';
import Visits from '../pages/visits/Visits';
import VisitForm from '../pages/visits/VisitForm';
import Followups from '../pages/followups/Followups';
import Users from '../pages/users/Users';
import Brands from '../pages/brands/Brands';
import Reports from '../pages/reports/Reports';
import ProfilePage from '../pages/profile/Profile';

const MapPage = lazy(() => import('../pages/map/Map'));

/**
 * AdminRoutes — Route tree for Admin / Super Admin / Management / Backend Ops.
 * Desktop-first, full sidebar, all admin modules available.
 */
export default function AdminRoutes() {
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
        <Route path="visits/new" element={<VisitForm />} />
        <Route path="visits/:id" element={<VisitForm />} />

        <Route path="followups" element={<Followups />} />

        <Route path="map" element={<Suspense fallback={<PageSpinner />}><MapPage /></Suspense>} />
        <Route path="reports" element={<Reports />} />
        <Route path="brands" element={<Brands />} />

        {/* Admin-only pages */}
        <Route path="admin" element={<Navigate to="/dashboard" replace />} />
        <Route path="users" element={<Users />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<ProfilePage />} />
      </Route>

      {/* Catch-all: redirect to admin dashboard */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
