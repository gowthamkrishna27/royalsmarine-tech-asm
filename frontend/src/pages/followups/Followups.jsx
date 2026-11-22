import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi, userApi, visitApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
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
    setCompleting(true);
    try {
      const res = await followupApi.complete(completeTarget.id, completeNotes);
      toast.success('Follow-up marked completed and stored in database!');

      // Trigger WhatsApp Web / App directly if whatsapp_url is present
      const whatsappUrl = res.data?.data?.whatsapp_url;
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      setCompleteTarget(null);
      setCompleteNotes('');
      qc.invalidateQueries(['followups']);
      qc.invalidateQueries(['followups-today']);
      qc.invalidateQueries(['followups-overdue']);
      qc.invalidateQueries(['notifications']);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Follow-ups & Dues</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} total follow-up records
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setAddModal(true)}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg text-white bg-gray-900 hover:bg-gray-800 active:scale-95 transition shadow-xs w-full sm:w-auto shrink-0"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            <span>Create Followup</span>
          </button>
        )}
      </div>

      {/* Minimal Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setStatus('dues');
            setPage(1);
          }}
          className={`p-3 sm:p-4 rounded-xl border text-left transition flex items-center justify-between ${
            status === 'dues'
              ? 'border-gray-900 bg-white ring-1 ring-gray-900 shadow-2xs'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="text-xs font-medium text-gray-500">All Dues</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
              {(todayData?.length || 0) + (overdueData?.length || 0)}
            </p>
          </div>
          <ClockIcon className="w-5 h-5 text-gray-400 shrink-0 hidden xs:block" />
        </button>

        <button
          type="button"
          onClick={() => {
            setStatus('overdue');
            setPage(1);
          }}
          className={`p-3 sm:p-4 rounded-xl border text-left transition flex items-center justify-between ${
            status === 'overdue'
              ? 'border-gray-900 bg-white ring-1 ring-gray-900 shadow-2xs'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/40'
          }`}
        >
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span className="text-xs font-medium text-gray-500">Overdues</span>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1">
              {overdueData?.length || 0}
            </p>
          </div>
          <ExclamationTriangleIcon className="w-5 h-5 text-gray-400 shrink-0 hidden xs:block" />
        </button>
      </div>

      {/* Filter Toolbar: minimal, clean, and responsive */}
      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs p-2 sm:p-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full">
            {/* Techs */}
            <select
              value={techId}
              onChange={(e) => handleTechChange(e.target.value)}
              className={`h-9 px-3 text-xs rounded-lg border transition cursor-pointer w-full lg:flex-1 lg:min-w-[140px] focus:outline-none focus:ring-1 focus:ring-gray-400 ${
                techId
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
              className={`flex items-center gap-2 border rounded-lg px-2.5 h-9 text-xs transition w-full lg:w-auto shrink-0 ${
                date
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
              className={`h-9 px-3 text-xs rounded-lg border transition cursor-pointer w-full lg:flex-1 lg:min-w-[140px] focus:outline-none focus:ring-1 focus:ring-gray-400 ${
                status && status !== 'dues'
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
          <PageSpinner />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200/90 shadow-2xs overflow-hidden">
            {(!data?.data || data.data.length === 0) ? (
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
                  {(data.data || []).map((f) => {
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
                            ) : f.status === 'overdue' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {f.days_overdue ? `${f.days_overdue}d Overdue` : 'Overdue'}
                              </span>
                            ) : f.status === 'cancelled' ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-gray-50 text-gray-600 border border-gray-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                                Cancelled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Pending
                              </span>
                            )}
                          </div>

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
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/80 active:scale-95 transition shadow-2xs"
                            >
                              <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" />
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

      {/* Enhanced Completion Modal with WhatsApp & In-App Notification preview */}
      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Complete Follow-up & Notify Executive"
        size="md"
      >
        {completeTarget && (
          <div className="space-y-4">
            {/* Target Executive & Farmer Details */}
            <div className="p-3 bg-gray-50 border border-gray-200/90 rounded-xl text-xs space-y-2 text-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Assigned Executive:</span>
                <span className="font-semibold text-gray-900">
                  {completeTarget.salesperson_name} (
                  {completeTarget.salesperson_role_name ||
                    (completeTarget.salesperson_role === 'sales_manager' ? 'ASM' : 'Technical Executive')}
                  )
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Mobile (WhatsApp):</span>
                <span className="font-medium text-gray-900">
                  {completeTarget.salesperson_mobile ? `+91 ${completeTarget.salesperson_mobile}` : 'No phone linked'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Farmer / Company:</span>
                <span className="font-semibold text-gray-900">{completeTarget.company_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Due Date:</span>
                <span className="font-medium text-gray-800">
                  {completeTarget.followup_date}
                  {completeTarget.followup_time ? ` at ${completeTarget.followup_time}` : ''}
                </span>
              </div>
            </div>

            {/* Workflow Notice */}
            <div className="p-3 bg-gray-50 border border-gray-200/90 rounded-xl text-[11px] text-gray-600 space-y-1">
              <p className="font-semibold text-gray-900 flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
                Actions on Completion:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-gray-500">
                <li>Database status marked as <strong>COMPLETED</strong> with timestamp.</li>
                <li>In-App Notification delivered to assigned executive.</li>
                <li>WhatsApp confirmation message prepared for dispatch.</li>
              </ul>
            </div>

            {/* Completion Notes */}
            <div>
              <label className="label">
                Completion Notes / Summary <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="input"
                rows={3}
                placeholder="Enter completion remarks, discussion summary, or recommendations..."
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
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="btn-primary flex-1 sm:flex-initial py-2 sm:py-1.5 flex items-center justify-center gap-1.5"
              >
                <CheckCircleIcon className="w-4 h-4" />
                <span>{completing ? 'Completing...' : 'Complete & Notify'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
