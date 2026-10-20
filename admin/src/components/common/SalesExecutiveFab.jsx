import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  PlusIcon,
  MapPinIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
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
    badgeColor: 'border-emerald-200 text-emerald-800',
  },
  {
    label: 'New Farmer',
    to: '/clients/new',
    icon: BuildingOfficeIcon,
    color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    badgeColor: 'border-indigo-200 text-indigo-800',
  },
  {
    label: 'Follow-ups',
    to: '/followups',
    icon: BellIcon,
    color: 'bg-sky-600 hover:bg-sky-700 text-white',
    badgeColor: 'border-sky-200 text-sky-800',
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
      {/* Bottom Nav Bar (at left side of Plus) */}
      <nav
        aria-label="Bottom Navigation"
        className="fixed bottom-5 right-24 sm:bottom-7 sm:right-28 z-30 h-16 bg-white/95 backdrop-blur-md border border-gray-200/90 shadow-2xl shadow-slate-900/15 rounded-full px-2.5 sm:px-3.5 items-center gap-1 sm:gap-2 transition-all pointer-events-auto flex"
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
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-150 cursor-pointer ${isActive
                  ? 'text-blue-600 bg-blue-50 font-semibold shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80 active:scale-95'
                }`}
            >
              <Icon className="w-7 h-7 stroke-[2] transition-transform duration-150 hover:scale-110" />
            </Link>
          );
        })}
      </nav>

      {/* Main FAB Container — pointer-events-none so it doesn't block nav clicks */}
      <div
        ref={containerRef}
        className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30 flex flex-col items-end pointer-events-none"
        aria-label="Quick Actions"
      >
        {/* Backdrop overlay when open on mobile */}
        {open && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px] -z-10 transition-opacity pointer-events-auto"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Speed Dial Menu Actions - Only in DOM when open */}
        {open && (
          <div className="flex flex-col items-end gap-3 mb-3 transition-all duration-200 pointer-events-auto">
            {actions.map((act) => {
              const Icon = act.icon;
              return (
                <div
                  key={act.to}
                  onClick={() => handleAction(act.to)}
                  className="group flex items-center gap-3 cursor-pointer pointer-events-auto"
                >
                  <span className="bg-white/95 backdrop-blur-sm text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-md border border-gray-200/80 group-hover:bg-white group-hover:shadow-lg transition">
                    {act.label}
                  </span>
                  <button
                    type="button"
                    aria-label={act.label}
                    className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition-all duration-150 group-hover:scale-110 active:scale-95 ${act.color}`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Main Round Plus Button */}
        <button
          type="button"
          id="sales-executive-fab"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-label="Quick Actions Menu"
          className={`pointer-events-auto w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl shadow-blue-600/30 transition-all duration-200 hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-blue-300 ${open
              ? 'bg-gray-800 hover:bg-gray-900 rotate-45'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          <PlusIcon className="w-7 h-7 stroke-[2.5] transition-transform duration-200" />
        </button>
      </div>
    </>
  );
}
