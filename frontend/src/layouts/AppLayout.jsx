import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { useAuth } from '../context/AuthContext';
import SalesExecutiveFab from '../components/common/SalesExecutiveFab';

export default function AppLayout() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-28 sm:pb-32">
          <Outlet />
        </main>
        {user?.role !== 'viewer' && <SalesExecutiveFab />}
      </div>
    </div>
  );
}
