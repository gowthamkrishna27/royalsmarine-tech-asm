import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  PlusIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  BellIcon,
  HomeIcon,
  MapIcon,
} from '@heroicons/react/24/outline';

const actions = [
  {
    label: 'Log Visit',
    to: '/visits/new',
    icon: MapPinIcon,
    color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  },
  {
    label: 'New Farmer',
    to: '/clients/new',
    icon: BuildingOfficeIcon,
    color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  },
  {
    label: 'Follow-ups',
    to: '/followups',
    icon: BellIcon,
    color: 'bg-sky-600 hover:bg-sky-700 text-white',
  },
];

export default function SalesExecutiveFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const containerRef = useRef(null);
  const { hasRole } = useAuth();

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const handleAction = (to) => {
    setOpen(false);
    navigate(to);
  };

  const navItems = [
    { to: '/dashboard', label: 'Home', icon: HomeIcon },
    { to: '/clients', label: 'Farmers', icon: BuildingOfficeIcon },
    { to: '/visits', label: 'Visits', icon: MapPinIcon },
    { to: '/followups', label: 'Follow-ups', icon: BellIcon },
    { to: '/map', label: 'Map', icon: MapIcon },
  ];

  return (
    <>
      {/* Full-screen Backdrop when Speed Dial is open */}
      {open && (
        <div
          className="fixed inset-0 bg-black/25 backdrop-blur-[1px] z-30 transition-opacity pointer-events-auto"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Floating Dock: Large prominent scale with dynamic auto-scale adaptation */}
      <div
        className="fixed bottom-5 sm:bottom-7 right-3 sm:right-6 z-30 flex items-center gap-2.5 sm:gap-3 max-w-[calc(100vw-1.25rem)] pointer-events-none origin-bottom-right"
        style={{
          // Scale dynamically if screen is narrower than 365px, while giving a bold, large scale on standard & large screens
          transform: 'scale(min(1, calc((100vw - 20px) / 365px)))',
          transformOrigin: 'bottom right',
        }}
      >
        {/* Floating Nav Pill (Larger icons and comfortable touch targets) */}
        <nav
          aria-label="Bottom Navigation"
          className="h-16 sm:h-18 bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-2xl shadow-slate-900/15 rounded-full px-2.5 sm:px-3.5 flex items-center gap-1.5 sm:gap-2 pointer-events-auto shrink-0"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.to === '/dashboard'
                ? location.pathname === '/dashboard' || location.pathname === '/'
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                title={item.label}
                aria-label={item.label}
                onClick={() => setOpen(false)}
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'text-blue-600 bg-blue-50 font-semibold shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 active:scale-95'
                }`}
              >
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.2] transition-transform duration-150 hover:scale-110" />
              </Link>
            );
          })}
        </nav>

        {/* Floating Plus Button & Speed Dial Menu Container */}
        <div ref={containerRef} className="relative shrink-0 pointer-events-auto">
          {/* Speed Dial Menu Actions - Sits directly above (+) button */}
          {open && (
            <div className="absolute bottom-full right-0 mb-3.5 flex flex-col items-end gap-3 transition-all duration-200 pointer-events-auto">
              {actions.map((act) => {
                const Icon = act.icon;
                return (
                  <div
                    key={act.to}
                    onClick={() => handleAction(act.to)}
                    className="group flex items-center gap-3 cursor-pointer pointer-events-auto"
                  >
                    <span className="bg-white/95 backdrop-blur-sm text-gray-800 text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl shadow-lg border border-gray-200/90 group-hover:bg-white transition whitespace-nowrap">
                      {act.label}
                    </span>
                    <button
                      type="button"
                      aria-label={act.label}
                      className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 group-hover:scale-110 active:scale-95 ${act.color}`}
                    >
                      <Icon className="w-6 h-6" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Round Plus Button (Larger & Prominent) */}
          <button
            type="button"
            id="sales-executive-fab"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-label="Quick Actions Menu"
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center text-white shadow-2xl shadow-blue-600/40 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 ${
              open
                ? 'bg-gray-800 hover:bg-gray-900 rotate-45'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            <PlusIcon className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.5] transition-transform duration-200" />
          </button>
        </div>
      </div>
    </>
  );
}
