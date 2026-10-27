import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  TagIcon,
  UsersIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { formatRole } from '../constants';
import toast from 'react-hot-toast';
import NotificationBell from '../components/common/NotificationBell';

/**
 * TopBar — Shared top header bar.
 *
 * @param {"field"|"admin"} variant
 *   - "field" : Mobile-first bar with back button, center logo, settings icon
 *   - "admin" : Desktop admin bar with greeting + settings
 */
export default function TopBar({ variant = 'field' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const isRoot = location.pathname === '/dashboard' || location.pathname === '/';

  const handleBack = () => {
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  // ─── Field variant (mobile-first, for tech executives & ASMs) ────────
  if (variant === 'field') {
    return (
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 relative">
        {/* Left: Back button on mobile */}
        <div className="flex items-center">
          {!isRoot ? (
            <button
              onClick={handleBack}
              aria-label="Back"
              title="Go back"
              className="w-10 h-10 rounded-xl text-gray-700 hover:text-gray-900 hover:bg-gray-100 active:bg-gray-200 active:scale-95 transition flex items-center justify-center -ml-1"
            >
              <ArrowLeftIcon className="w-5 h-5 stroke-[2.5]" />
            </button>
          ) : (
            <div className="w-10 h-10" />
          )}
        </div>

        {/* Center: Logo */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
          <Link to="/dashboard" className="flex items-center">
            <img
              src="/topnavlogo.png"
              alt="Logo"
              className="h-10 sm:h-12 w-auto max-w-[190px] sm:max-w-[250px] object-contain"
            />
          </Link>
        </div>

        {/* Right: Notifications & Settings */}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <SettingsDropdown
            user={user}
            showMenu={showMenu}
            setShowMenu={setShowMenu}
            handleLogout={handleLogout}
            variant="field"
          />
        </div>
      </header>
    );
  }

  // ─── Admin variant (desktop-first, for admins / management) ──────────
  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Left: Greeting */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <p className="text-sm font-semibold text-gray-900">
            Welcome, {user?.full_name?.split(' ')[0]}
          </p>
          <p className="text-[11px] text-gray-400 font-medium">{formatRole(user?.role)}</p>
        </div>
        {/* Mobile logo (when sidebar is hidden) */}
        <div className="sm:hidden">
          <Link to="/dashboard" className="flex items-center">
            <img src="/topnavlogo.png" alt="Logo" className="h-9 w-auto max-w-[150px] object-contain" />
          </Link>
        </div>
      </div>

      {/* Right: Notifications & Settings */}
      <div className="flex items-center gap-2">
        <NotificationBell />
        <SettingsDropdown
          user={user}
          showMenu={showMenu}
          setShowMenu={setShowMenu}
          handleLogout={handleLogout}
          variant="admin"
        />
      </div>
    </header>
  );
}


/* ── Settings Cog Dropdown ─────────────────────────────────────────────── */
function SettingsDropdown({ user, showMenu, setShowMenu, handleLogout, variant }) {
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        aria-label="Settings"
        title="Settings & Menu"
        className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition flex items-center justify-center focus:outline-none"
      >
        <Cog6ToothIcon className="w-6 h-6 text-gray-600 hover:text-gray-900 transition-transform active:rotate-45" />
      </button>

      {showMenu && (
        <>
          {/* Backdrop dismiss */}
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 fade-in">
            <div className="px-4 py-2.5 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-blue-600 font-medium">{formatRole(user?.role)}</p>
            </div>

            <div className="py-1">
              {/* Field variant shows quick links to reports */}
              {variant === 'field' && (
                <Link
                  to="/reports"
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
                >
                  <ChartBarIcon className="w-4 h-4 text-gray-500" /> Reports
                </Link>
              )}

              <Link
                to="/profile"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
              >
                <UserCircleIcon className="w-4 h-4 text-gray-500" /> Profile & Settings
              </Link>
            </div>

            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left transition"
            >
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Logout
            </button>
          </div>
        </>
      )}
    </div>
  );
}
