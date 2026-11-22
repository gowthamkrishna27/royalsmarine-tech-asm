import { Outlet, useLocation } from 'react-router-dom';
import TopBar from './TopBar';
import SalesExecutiveFab from '../components/common/SalesExecutiveFab';

/**
 * FieldLayout — Mobile-first layout for Technical Executives & Area Executive Managers.
 * No sidebar. TopBar + bottom pill nav + floating action button.
 */
export default function FieldLayout() {
  const location = useLocation();

  // Remove nav bar on Log Visit & Create/Edit Farmer forms
  const hideNavBar =
    location.pathname === '/visits/new' ||
    (location.pathname.startsWith('/visits/') && location.pathname !== '/visits') ||
    location.pathname === '/clients/new' ||
    location.pathname.endsWith('/edit');

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <TopBar variant="field" />
        <main
          className={`flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 ${
            hideNavBar ? 'pb-6 sm:pb-8' : 'pb-28 sm:pb-32'
          }`}
        >
          <Outlet />
        </main>
        {!hideNavBar && <SalesExecutiveFab />}
      </div>
    </div>
  );
}
