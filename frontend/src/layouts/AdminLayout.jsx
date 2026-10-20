import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';
import TopBar from './TopBar';

/**
 * AdminLayout — Desktop-first layout for Admin / Super Admin / Management / Backend Ops.
 * Full sidebar navigation, desktop-oriented TopBar, no mobile FAB.
 */
export default function AdminLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar variant="admin" />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
