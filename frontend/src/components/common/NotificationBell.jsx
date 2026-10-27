import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../services/api';
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list().then((r) => r.data.data || []),
    refetchInterval: 15000, // Poll every 15s to get real-time message updates
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.readAll();
      qc.invalidateQueries(['notifications']);
    } catch (e) {
      console.error('Failed to mark all notifications as read', e);
    }
  };

  const handleNotificationClick = async (notif) => {
    try {
      if (!notif.is_read) {
        await notificationApi.read(notif.id);
        qc.invalidateQueries(['notifications']);
      }
      setOpen(false);
      if (notif.reference_type === 'followup') {
        navigate('/followups');
      } else if (notif.reference_type === 'visit' && notif.reference_id) {
        navigate(`/visits/${notif.reference_id}`);
      }
    } catch (e) {
      console.error('Failed to read notification', e);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition relative flex items-center justify-center focus:outline-none"
        aria-label="Notifications"
        title="Notifications"
      >
        <BellIcon className="w-6 h-6 text-gray-600 hover:text-gray-900" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 fade-in text-xs">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-gray-900 text-sm">Notifications & Messages</span>
                {unreadCount > 0 && (
                  <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-primary-600 hover:underline font-semibold flex items-center gap-1"
                >
                  <CheckIcon className="w-3.5 h-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-400">
                  <BellIcon className="w-8 h-8 mx-auto mb-1 text-gray-300" />
                  <p>No messages or notifications yet.</p>
                </div>
              ) : (
                notifications.slice(0, 15).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 cursor-pointer hover:bg-gray-50 transition-colors flex items-start gap-2.5 ${
                      !notif.is_read ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        !notif.is_read ? 'bg-blue-600' : 'bg-transparent'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{notif.title}</p>
                      <p className="text-gray-600 line-clamp-2 mt-0.5 text-[11px] leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        {notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
