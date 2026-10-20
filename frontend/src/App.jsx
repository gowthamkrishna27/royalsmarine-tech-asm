import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PageSpinner } from './components/common/Spinner';

// Auth pages (shared)
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// Field routes for Technical Executives & Area Executive Managers
import FieldRoutes from './routes/FieldRoutes';

const FIELD_ROLES = ['sales_executive', 'sales_manager'];
const ADMIN_ROLES = ['super_admin', 'admin', 'management', 'backend_ops'];

function AppRouter() {
  const { user, loading } = useAuth();

  if (loading) return <PageSpinner />;

  // Not logged in → show auth routes
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Field Staff → load field app directly
  if (FIELD_ROLES.includes(user.role)) {
    return <FieldRoutes />;
  }

  // Admin Account logged into Field App
  if (ADMIN_ROLES.includes(user.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🖥️</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Account Detected</h1>
          <p className="text-sm text-gray-600 mb-6">
            This application is designed specifically for <strong>Technical Executives</strong> and <strong>Area Executive Managers</strong>.
            Please access the dedicated <strong>Royals Marine Admin Website</strong>.
          </p>
          <div className="space-y-3">
            <a
              href="http://localhost:3002"
              className="w-full inline-flex justify-center items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition"
            >
              Open Admin Website (Port 3002) →
            </a>
            <button
              onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
              className="w-full inline-flex justify-center items-center px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium rounded-xl transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback: render field app
  return <FieldRoutes />;
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
