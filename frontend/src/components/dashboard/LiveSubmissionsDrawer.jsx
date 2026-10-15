import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { dashboardApi } from '../../services/api';
import {
  XMarkIcon, ArrowPathIcon, BeakerIcon, MapPinIcon,
  CheckCircleIcon, ClockIcon, UserCircleIcon, CircleStackIcon,
  SparklesIcon, FunnelIcon,
} from '@heroicons/react/24/outline';

export function LiveSubmissionsWidget({ onClick }) {
  const { data, isFetching } = useQuery({
    queryKey: ['live-submissions-today'],
    queryFn: () => dashboardApi.getLiveSubmissions().then(r => r.data.data),
    refetchInterval: 15000,
  });

  const total = data?.total_today ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center gap-3 bg-white hover:bg-emerald-50/50 border border-emerald-300 hover:border-emerald-500 rounded-xl px-4 py-2.5 shadow-xs hover:shadow transition-all text-left cursor-pointer"
      title="Click to view today's live submissions"
    >
      {/* Live Pulsing Dot */}
      <div className="relative flex h-3 w-3 flex-shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-900 group-hover:text-emerald-900 transition tracking-tight">
            Live Submissions
          </span>
          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {total} Today
          </span>
        </div>
        <span className="text-[11px] text-gray-500 group-hover:text-emerald-700 transition">
          Click to see today's submissions →
        </span>
      </div>

      {isFetching && (
        <ArrowPathIcon className="w-3.5 h-3.5 text-emerald-600 animate-spin ml-1 flex-shrink-0" />
      )}
    </button>
  );
}

