import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../context/AuthContext';
import SalesExecutiveFab from '../components/common/SalesExecutiveFab';

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();

  // Remove nav bar on Log Visit & Create/Edit Farmer forms
  const hideNavBar =
    location.pathname === '/visits/new' ||
    (location.pathname.startsWith('/visits/') && location.pathname !== '/visits') ||
    location.pathname === '/clients/new' ||
    location.pathname.endsWith('/edit');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 ${
            hideNavBar ? 'pb-6 sm:pb-8' : 'pb-28 sm:pb-32'
          }`}
        >
          <Outlet />
        </main>
        {user?.role !== 'viewer' && !hideNavBar && <SalesExecutiveFab />}
      </div>
    </div>
  );
}
