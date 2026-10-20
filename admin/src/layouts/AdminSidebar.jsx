import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRole } from '../constants';
import {
  HomeIcon, UsersIcon, BuildingOfficeIcon, MapPinIcon, BellIcon,
  ChartBarIcon, TagIcon, Cog6ToothIcon, MapIcon, ShieldCheckIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const navSections = [
  {
    label: null,
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
    ],
  },
  {
    label: 'Field Data',
    items: [
      { to: '/clients', label: 'Farmers', icon: BuildingOfficeIcon },
      { to: '/visits', label: 'Visit Logs', icon: MapPinIcon },
      { to: '/followups', label: 'Follow-ups', icon: BellIcon },
      { to: '/map', label: 'Live Map', icon: MapIcon },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/reports', label: 'Reports & Analytics', icon: ChartBarIcon },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users & Team', icon: UsersIcon },
      { to: '/brands', label: 'Brands & Products', icon: TagIcon },
      { to: '/billing', label: 'Billing', icon: ClipboardDocumentListIcon },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/settings', label: 'Portal Settings', icon: Cog6ToothIcon },
    ],
  },
];

export default function AdminSidebar() {
  const { user } = useAuth();

  return (
    <aside className="hidden lg:flex lg:flex-col h-full w-64 bg-white border-r border-gray-200 z-20 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center px-5 py-3.5 border-b border-gray-100">
        <NavLink to="/dashboard" className="flex items-center">
          <img src="/topnavlogo.png" alt="Logo" className="h-9 w-auto max-w-[170px] object-contain" />
        </NavLink>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? 'mt-5' : ''}>
            {section.label && (
              <p className="px-2 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 p-3">
        <NavLink
          to="/profile"
          className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-100 transition group"
          title="Profile & Settings"
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 group-hover:ring-2 group-hover:ring-blue-400 transition">
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition">{user?.full_name}</p>
            <p className="text-xs text-blue-600 font-medium">{formatRole(user?.role)}</p>
          </div>
        </NavLink>
      </div>
    </aside>
  );
}
