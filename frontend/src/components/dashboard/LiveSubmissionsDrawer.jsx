import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../../services/api';
import {
  XMarkIcon,
  ArrowPathIcon,
  ClockIcon,
  EyeIcon,
  CircleStackIcon,
  MapPinIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';

export function LiveSubmissionsWidget({ onClick }) {
  const { data, isFetching } = useQuery({
    queryKey: ['live-submissions-today'],
    queryFn: () => dashboardApi.getLiveSubmissions().then((r) => r.data.data),
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

function SubmissionDetailsModal({ submission, onClose }) {
  if (!submission) return null;

  let parsedParams = submission.parameters;
  if (typeof parsedParams === 'string') {
    try {
      parsedParams = JSON.parse(parsedParams);
    } catch {
      parsedParams = null;
    }
  }

  const isAsm =
    submission.submitter_role?.toLowerCase().includes('asm') ||
    submission.submitter_role?.toLowerCase().includes('manager');

  const lat = submission.latitude ? Number(submission.latitude).toFixed(4) : null;
  const lng = submission.longitude ? Number(submission.longitude).toFixed(4) : null;
  const accuracyVal = submission.accuracy ? Math.round(submission.accuracy) : 4;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-gray-900 truncate">
                {submission.submission_type || 'Test Submission'}
              </h3>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold border border-gray-200">
                {submission.id}
              </span>
              <span
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                  ['VERIFIED', 'APPROVED'].includes(submission.status)
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}
              >
                {submission.status || 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
              <span>Date: {submission.date || 'Today'}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                {submission.submission_time || '—'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition flex-shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          {/* 2-Column Info: Farmer & Submitter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Farmer / Tank Card */}
            <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                Farmer & Pond
              </span>
              <p className="font-bold text-gray-900 text-sm">{submission.farmer_name || 'Farmer'}</p>
              <p className="text-gray-600">
                Tank: <span className="font-semibold text-gray-800">{submission.tank_name || '—'}</span>
              </p>
              <p className="text-gray-500 flex items-center gap-1">
                <MapPinIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>Location: </span>
                <span className="text-gray-700 font-medium">{submission.locality || '—'}</span>
              </p>
              {submission.farmer_mobile && submission.farmer_mobile !== '—' && (
                <p className="text-gray-500">
                  Mobile:{' '}
                  <a
                    href={`tel:${submission.farmer_mobile}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {submission.farmer_mobile}
                  </a>
                </p>
              )}
            </div>

            {/* Submitter & GPS Card */}
            <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block">
                Submitted By
              </span>
              <p className="font-bold text-gray-900 text-sm">{submission.submitter_name || 'Field Executive'}</p>
              <p className="text-gray-600">
                Role:{' '}
                <span className="font-semibold text-gray-800">
                  {isAsm ? 'Area Sales Manager (ASM)' : 'Technical Executive / Agent'}
                </span>
                <span className="text-gray-400 ml-1 font-mono">({submission.username || 'agent001'})</span>
              </p>
              <div className="flex items-center justify-between text-gray-500 pt-1 border-t border-gray-200/50 mt-1">
                <span className="font-mono text-[11px]">
                  {lat && lng ? `${lat}°N, ${lng}°E (±${accuracyVal}m)` : 'GPS: Bhimavaram (±4m)'}
                </span>
                <a
                  href={
                    lat && lng
                      ? `https://www.google.com/maps?q=${lat},${lng}`
                      : 'https://www.google.com/maps?q=16.5449,81.4959'
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:underline font-semibold"
                >
                  <span>Map</span>
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Test Parameters */}
          <div>
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider block mb-2">
              Submitted Parameters
            </span>
            {parsedParams && typeof parsedParams === 'object' && Object.keys(parsedParams).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(parsedParams).map(([k, v]) => {
                  if (v === null || v === undefined || v === '') return null;
                  const formattedKey = k
                    .replace(/_/g, ' ')
                    .replace(/ppm|ppt|pct|c|grams/gi, '')
                    .trim();
                  return (
                    <div
                      key={k}
                      className="bg-white border border-gray-200/80 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs"
                    >
                      <span className="text-[11px] text-gray-500 capitalize">{formattedKey}</span>
                      <span className="text-sm font-bold text-gray-900 mt-1">
                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 text-center bg-gray-50 rounded-xl border border-gray-100 text-gray-400 text-xs">
                No specific test parameters recorded for this submission.
              </div>
            )}
          </div>

          {/* Field Observations / Notes */}
          {submission.notes && (
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-xl p-3.5">
              <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider block mb-1">
                Field Observations & Notes
              </span>
              <p className="text-gray-700 text-xs whitespace-pre-wrap">{submission.notes}</p>
            </div>
          )}

          {/* Follow-up info if present */}
          {submission.followed_up_by_name && (
            <div className="bg-emerald-50/50 border border-emerald-200/70 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] uppercase font-bold text-emerald-800 tracking-wider block">
                Followed Up By Admin
              </span>
              <p className="font-semibold text-emerald-900">{submission.followed_up_by_name}</p>
              {submission.followed_up_at && (
                <p className="text-[11px] text-gray-500">
                  {new Date(submission.followed_up_at).toLocaleString()}
                </p>
              )}
              {submission.admin_completion_notes && (
                <p className="text-[11px] text-gray-700 italic bg-white p-2 rounded-lg border border-gray-100 mt-1">
                  "{submission.admin_completion_notes}"
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-gray-100 border border-gray-200 text-gray-700 rounded-lg text-xs font-semibold shadow-2xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function LiveSubmissionsDrawer({ isOpen, onClose }) {
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['live-submissions-today'],
    queryFn: () => dashboardApi.getLiveSubmissions().then((r) => r.data.data),
    refetchInterval: 15000,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setSelectedSubmission(null);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const submissions = data?.submissions || [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-gray-900/40 backdrop-blur-2xs transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Modal Container */}
        <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-10 animate-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">Submissions List</h2>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                {submissions.length} Total Records
              </span>
              <button
                type="button"
                onClick={() => refetch()}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="Refresh now"
              >
                <ArrowPathIcon className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                title="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content Table */}
          <div className="overflow-x-auto max-h-[75vh]">
            {isLoading ? (
              <div className="py-20 text-center">
                <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-xs text-gray-500">Loading submissions...</p>
              </div>
            ) : submissions.length === 0 ? (
              <div className="py-20 text-center px-4">
                <CircleStackIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-gray-700">No submissions found</h3>
                <p className="text-xs text-gray-400 mt-1">No field submissions have been received today.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 bg-white">
                    <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      USER
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      ROLE
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      TIME
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      SUBMISSION ID
                    </th>
                    <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      GPS COORDINATES
                    </th>
                    <th className="py-3 px-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      ACCURACY
                    </th>
                    <th className="py-3 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right sm:text-left">
                      LOCATION
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {submissions.map((sub) => {
                    const isAsm =
                      sub.submitter_role?.toLowerCase().includes('asm') ||
                      sub.submitter_role?.toLowerCase().includes('manager');

                    const lat = sub.latitude ? Number(sub.latitude).toFixed(4) : '16.5449';
                    const lng = sub.longitude ? Number(sub.longitude).toFixed(4) : '81.4959';
                    const accuracyVal = sub.accuracy ? Math.round(sub.accuracy) : 4;
                    const initial = (sub.submitter_name || 'U').charAt(0).toUpperCase();

                    return (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedSubmission(sub)}
                        className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                      >
                        {/* USER */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-sm flex-shrink-0 group-hover:bg-blue-200 transition-colors">
                              {initial}
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">
                                {sub.submitter_name}
                              </p>
                              <p className="text-xs text-gray-400 font-normal leading-tight mt-0.5">
                                {sub.username || 'agent001'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* ROLE */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-100">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span>{isAsm ? 'ASM' : 'Agent'}</span>
                          </span>
                        </td>

                        {/* TIME */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-medium">{sub.submission_time || '03:00 PM'}</span>
                          </div>
                        </td>

                        {/* SUBMISSION ID */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-gray-50 border border-gray-200/80 font-mono text-xs text-gray-600 group-hover:border-blue-300 transition-colors">
                            {sub.id}
                          </span>
                        </td>

                        {/* GPS COORDINATES */}
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div>
                            <p className="font-mono text-xs font-semibold text-gray-800">
                              {lat}°N, {lng}°E
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                              <span className="text-rose-500">📍</span>
                              <span>{sub.locality || 'Bhimavaram'}</span>
                            </p>
                          </div>
                        </td>

                        {/* ACCURACY */}
                        <td className="py-4 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-700 text-xs font-semibold">
                            ± {accuracyVal}m
                          </span>
                        </td>

                        {/* LOCATION / ACTION */}
                        <td className="py-4 px-6 whitespace-nowrap text-right sm:text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSubmission(sub);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 text-xs font-semibold transition"
                          >
                            <EyeIcon className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Test Details Modal */}
      {selectedSubmission && (
        <SubmissionDetailsModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
        />
      )}
    </>
  );
}

