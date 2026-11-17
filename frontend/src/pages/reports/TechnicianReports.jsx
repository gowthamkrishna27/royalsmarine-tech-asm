import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi, clientApi, reportApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { MEETING_TYPES } from '../../constants';

const EXCLUDED_MEETING_TYPES = new Set(['follow_up', 'cold_call', 'order_discussion', 'other']);
const TECHNICIAN_MEETING_TYPES = MEETING_TYPES.filter(m => !EXCLUDED_MEETING_TYPES.has(m.value));

export default function TechnicianReports() {
  const [farmerId, setFarmerId] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  // Fetch farmers assigned to this technician
  const { data: clients } = useQuery({
    queryKey: ['tech-assigned-farmers'],
    queryFn: () => clientApi.list({ limit: 500, status: 'active' }).then((r) => r.data.data),
  });

  const farmerOptions = useMemo(() => {
    if (!clients?.length) return [];
    return [...clients]
      .map((c) => ({
        value: String(c.id),
        label: c.company_name || c.contact_person || `Farmer #${c.id}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [clients]);

  const selectedFarmer = useMemo(() => {
    if (!farmerId) return null;
    return farmerOptions.find((f) => String(f.value) === String(farmerId)) || null;
  }, [farmerId, farmerOptions]);

  // Fetch visits
  const { data: visitsResponse, isLoading: visitsLoading } = useQuery({
    queryKey: ['tech-visits-report', farmerId, meetingType, fromDate, toDate, page],
    queryFn: () =>
      visitApi
        .list({
          client_id: farmerId || undefined,
          meeting_type: meetingType || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          page,
          limit: 15,
        })
        .then((r) => r.data),
  });

  const visits = visitsResponse?.data || [];
  const meta = visitsResponse?.pagination || visitsResponse?.meta;

  const handleFarmerChange = (val) => {
    setFarmerId(val);
    setPage(1);
  };

  const handleMeetingTypeChange = (val) => {
    setMeetingType(val);
    setPage(1);
  };

  const handleFromDateChange = (val) => {
    setFromDate(val);
    setPage(1);
  };

  const handleToDateChange = (val) => {
    setToDate(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setFarmerId('');
    setMeetingType('');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  const openDatePicker = (e) => {
    if (e.target.tagName !== 'INPUT') {
      const input = e.currentTarget.querySelector('input');
      if (input) {
        if (typeof input.showPicker === 'function') {
          try {
            input.showPicker();
            return;
          } catch {}
        }
        input.focus();
      }
    }
  };

  const hasActiveFilters = Boolean(farmerId || meetingType || fromDate || toDate);

  const handleDownload = async (reportType) => {
    setDownloading(true);
    try {
      const res = await reportApi.export({
        type: reportType,
        farmer_id: farmerId || undefined,
        meeting_type: meetingType || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      const prefix = selectedFarmer
        ? selectedFarmer.label.toLowerCase().replace(/[^a-z0-9]/g, '_')
        : 'report';

      downloadBlob(res.data, `${prefix}_${reportType}.xlsx`);
      toast.success('Downloaded');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-3 max-w-5xl mx-auto pb-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-2">
        <h1 className="text-lg font-bold text-gray-900">Reports</h1>
      </div>

      {/* Filters */}
      <div className="border border-gray-200 rounded p-3 space-y-2.5 bg-white">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={farmerId}
            onChange={(e) => handleFarmerChange(e.target.value)}
            className="col-span-2 sm:col-span-1 border border-gray-300 rounded px-2.5 text-xs text-gray-900 bg-white h-8"
          >
            <option value="">All Farmers</option>
            {farmerOptions.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>

          <select
            value={meetingType}
            onChange={(e) => handleMeetingTypeChange(e.target.value)}
            className="col-span-2 sm:col-span-1 border border-gray-300 rounded px-2.5 text-xs text-gray-900 bg-white h-8"
          >
            <option value="">All Meeting Types</option>
            {TECHNICIAN_MEETING_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <label
            onClick={openDatePicker}
            className={`col-span-1 flex items-center gap-1.5 border rounded px-2 text-xs text-gray-900 bg-white cursor-pointer hover:border-gray-400 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 min-w-0 h-8 ${
              fromDate ? 'border-blue-300 bg-blue-50/20' : 'border-gray-300'
            }`}
            title="From date"
          >
            <CalendarDaysIcon
              className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${
                fromDate ? 'text-blue-600' : 'text-gray-400'
              }`}
            />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 pointer-events-none">
              From
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => handleFromDateChange(e.target.value)}
              className="w-full text-xs text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer min-w-0 [color-scheme:light]"
              aria-label="From date"
            />
          </label>

          <label
            onClick={openDatePicker}
            className={`col-span-1 flex items-center gap-1.5 border rounded px-2 text-xs text-gray-900 bg-white cursor-pointer hover:border-gray-400 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 min-w-0 h-8 ${
              toDate ? 'border-blue-300 bg-blue-50/20' : 'border-gray-300'
            }`}
            title="To date"
          >
            <CalendarDaysIcon
              className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${
                toDate ? 'text-blue-600' : 'text-gray-400'
              }`}
            />
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 pointer-events-none">
              To
            </span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => handleToDateChange(e.target.value)}
              className="w-full text-xs text-gray-900 bg-transparent border-0 p-0 focus:outline-none focus:ring-0 cursor-pointer min-w-0 [color-scheme:light]"
              aria-label="To date"
            />
          </label>
        </div>

        {/* Action Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload(farmerId ? 'farmer_report' : 'visits')}
              disabled={downloading}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Download Report
            </button>

            <button
              type="button"
              onClick={() => handleDownload('harvest_data')}
              disabled={downloading}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Harvest Data
            </button>

            <button
              type="button"
              onClick={() => handleDownload('visits')}
              disabled={downloading}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              Visits
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-xs text-gray-500 hover:text-black underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Data List: ONLY Farmer Name and View Button */}
      <div className="border border-gray-200 rounded bg-white overflow-hidden">
        {visitsLoading ? (
          <div className="py-8">
            <PageSpinner />
          </div>
        ) : visits.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No records found.
          </div>
        ) : (
          <div>
            <div className="divide-y divide-gray-200">
              {visits.map((v) => (
                <div
                  key={v.id}
                  className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition gap-2"
                >
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-gray-900 truncate">
                      {v.company_name || v.contact_person || `Farmer #${v.client_id || v.id}`}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                      {v.visit_date && <span>{v.visit_date}</span>}
                      {v.tank_number && <span>• Tank: {v.tank_number}</span>}
                      {v.meeting_type && (
                        <span className="capitalize">• {v.meeting_type.replace(/_/g, ' ')}</span>
                      )}
                      {v.city && <span>• {v.city}</span>}
                    </div>
                  </div>
                  <Link
                    to={`/visits/${v.id}`}
                    className="px-3 py-1 text-xs font-medium border border-gray-300 rounded text-gray-900 hover:bg-gray-100 transition shrink-0"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>

            {meta && (
              <Pagination
                meta={meta}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
