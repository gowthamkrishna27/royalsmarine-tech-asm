import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatRole } from '../constants';
import {
  HomeIcon, UsersIcon, BuildingOfficeIcon, MapPinIcon, BellIcon,
  ChartBarIcon, Cog6ToothIcon, MapIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: ['*'] },
  { to: '/clients', label: 'Farmers', icon: BuildingOfficeIcon, roles: ['*'] },
  { to: '/visits', label: 'Visits', icon: MapPinIcon, roles: ['super_admin','admin','sales_manager','sales_executive'] },
  { to: '/followups', label: 'Follow-ups', icon: BellIcon, roles: ['super_admin','admin','sales_manager','sales_executive'] },
  { to: '/map', label: 'Map', icon: MapIcon, roles: ['super_admin','admin','backend_ops','sales_manager','sales_executive','management'] },
  { to: '/reports', label: 'Reports', icon: ChartBarIcon, roles: ['super_admin','admin','sales_manager','sales_executive','management'] },
  { divider: true, label: 'Administration', roles: ['super_admin','admin'] },
  { to: '/users', label: 'Users & Team', icon: UsersIcon, roles: ['super_admin','admin'] },
  { to: '/settings', label: 'Portal Settings', icon: Cog6ToothIcon, roles: ['super_admin','admin'] },
];

export default function Sidebar() {
  const { user, hasRole } = useAuth();

  const visible = navItems.filter((item) =>
    item.roles?.includes('*') || item.roles?.some((r) => hasRole(r))
  );

  return (
    <aside className="hidden lg:flex lg:flex-col lg:static h-full w-64 bg-white border-r border-gray-200 z-20 flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
        <NavLink to="/dashboard" className="flex items-center">
          <img src="/topnavlogo.png" alt="Logo" className="h-9 w-auto max-w-[170px] object-contain" />
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {visible.map((item, idx) =>
          item.divider ? (
            <div key={idx} className="pt-4 pb-1 px-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{item.label}</p>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {item.label}
            </NavLink>
          )
        )}
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
