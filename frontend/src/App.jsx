import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PageSpinner } from './components/common/Spinner';

// Auth pages (shared)
import Login from './pages/auth/Login';
import ForgotPassword from './pages/auth/ForgotPassword';

// Field routes for Technical Executives & Area Executive Managers
import FieldRoutes from './routes/FieldRoutes';

const ADMIN_ROLES = ['super_admin', 'admin', 'management', 'backend_ops'];

function AdminRestrictedScreen() {
  const { logout } = useAuth();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (countdown <= 0) {
      logout().finally(() => {
        window.location.href = '/login';
      });
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, logout]);

  const handleSignOut = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50/90 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 max-w-[280px] w-full p-6 text-center">
        <h2 className="text-sm font-semibold text-red-600 mb-1">
          Restricted Access
        </h2>
        <p className="text-xs text-red-500/80 mb-4 font-medium">
          Signing out in {countdown}s
        </p>
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-2 px-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-medium rounded-lg transition shadow-xs"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

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

  // Admin Account logged into Field App → Show minimal screen & auto sign out in 5s (do not load field app in background)
  if (ADMIN_ROLES.includes(user.role)) {
    return <AdminRestrictedScreen />;
  }

  // Field Staff → load field app
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
