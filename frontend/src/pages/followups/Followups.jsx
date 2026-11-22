import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi, userApi, visitApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import { FollowupListSkeleton } from '../../components/common/Skeleton';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import CreateFollowupModal from '../../components/common/CreateFollowupModal';
import {
  BellIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function Followups() {
  const qc = useQueryClient();
  const { user: currentUser, hasRole } = useAuth();
  const canCreate = hasRole('super_admin', 'admin', 'sales_manager');
  const canAssignUsers = hasRole('super_admin', 'admin', 'sales_manager');
  const isASM = currentUser?.role === 'sales_manager';
  const isAdmin = hasRole('super_admin', 'admin');

  const [searchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(urlStatus !== null ? urlStatus : 'dues');
  const [techId, setTechId] = useState('');
  const [date, setDate] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Completion state for Field / Water Quality Test
  const [completionPonds, setCompletionPonds] = useState([]);
  const [completionPondId, setCompletionPondId] = useState('');
  const [adminBypassTest, setAdminBypassTest] = useState(false);
  const [testData, setTestData] = useState({
    ph: '',
    salinity: '',
    ammonia: '',
    nitrite: '',
    alkalinity: '',
    dissolved_oxygen: '',
    water_colour: 'Light Green',
  });

  useEffect(() => {
    if (completeTarget) {
      setCompletionPondId(completeTarget.tank_id ? String(completeTarget.tank_id) : '');
      setAdminBypassTest(isAdmin);
      setTestData({
        ph: '',
        salinity: '',
        ammonia: '',
        nitrite: '',
        alkalinity: '',
        dissolved_oxygen: '',
        water_colour: 'Light Green',
      });
      if (completeTarget.client_id) {
        clientApi
          .listPonds(completeTarget.client_id)
          .then((res) => setCompletionPonds(res.data?.data || []))
          .catch(() => setCompletionPonds([]));
      } else {
        setCompletionPonds([]);
      }
    } else {
      setCompletionPonds([]);
      setCompletionPondId('');
    }
  }, [completeTarget, isAdmin]);

  useEffect(() => {
    const s = searchParams.get('status');
    if (s !== null && s !== status) {
      setStatus(s);
      setPage(1);
    }
  }, [searchParams]);

  // Fetch filter metadata (techs)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => visitApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  // Tech dropdown options (scoped to this ASM's reporting technicians if ASM)
  const techOptions = useMemo(() => {
    let list = (filterMeta?.techs || []).filter((t) => (t.status ? t.status === 'active' : true));
    if (isASM && currentUser?.id) {
      const reporting = list.filter((t) => String(t.manager_id) === String(currentUser.id));
      if (reporting.length > 0) {
        list = reporting;
      }
    }
    return list.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, isASM, currentUser?.id]);

  const handleTechChange = (newTechId) => {
    setTechId(newTechId);
    setPage(1);
  };

  const handleResetFilters = () => {
    setTechId('');
    setDate('');
    setStatus('dues');
    setPage(1);
  };

  const hasActiveFilters = Boolean(techId || date || (status && status !== 'dues'));

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['followups', page, status, techId, date],
    queryFn: () =>
      followupApi
        .list({
          page,
          limit: 20,
          status: status || undefined,
          tech_id: techId || undefined,
          date: date || undefined,
        })
        .then((r) => r.data),
  });
  const { data: todayData } = useQuery({
    queryKey: ['followups-today', techId],
    queryFn: () =>
      followupApi
        .today({
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
  });
  const { data: overdueData } = useQuery({
    queryKey: ['followups-overdue', techId],
    queryFn: () =>
      followupApi
        .overdue({
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
  });
  const { data: statsData } = useQuery({
    queryKey: ['followups-stats', techId],
    queryFn: () =>
      followupApi
        .stats({
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 500 }).then((r) => r.data.data),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users-list-followup'],
    queryFn: () => userApi.list({ status: 'active', limit: 200 }).then((r) => r.data.data),
    enabled: canAssignUsers,
  });

  const handleComplete = async () => {
    if (!completeTarget) return;

    const requiresTestForUser = Boolean(completeTarget.test_required) && !isAdmin;
    if (requiresTestForUser) {
      if (
        !testData.ph ||
        !testData.salinity ||
        !testData.ammonia ||
        !testData.nitrite
      ) {
        toast.error('Water test parameters (pH, Salinity, Ammonia, Nitrite) are required to complete this follow-up.');
        return;
      }
    }

    setCompleting(true);
    try {
      const shouldIncludeTest = requiresTestForUser || (!adminBypassTest && testData.ph);
      const payload = {
        completion_notes: completeNotes,
        ...(shouldIncludeTest
          ? {
            test_data: testData,
            tank_id: completionPondId ? Number(completionPondId) : completeTarget.tank_id || null,
          }
          : {}),
      };

      await followupApi.complete(completeTarget.id, payload);
      toast.success('Follow-up marked completed and stored in database!');

      setCompleteTarget(null);
      setCompleteNotes('');
      qc.invalidateQueries(['followups']);
      qc.invalidateQueries(['followups-stats']);
      qc.invalidateQueries(['followups-today']);
      qc.invalidateQueries(['followups-overdue']);
      qc.invalidateQueries(['notifications']);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setCompleting(false);
    }
  };

  const duesCount = statsData?.dues ?? (todayData?.length || 0);
  const overdueCount = statsData?.overdue ?? (overdueData?.length || 0);
  const completedCount = statsData?.completed ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Follow-ups & Dues</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
          {data?.pagination?.total || 0} total follow-up records
        </p>
      </div>

      {/* Quick Stats Grid: 3 Boxes side by side for Tech, 4 for ASM/Admin */}
      <div className={`grid gap-2 sm:gap-3 ${canCreate ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
        {/* 1. Dues (Amber) */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'dues' ? '' : 'dues');
            setPage(1);
          }}
          className={`card p-2 sm:p-4 flex items-center gap-2 sm:gap-3 border-l-3 sm:border-l-4 border-amber-500 text-left cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'dues' ? 'ring-2 ring-amber-500/20 bg-amber-50/40' : ''
          }`}
          title="Filter by dues"
        >
          <ClockIcon className="w-5 h-5 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-base sm:text-2xl font-bold text-gray-900 leading-tight">
              {duesCount}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5" title="Dues (This Week)">
              <span className="block sm:inline">Dues</span> <span className="text-gray-400 sm:text-gray-500">(This Week)</span>
            </p>
          </div>
        </button>

        {/* 2. Overdue (Rose) */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'overdue' ? '' : 'overdue');
            setPage(1);
          }}
          className={`card p-2 sm:p-4 flex items-center gap-2 sm:gap-3 border-l-3 sm:border-l-4 border-rose-500 text-left cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'overdue' ? 'ring-2 ring-rose-500/20 bg-rose-50/40' : ''
          }`}
          title="Filter by overdue (skipped week)"
        >
          <ExclamationTriangleIcon className="w-5 h-5 sm:w-8 sm:h-8 text-rose-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-base sm:text-2xl font-bold text-gray-900 leading-tight">
              {overdueCount}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5" title="Overdue (Skipped Week)">
              <span className="block sm:inline">Overdue</span> <span className="text-gray-400 sm:text-gray-500">(Skipped)</span>
            </p>
          </div>
        </button>

        {/* 3. Completed (Emerald) */}
        <button
          type="button"
          onClick={() => {
            setStatus(status === 'completed' ? '' : 'completed');
            setPage(1);
          }}
          className={`card p-2 sm:p-4 flex items-center gap-2 sm:gap-3 border-l-3 sm:border-l-4 border-emerald-500 text-left cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'completed' ? 'ring-2 ring-emerald-500/20 bg-emerald-50/40' : ''
          }`}
          title="Filter by completed"
        >
          <CheckCircleIcon className="w-5 h-5 sm:w-8 sm:h-8 text-emerald-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-base sm:text-2xl font-bold text-gray-900 leading-tight">
              {completedCount}
            </p>
            <p className="text-[10px] sm:text-xs text-gray-500 font-medium leading-tight mt-0.5" title="Completed Tests">
              <span className="block sm:inline">Completed</span> <span className="text-gray-400 sm:text-gray-500">Tests</span>
            </p>
          </div>
        </button>

        {/* 4. Create Follow-up Button (Only for ASM / Admin) */}
        {canCreate && (
          <button
            type="button"
            onClick={() => setAddModal(true)}
            className="card p-2 sm:p-4 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm border-blue-600 shadow-xs transition-colors"
            title="Create new follow-up"
          >
            <PlusIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white shrink-0" />
            <span className="truncate">Create Follow-up</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar: minimal, clean, and responsive */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-2 sm:p-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full">
            {/* Techs */}
            <select
              value={techId}
              onChange={(e) => handleTechChange(e.target.value)}
              className={`h-9 px-3 text-xs rounded-lg border transition cursor-pointer w-full lg:flex-1 lg:min-w-[140px] focus:outline-none focus:ring-1 focus:ring-gray-400 ${techId
                ? 'border-gray-400 text-gray-900 font-medium bg-gray-50/60'
                : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300'
                }`}
              title="Filter by Technical Executive"
            >
              <option value="">All Technical Executives</option>
              {techOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Date Filter */}
            <div
              className={`flex items-center gap-2 border rounded-lg px-2.5 h-9 text-xs transition w-full lg:w-auto shrink-0 ${date
                ? 'border-gray-400 bg-gray-50/60 text-gray-900'
                : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
                }`}
            >
              <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setPage(1);
                  }}
                  className="bg-transparent border-0 text-xs text-gray-800 focus:outline-none focus:ring-0 p-0 cursor-pointer w-full sm:w-[110px]"
                  title="Follow-up Date"
                />
              </div>
              {date && (
                <button
                  type="button"
                  onClick={() => {
                    setDate('');
                    setPage(1);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-0.5 ml-auto text-sm leading-none"
                  title="Clear date"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Followup Status */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className={`h-9 px-3 text-xs rounded-lg border transition cursor-pointer w-full lg:flex-1 lg:min-w-[140px] focus:outline-none focus:ring-1 focus:ring-gray-400 ${status && status !== 'dues'
                ? 'border-gray-400 text-gray-900 font-medium bg-gray-50/60'
                : 'border-gray-200 text-gray-700 bg-white hover:border-gray-300'
                }`}
              title="Followup Status"
            >
              <option value="dues">All Dues & Overdues</option>
              <option value="pending">Pending Dues Only</option>
              <option value="overdue">Overdue Dues Only</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="">All Records</option>
            </select>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={handleResetFilters}
                className="h-9 px-3 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition shrink-0 flex items-center justify-center gap-1.5 w-full lg:w-auto"
                title="Reset all filters"
              >
                <FunnelIcon className="w-3.5 h-3.5 text-gray-400" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <FollowupListSkeleton count={5} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
            {(!data?.data || data?.data?.length === 0) ? (
              <EmptyState
                title={status === 'dues' ? 'No pending dues or overdues' : 'No follow-ups found'}
                description={
                  status === 'dues'
                    ? 'Great job! All follow-ups for ASMs and Technical Executives are up to date.'
                    : 'There are no records matching your current filter.'
                }
                icon={BellIcon}
                action={
                  canCreate ? (
                    <button
                      onClick={() => setAddModal(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 transition"
                    >
                      <PlusIcon className="w-4 h-4" /> Create Followup
                    </button>
                  ) : null
                }
              />
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {(data?.data || []).map((f) => {
                    const isOverdue =
                      f.status === 'overdue' ||
                      (Number(f.days_overdue) > 7 && f.status !== 'completed' && f.status !== 'cancelled');
                    const isDue = f.status === 'pending' || f.status === 'overdue';
                    const roleDisplay =
                      f.salesperson_role_name ||
                      (f.salesperson_role === 'sales_manager'
                        ? 'ASM'
                        : f.salesperson_role === 'sales_executive'
                          ? 'Technical Executive'
                          : 'Staff');

                    return (
                      <div
                        key={f.id}
                        className="p-3.5 sm:p-4 sm:flex sm:items-start sm:justify-between gap-4 transition hover:bg-gray-50/50"
                      >
                        <div className="flex-1 min-w-0">
                          {/* Title & Status Pills */}
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm sm:text-base font-semibold text-gray-900">{f.title}</p>

                            {Boolean(f.test_required) && (
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${f.test_week
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                🧪 {f.test_week ? 'Weekly Tank Test' : 'Test Required'}
                              </span>
                            )}

                            {f.priority === 'high' && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60">
                                High
                              </span>
                            )}

                            {f.status === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Completed
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {f.test_week ? 'Skipped Week' : (f.days_overdue ? `${f.days_overdue}d Overdue` : 'Overdue')}
                              </span>
                            ) : f.status === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                {f.test_week ? 'Due This Week' : 'Pending'}
                              </span>
                            )}
                          </div>

                          {f.tank_name && (
                            <p className="text-xs text-indigo-600 font-medium mb-1">
                              Pond / Tank: {f.tank_name} {f.tank_number ? `(#${f.tank_number})` : ''}
                            </p>
                          )}

                          {/* Farmer & Location */}
                          <div className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-700 font-medium flex-wrap">
                            <span className="text-gray-900 font-semibold">{f.company_name}</span>
                            {(f.client_village || f.client_city) && (
                              <span className="text-xs text-gray-400 font-normal">
                                · {[f.client_village, f.client_city].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </div>

                          {/* Assigned Executive, WhatsApp & Due Date Metadata */}
                          <div className="flex items-center gap-x-4 gap-y-1.5 text-xs text-gray-600 flex-wrap mt-2">
                            <div className="flex items-center gap-1.5">
                              <UserIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-gray-500">{roleDisplay}:</span>
                              <span className="text-gray-900 font-medium">{f.salesperson_name || 'Unassigned'}</span>
                            </div>

                            {f.salesperson_mobile && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=91${f.salesperson_mobile.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-gray-600 hover:text-emerald-600 px-2 py-0.5 rounded border border-gray-200 bg-gray-50/70 hover:bg-emerald-50 hover:border-emerald-200 transition"
                                title="Chat on WhatsApp"
                              >
                                <PhoneIcon className="w-3 h-3 text-emerald-600" />
                                <span>+91 {f.salesperson_mobile}</span>
                                <ArrowTopRightOnSquareIcon className="w-2.5 h-2.5 text-gray-400" />
                              </a>
                            )}

                            <div className="flex items-center gap-1 text-gray-500">
                              <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span>Due: {f.followup_date}</span>
                              {f.followup_time ? <span>at {f.followup_time}</span> : null}
                            </div>
                          </div>

                          {/* Remarks */}
                          {f.remarks && (
                            <p className="text-xs text-gray-600 mt-2 bg-gray-50 px-2.5 py-1.5 rounded-lg border border-gray-100 line-clamp-2">
                              <span className="font-medium text-gray-700">Remarks:</span> {f.remarks}
                            </p>
                          )}

                          {/* Completed Status Banner */}
                          {f.status === 'completed' && (
                            <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200/80 text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold text-gray-900">Completed</span>
                              <span>by {f.completed_by_name || 'Admin'}</span>
                              {f.completed_date && (
                                <span className="text-gray-500">
                                  on {new Date(f.completed_date).toLocaleDateString()}
                                </span>
                              )}
                              {f.completion_notes && (
                                <span className="text-gray-700 italic">
                                  — "{f.completion_notes}"
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Complete Button for Dues & Overdues */}
                        {isDue && (
                          <div className="pt-2 sm:pt-0 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
                            <button
                              onClick={() => {
                                setCompleteTarget(f);
                                setCompleteNotes('');
                              }}
                              className="group w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 shadow-2xs hover:shadow-xs cursor-pointer"
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-115 transition-transform duration-150" />
                              <span>Complete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Pagination meta={data.pagination} onPageChange={setPage} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {canCreate && (
        <CreateFollowupModal
          open={addModal}
          onClose={() => setAddModal(false)}
          clients={clients}
          users={usersData}
          currentUser={currentUser}
          onCreate={() => {
            qc.invalidateQueries(['followups']);
            qc.invalidateQueries(['followups-today']);
            qc.invalidateQueries(['followups-overdue']);
          }}
        />
      )}

      {/* Completion Modal - Minimal */}
      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Complete Follow-up"
        size="md"
      >
        {completeTarget && (
          <div className="space-y-3.5">
            {/* Target Farmer & Executive - Minimal */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs flex items-center justify-between flex-wrap gap-1 text-gray-700">
              <div>
                <span className="font-semibold text-gray-900">{completeTarget.company_name}</span>
                <span className="text-gray-400 mx-1.5">·</span>
                <span>{completeTarget.salesperson_name}</span>
                {completeTarget.tank_name && (
                  <>
                    <span className="text-gray-400 mx-1.5">·</span>
                    <span className="text-gray-500">Pond: {completeTarget.tank_name}</span>
                  </>
                )}
              </div>
              <div className="text-gray-500 font-mono text-[11px]">
                Due: {completeTarget.followup_date}
              </div>
            </div>

            {/* Test Requirement Alert / Admin Notice */}
            {Boolean(completeTarget.test_required) && (
              isAdmin ? (
                <p className="text-xs text-blue-700 bg-blue-50/70 border border-blue-200/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>Field test required · Admin direct completion enabled</span>
                </p>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50/80 border border-amber-300 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Enter water test parameters to complete</span>
                </p>
              )
            )}

            {/* Mandatory Test Form for Non-Admin when test_required is true */}
            {Boolean(completeTarget.test_required) && !isAdmin && (
              <div className="space-y-3">
                {/* Pond selector */}
                <div>
                  <label className="label text-xs">Pond / Tank <span className="text-gray-400 font-normal">(Optional)</span></label>
                  <select
                    value={completionPondId}
                    onChange={(e) => setCompletionPondId(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="">{completionPonds.length === 0 ? 'No ponds found (General)' : 'Select Pond / Tank (Optional)'}</option>
                    {completionPonds.map((p) => {
                      const label =
                        p.pond_name && p.tank_number && String(p.pond_name).trim() !== String(p.tank_number).trim() && !String(p.pond_name).includes(String(p.tank_number))
                          ? `${p.pond_name} (#${p.tank_number})`
                          : (p.pond_name || `Tank #${p.tank_number || p.id}`);
                      return (
                        <option key={p.id} value={p.id}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Parameters Grid */}
                <div className="p-3 bg-gray-50 border border-gray-200/90 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-900">
                      Water Test Results <span className="text-red-500">*</span>
                    </span>
                    <span className="text-[10px] text-gray-500">4 parameters required</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="label text-[11px]">pH <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 7.8"
                        value={testData.ph}
                        onChange={(e) => setTestData({ ...testData, ph: e.target.value })}
                        className="input text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[11px]">Salinity (ppt) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 15"
                        value={testData.salinity}
                        onChange={(e) => setTestData({ ...testData, salinity: e.target.value })}
                        className="input text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[11px]">Ammonia NH3 (ppm) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0.1"
                        value={testData.ammonia}
                        onChange={(e) => setTestData({ ...testData, ammonia: e.target.value })}
                        className="input text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[11px]">Nitrite NO2 (ppm) <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 0.05"
                        value={testData.nitrite}
                        onChange={(e) => setTestData({ ...testData, nitrite: e.target.value })}
                        className="input text-xs font-mono"
                        required
                      />
                    </div>
                    <div>
                      <label className="label text-[11px]">Alkalinity (ppm) <span className="text-gray-400 font-normal">(Opt)</span></label>
                      <input
                        type="number"
                        step="1"
                        placeholder="e.g. 120"
                        value={testData.alkalinity}
                        onChange={(e) => setTestData({ ...testData, alkalinity: e.target.value })}
                        className="input text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="label text-[11px]">Dissolved O2 (ppm) <span className="text-gray-400 font-normal">(Opt)</span></label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="e.g. 5.5"
                        value={testData.dissolved_oxygen}
                        onChange={(e) => setTestData({ ...testData, dissolved_oxygen: e.target.value })}
                        className="input text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Optional Test Entry for Admin */}
            {Boolean(completeTarget.test_required) && isAdmin && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 select-none">
                  <input
                    type="checkbox"
                    checked={!adminBypassTest}
                    onChange={(e) => setAdminBypassTest(!e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                  />
                  <span>Record Water Quality Test Results (Optional for Admin)</span>
                </label>

                {!adminBypassTest && (
                  <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="label text-[11px]">pH</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 7.8"
                          value={testData.ph}
                          onChange={(e) => setTestData({ ...testData, ph: e.target.value })}
                          className="input text-xs"
                        />
                      </div>
                      <div>
                        <label className="label text-[11px]">Salinity (ppt)</label>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="e.g. 15"
                          value={testData.salinity}
                          onChange={(e) => setTestData({ ...testData, salinity: e.target.value })}
                          className="input text-xs"
                        />
                      </div>
                      <div>
                        <label className="label text-[11px]">Ammonia (ppm)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 0.1"
                          value={testData.ammonia}
                          onChange={(e) => setTestData({ ...testData, ammonia: e.target.value })}
                          className="input text-xs"
                        />
                      </div>
                      <div>
                        <label className="label text-[11px]">Nitrite (ppm)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 0.05"
                          value={testData.nitrite}
                          onChange={(e) => setTestData({ ...testData, nitrite: e.target.value })}
                          className="input text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Completion Notes */}
            <div>
              <label className="label text-xs">
                Remarks <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="input text-xs"
                rows={2}
                placeholder="Optional remarks..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 sm:gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setCompleteTarget(null)}
                className="btn-secondary flex-1 sm:flex-initial py-2 sm:py-1.5"
                disabled={completing}
              >
                Cancel
              </button>
              {(() => {
                const requiresTest = Boolean(completeTarget.test_required) && !isAdmin;
                const isTestIncomplete = requiresTest && (!testData.ph || !testData.salinity || !testData.ammonia || !testData.nitrite);
                return (
                  <button
                    type="button"
                    onClick={handleComplete}
                    disabled={completing || isTestIncomplete}
                    className="group btn-primary flex-1 sm:flex-initial py-2 sm:py-1.5 flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <CheckCircleIcon className="w-4 h-4 group-hover:scale-115 transition-transform duration-150" />
                    <span>
                      {completing
                        ? 'Completing...'
                        : isTestIncomplete
                          ? 'Enter test data to complete'
                          : 'Complete'}
                    </span>
                  </button>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
