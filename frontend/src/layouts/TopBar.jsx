import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bars3Icon, BellIcon, ArrowRightOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../services/api';
import toast from 'react-hot-toast';

export default function TopBar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);

  const { data: notifData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list().then(r => r.data.data),
    refetchInterval: 60000,
  });

  const unread = notifData?.filter(n => !n.is_read).length || 0;

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 gap-3 sticky top-0 z-10">
      <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-gray-100 lg:hidden">
        <Bars3Icon className="w-6 h-6 text-gray-600" />
      </button>

      <div className="flex-1" />

      {/* Notifications */}
      <div className="relative">
        <button
          onClick={() => setShowNotifs(!showNotifs)}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition"
        >
          <BellIcon className="w-5 h-5 text-gray-600" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        {showNotifs && (
          <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="font-semibold text-sm">Notifications</span>
              {unread > 0 && (
                <button onClick={() => notificationApi.readAll()} className="text-xs text-blue-600 hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {(notifData?.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-8">No notifications</p>
            )}
            {notifData?.map(n => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                <p className="text-sm font-medium text-gray-900">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {user?.full_name?.[0]}
          </div>
          <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.full_name?.split(' ')[0]}</span>
        </button>
        {showMenu && (
          <div className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
            <Link to="/profile" onClick={() => setShowMenu(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <UserCircleIcon className="w-4 h-4" /> Profile
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
              <ArrowRightOnRectangleIcon className="w-4 h-4" /> Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
