import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi, clientApi, reportApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { MEETING_TYPES } from '../../constants';

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
  const meta = visitsResponse?.meta;

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <select
            value={farmerId}
            onChange={(e) => handleFarmerChange(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white"
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
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white"
          >
            <option value="">All Meeting Types</option>
            {MEETING_TYPES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={fromDate}
            onChange={(e) => handleFromDateChange(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white"
          />

          <input
            type="date"
            value={toDate}
            onChange={(e) => handleToDateChange(e.target.value)}
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs text-gray-900 bg-white"
          />
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
                  className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {v.company_name}
                  </span>
                  <Link
                    to={`/visits/${v.id}`}
                    className="px-3 py-1 text-xs font-medium border border-gray-300 rounded text-gray-900 hover:bg-gray-100 transition"
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
