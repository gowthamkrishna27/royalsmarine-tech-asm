import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { visitApi, clientApi, reportApi, followupApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import toast from 'react-hot-toast';
import { CalendarDaysIcon } from '@heroicons/react/24/outline';
import { MEETING_TYPES } from '../../constants';

const EXCLUDED_MEETING_TYPES = new Set(['follow_up', 'cold_call', 'order_discussion', 'other']);
const TECHNICIAN_MEETING_TYPES = MEETING_TYPES.filter(m => !EXCLUDED_MEETING_TYPES.has(m.value));

export default function TechnicianReports() {
  const { user } = useAuth();
  const isASM = user?.role === 'sales_manager';

  const [activeTab, setActiveTab] = useState('visits'); // 'visits' | 'followups'
  const [salespersonId, setSalespersonId] = useState('');
  const [farmerId, setFarmerId] = useState('');
  const [meetingType, setMeetingType] = useState('');
  const [followupStatus, setFollowupStatus] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [downloading, setDownloading] = useState(false);

  // For technicians (sales_executive), lock scope to their own ID so they only see their farmers and visits
  const effectiveTechId = isASM ? salespersonId : (user?.id ? String(user.id) : '');

  // Fetch filter metadata (techs) for ASM
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => clientApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
    enabled: isASM,
  });

  const techOptions = useMemo(() => {
    if (!filterMeta?.techs?.length || !user?.id) return [];
    const list = filterMeta.techs.filter(
      (t) => String(t.manager_id) === String(user.id)
    );
    const finalTechs = list.length > 0 ? list : filterMeta.techs;
    return finalTechs.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, user?.id]);

  // Fetch farmers assigned to this technician or ASM
  const { data: clients } = useQuery({
    queryKey: ['tech-assigned-farmers', effectiveTechId],
    queryFn: () =>
      clientApi
        .list({
          limit: 500,
          status: 'active',
          salesperson_id: effectiveTechId || undefined,
          tech_id: effectiveTechId || undefined,
        })
        .then((r) => r.data.data),
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
    queryKey: ['tech-visits-report', farmerId, meetingType, fromDate, toDate, effectiveTechId, page],
    queryFn: () =>
      visitApi
        .list({
          client_id: farmerId || undefined,
          meeting_type: meetingType || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          salesperson_id: effectiveTechId || undefined,
          tech_id: effectiveTechId || undefined,
          page,
          limit: 15,
        })
        .then((r) => r.data),
    enabled: activeTab === 'visits',
  });

  // Fetch follow-ups
  const { data: followupsResponse, isLoading: followupsLoading } = useQuery({
    queryKey: ['tech-followups-report', farmerId, followupStatus, fromDate, toDate, effectiveTechId, page],
    queryFn: () =>
      followupApi
        .list({
          client_id: farmerId || undefined,
          status: followupStatus || undefined,
          from_date: fromDate || undefined,
          to_date: toDate || undefined,
          salesperson_id: effectiveTechId || undefined,
          tech_id: effectiveTechId || undefined,
          page,
          limit: 15,
        })
        .then((r) => r.data),
    enabled: activeTab === 'followups',
  });

  const visits = visitsResponse?.data || [];
  const followups = followupsResponse?.data || [];
  const meta = activeTab === 'visits'
    ? (visitsResponse?.pagination || visitsResponse?.meta)
    : (followupsResponse?.pagination || followupsResponse?.meta);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSalespersonChange = (val) => {
    setSalespersonId(val);
    setFarmerId('');
    setPage(1);
  };

  const handleFarmerChange = (val) => {
    setFarmerId(val);
    setPage(1);
  };

  const handleMeetingTypeChange = (val) => {
    setMeetingType(val);
    setPage(1);
  };

  const handleFollowupStatusChange = (val) => {
    setFollowupStatus(val);
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
    if (isASM) setSalespersonId('');
    setFarmerId('');
    setMeetingType('');
    setFollowupStatus('');
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
          } catch { }
        }
        input.focus();
      }
    }
  };

  const hasActiveFilters = Boolean(
    (isASM && salespersonId) ||
    farmerId ||
    (activeTab === 'visits' ? meetingType : followupStatus) ||
    fromDate ||
    toDate
  );

  const handleDownload = async (reportType) => {
    setDownloading(true);
    try {
      const res = await reportApi.export({
        type: reportType,
        farmer_id: farmerId || undefined,
        meeting_type: meetingType || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        salesperson_id: effectiveTechId || undefined,
        technician_id: effectiveTechId || undefined,
        asm_id: isASM ? user?.id : undefined,
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

  const isLoading = activeTab === 'visits' ? visitsLoading : followupsLoading;
  const currentCount = activeTab === 'visits' ? visits.length : followups.length;

  return (
    <div className="space-y-3 max-w-5xl mx-auto pb-6">
      {/* Header with Title (Tabs & count visible for ASM) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 border-b border-gray-200 pb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Reports</h1>
          {isASM && (
            <p className="text-xs text-gray-500">
              {activeTab === 'visits'
                ? `${visitsResponse?.pagination?.total ?? visits.length} visit records`
                : `${followupsResponse?.pagination?.total ?? followups.length} follow-up records`}
            </p>
          )}
        </div>

        {isASM && (
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg w-full sm:w-fit">
            <button
              type="button"
              onClick={() => handleTabChange('visits')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'visits'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Visits
            </button>
            <button
              type="button"
              onClick={() => handleTabChange('followups')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 text-xs font-semibold rounded-md transition ${
                activeTab === 'followups'
                  ? 'bg-white text-gray-900 shadow-xs'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Follow-ups
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="border border-gray-200 rounded p-3 space-y-2.5 bg-white">
        <div className={`grid grid-cols-2 ${isASM ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'} gap-2`}>
          {/* Dropdown for All Technical Executives (with 'Me' option for ASM) */}
          {isASM && (
            <select
              value={salespersonId}
              onChange={(e) => handleSalespersonChange(e.target.value)}
              className="col-span-2 sm:col-span-1 border border-gray-300 rounded px-2.5 text-xs text-gray-900 bg-white h-8"
              title="All Technical Executives"
            >
              <option value="">All Technical Executives</option>
              <option value={String(user?.id)}>Me</option>
              {techOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          )}

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

          {activeTab === 'visits' ? (
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
          ) : (
            <select
              value={followupStatus}
              onChange={(e) => handleFollowupStatusChange(e.target.value)}
              className="col-span-2 sm:col-span-1 border border-gray-300 rounded px-2.5 text-xs text-gray-900 bg-white h-8"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          )}

          {/* Date Filters - Aligned Side by Side on Mobile */}
          <label
            onClick={openDatePicker}
            className={`col-span-1 flex items-center gap-1.5 border rounded px-2 text-xs text-gray-900 bg-white cursor-pointer hover:border-gray-400 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 min-w-0 h-8 ${fromDate ? 'border-blue-300 bg-blue-50/20' : 'border-gray-300'
              }`}
            title="From date"
          >
            <CalendarDaysIcon
              className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${fromDate ? 'text-blue-600' : 'text-gray-400'
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
            className={`col-span-1 flex items-center gap-1.5 border rounded px-2 text-xs text-gray-900 bg-white cursor-pointer hover:border-gray-400 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 min-w-0 h-8 ${toDate ? 'border-blue-300 bg-blue-50/20' : 'border-gray-300'
              }`}
            title="To date"
          >
            <CalendarDaysIcon
              className={`w-3.5 h-3.5 shrink-0 pointer-events-none ${toDate ? 'text-blue-600' : 'text-gray-400'
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

        {/* Action Row - Export / Download Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDownload(farmerId ? 'farmer_report' : (activeTab === 'followups' ? 'followups' : 'visits'))}
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

            {isASM && (
              <button
                type="button"
                onClick={() => handleDownload('followups')}
                disabled={downloading}
                className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Follow-ups
              </button>
            )}
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

      {/* Data List */}
      <div className="border border-gray-200 rounded bg-white overflow-hidden">
        {isLoading ? (
          <div className="py-8">
            <PageSpinner />
          </div>
        ) : currentCount === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            No {activeTab === 'visits' ? 'visit' : 'follow-up'} records found.
          </div>
        ) : (
          <div>
            <div className="divide-y divide-gray-200">
              {activeTab === 'visits' ? (
                visits.map((v) => (
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
                ))
              ) : (
                followups.map((f) => (
                  <div
                    key={f.id}
                    className="px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {f.company_name || f.client_name || `Farmer #${f.client_id}`}
                        </span>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0 ${f.status === 'completed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : f.status === 'overdue'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                        >
                          {f.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                        {f.title && <span className="font-medium text-gray-700">{f.title}</span>}
                        {f.followup_date && <span>• Due: {f.followup_date}</span>}
                        {f.priority && <span className="capitalize">• {f.priority} priority</span>}
                      </div>
                    </div>
                    <Link
                      to="/followups"
                      className="px-3 py-1 text-xs font-medium border border-gray-300 rounded text-gray-900 hover:bg-gray-100 transition shrink-0"
                    >
                      View
                    </Link>
                  </div>
                ))
              )}
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
