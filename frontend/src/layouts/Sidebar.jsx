import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  HomeIcon, UsersIcon, BuildingOfficeIcon, MapPinIcon, BellIcon,
  ChartBarIcon, DocumentTextIcon, ShoppingCartIcon, CloudArrowUpIcon,
  TagIcon, CubeIcon, Cog6ToothIcon, XMarkIcon, MapIcon,
} from '@heroicons/react/24/outline';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: ['*'] },
  { to: '/clients', label: 'Farmers', icon: BuildingOfficeIcon, roles: ['*'] },
  { to: '/visits', label: 'Visits', icon: MapPinIcon, roles: ['super_admin','admin','sales_manager','sales_executive'] },
  { to: '/followups', label: 'Follow-ups', icon: BellIcon, roles: ['super_admin','admin','sales_manager','sales_executive'] },
  { to: '/opportunities', label: 'Opportunities', icon: ChartBarIcon, roles: ['super_admin','admin','sales_manager','management'] },
  { to: '/map', label: 'Map', icon: MapIcon, roles: ['super_admin','admin','backend_ops','sales_manager','sales_executive','management'] },
  { to: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCartIcon, roles: ['super_admin','admin','backend_ops','sales_manager'] },
  { to: '/billing', label: 'Billing Import', icon: CloudArrowUpIcon, roles: ['super_admin','admin','backend_ops'] },
  { to: '/reports', label: 'Reports', icon: ChartBarIcon, roles: ['super_admin','admin','sales_manager','management'] },
  { divider: true, label: 'Master Data', roles: ['super_admin','admin'] },
  { to: '/brands', label: 'Brands & Categories', icon: TagIcon, roles: ['super_admin','admin'] },
  { to: '/products', label: 'Products', icon: CubeIcon, roles: ['super_admin','admin'] },
  { to: '/users', label: 'Users', icon: UsersIcon, roles: ['super_admin','admin'] },
  { to: '/settings', label: 'Settings', icon: Cog6ToothIcon, roles: ['super_admin','admin'] },
];

export default function Sidebar({ open, onClose }) {
  const { user, hasRole } = useAuth();

  const visible = navItems.filter((item) =>
    item.roles?.includes('*') || item.roles?.some((r) => hasRole(r))
  );

  return (
    <>
      {/* Overlay */}
      {open && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={onClose} />}

      <aside className={`fixed top-0 left-0 z-30 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300
        ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:z-auto`}>

        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
          <div className="flex items-center">
            <img src="/topnavlogo.png" alt="Logo" className="h-9 w-auto max-w-[170px] object-contain" />
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-100">
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
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
                onClick={onClose}
                className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link-inactive'}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            )
          )}
        </nav>

        {/* User */}
        <div className="border-t border-gray-100 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