export function LiveSubmissionsDrawer({ isOpen, onClose }) {
  const [filterType, setFilterType] = useState('all');

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['live-submissions-today'],
    queryFn: () => dashboardApi.getLiveSubmissions().then(r => r.data.data),
    refetchInterval: 15000,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const rawSubmissions = data?.submissions || [];

  const filteredSubmissions = rawSubmissions.filter(sub => {
    if (filterType === 'all') return true;
    if (filterType === 'tests') return sub.source === 'test_submission';
    if (filterType === 'visits') return sub.source === 'visit';
    if (filterType === 'verified') return ['VERIFIED', 'APPROVED'].includes(sub.status);
    if (filterType === 'pending') return ['PENDING', 'PENDING_VERIFICATION'].includes(sub.status);
    return true;
  });

  const testsCount = rawSubmissions.filter(s => s.source === 'test_submission').length;
  const visitsCount = rawSubmissions.filter(s => s.source === 'visit').length;
  const verifiedCount = rawSubmissions.filter(s => ['VERIFIED', 'APPROVED'].includes(s.status)).length;
  const pendingCount = rawSubmissions.filter(s => ['PENDING', 'PENDING_VERIFICATION'].includes(s.status)).length;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
          
          {/* Header */}
          <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-gray-50 via-white to-emerald-50/30">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  LIVE
                </span>
                <h2 className="text-lg font-bold text-gray-900">Today's Submissions</h2>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition"
                  title="Refresh now"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-600' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  title="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-1">
              Real-time feed of tests, pond diagnostics, and visits recorded by field executives today.
            </p>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterType === 'all'
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({rawSubmissions.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('tests')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterType === 'tests'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                Water & Tests ({testsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('visits')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterType === 'visits'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Visits ({visitsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('verified')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterType === 'verified'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Verified ({verifiedCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pending')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  filterType === 'pending'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                Pending ({pendingCount})
              </button>
            </div>
          </div>

          {/* Submissions List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-gray-50/50">
            {isLoading ? (
              <div className="py-20 text-center">
                <ArrowPathIcon className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-2" />
                <p className="text-sm font-medium text-gray-600">Loading today's submissions...</p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="py-20 text-center px-4">
                <CircleStackIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-800">No submissions found</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                  {filterType !== 'all'
                    ? 'No submissions match this filter. Try selecting "All" above.'
                    : 'No field submissions received yet today. When technical executives submit test results or visits, they will show up here live.'}
                </p>
                {filterType !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className="btn-secondary btn-sm text-xs mt-3"
                  >
                    View All Submissions
                  </button>
                )}
              </div>
            ) : (
              filteredSubmissions.map((sub) => {
                const isVerified = ['VERIFIED', 'APPROVED'].includes(sub.status);
                let parsedParams = sub.parameters;
                if (typeof parsedParams === 'string') {
                  try {
                    parsedParams = JSON.parse(parsedParams);
                  } catch {
                    parsedParams = null;
                  }
                }

                return (
                  <div
                    key={sub.id}
                    className="bg-white rounded-xl border border-gray-200/90 p-4 shadow-xs hover:shadow-md transition space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`p-1.5 rounded-lg ${
                          sub.source === 'visit' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {sub.source === 'visit' ? (
                            <MapPinIcon className="w-4 h-4" />
                          ) : (
                            <BeakerIcon className="w-4 h-4" />
                          )}
                        </span>
                        <div>
                          <h4 className="font-bold text-gray-900 text-sm">{sub.submission_type}</h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                            <ClockIcon className="w-3.5 h-3.5" />
                            <span>{sub.submission_time || 'Today'}</span>
                            {sub.source && (
                              <span className="capitalize">• {sub.source === 'visit' ? 'Visit Log' : 'Field Test'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${
                        isVerified
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-amber-50 text-amber-700 border-amber-300'
                      }`}>
                        {sub.status || 'SUBMITTED'}
                      </span>
                    </div>

                    {/* Submitter & Farmer Details */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                          Executive / ASM
                        </span>
                        <p className="font-semibold text-gray-900 mt-0.5">{sub.submitter_name}</p>
                        <p className="text-[11px] text-gray-500 capitalize">{sub.submitter_role || 'Field Executive'}</p>
                      </div>

                      <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100">
                        <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                          Farmer & Tank
                        </span>
                        <Link
                          to={sub.farmer_id ? `/clients/${sub.farmer_id}` : '/clients'}
                          onClick={onClose}
                          className="font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-0.5 truncate block"
                          title={sub.farmer_name}
                        >
                          {sub.farmer_name}
                        </Link>
                        <p className="text-[11px] text-gray-500 truncate">
                          {sub.tank_name} {sub.locality ? `• ${sub.locality}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Parameters Preview if available */}
                    {parsedParams && typeof parsedParams === 'object' && Object.keys(parsedParams).length > 0 && (
                      <div className="bg-blue-50/40 rounded-lg p-2.5 border border-blue-100/80">
                        <span className="text-[10px] uppercase font-bold text-blue-600 block mb-1 tracking-wider">
                          Submitted Parameters
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(parsedParams).map(([key, val]) => {
                            if (val === null || val === undefined || val === '') return null;
                            const formattedKey = key
                              .replace(/_/g, ' ')
                              .replace(/ppm|ppt|pct|c|grams/gi, '')
                              .trim();
                            return (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 bg-white border border-blue-200/80 rounded-md px-2 py-0.5 text-[11px] text-gray-800 font-medium shadow-2xs"
                              >
                                <span className="text-gray-400 capitalize">{formattedKey}:</span>
                                <strong className="text-blue-700">{String(val)}</strong>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Notes / Highlights */}
                    {sub.notes && (
                      <div className="text-xs text-gray-600 bg-gray-50 rounded-lg p-2 border border-gray-100 italic">
                        "{sub.notes}"
                      </div>
                    )}

                    {/* Footer link */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-[11px] text-gray-400">
                        ID: {sub.id}
                      </span>
                      <Link
                        to={sub.farmer_id ? `/clients/${sub.farmer_id}` : '/clients'}
                        onClick={onClose}
                        className="font-semibold text-blue-600 hover:text-blue-800 transition text-xs flex items-center gap-1"
                      >
                        Farmer Profile →
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-200 bg-white flex items-center justify-between text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Auto-refreshing every 15s
            </span>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary btn-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
