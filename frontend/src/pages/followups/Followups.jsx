import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi, userApi, visitApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  BellIcon,
  PlusIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CheckIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import { FOLLOWUP_STATUS, MEETING_TYPES } from '../../constants';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

function RejectModal({ visitId, onClose, onRejected }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please enter a rejection reason');
      return;
    }
    setLoading(true);
    try {
      await visitApi.approve(visitId, { status: 'rejected', rejection_reason: reason.trim() });
      toast.success('Visit submission rejected');
      onRejected();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reject visit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={Boolean(visitId)} onClose={onClose} title="Reject Submission" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Reason for Rejection <span className="text-red-500">*</span></label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="input"
            rows={3}
            placeholder="Explain why this submission is rejected..."
            required
          />
        </div>
        <div className="flex gap-2.5 sm:gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1 sm:flex-initial py-2 sm:py-1.5">
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-sm flex-1 sm:flex-initial py-2 sm:py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-medium text-xs sm:text-sm transition"
          >
            {loading ? 'Rejecting...' : 'Reject Submission'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function CreateFollowupModal({ open, onClose, clients, users, currentUser, onCreate }) {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [showAllFarmers, setShowAllFarmers] = useState(false);

  const isASM = currentUser?.role === 'sales_manager';
  const isAdmin = ['super_admin', 'admin'].includes(currentUser?.role);

  // Technical executives assigned to this ASM (where manager_id matches ASM)
  const directReports = (users || []).filter(
    (u) => u.role === 'sales_executive' && (u.manager_id === currentUser?.id)
  );

  // If there are direct reports, show those; otherwise show all technical executives
  const techExecutives = directReports.length > 0
    ? directReports
    : (users || []).filter((u) => u.role === 'sales_executive');

  // Selected executive user object
  const selectedExec = (users || []).find((u) => String(u.id) === String(selectedExecId))
    || (String(currentUser?.id) === String(selectedExecId) ? currentUser : null);

  // Filter farmers belonging to the selected technical executive
  const filteredClients = (clients || []).filter((c) => {
    if (!selectedExecId) return false;
    const matchId = String(c.assigned_salesperson_id) === String(selectedExecId);
    const matchCreator = String(c.created_by) === String(selectedExecId);
    const matchName = selectedExec?.full_name && c.salesperson_name === selectedExec.full_name;
    const matchManager = String(currentUser?.id) === String(selectedExecId) && String(c.assigned_manager_id) === String(currentUser?.id);
    return matchId || matchCreator || matchName || matchManager;
  });

  const displayFarmers = showAllFarmers ? (clients || []) : filteredClients;

  // Reset state when modal is closed or opened
  useEffect(() => {
    if (!open) {
      reset();
      setSelectedExecId('');
      setShowAllFarmers(false);
    }
  }, [open, reset]);

  const handleExecChange = (e) => {
    const execId = e.target.value;
    setSelectedExecId(execId);
    setValue('client_id', '');
    setShowAllFarmers(false);
  };

  const handleModalClose = () => {
    reset();
    setSelectedExecId('');
    setShowAllFarmers(false);
    onClose();
  };

  const onSubmit = async (data) => {
    if (!selectedExecId) {
      toast.error('Please select a Technical Executive');
      return;
    }
    if (!data.client_id) {
      toast.error('Please select a Farmer');
      return;
    }

    setLoading(true);
    try {
      await followupApi.create({
        title: data.title,
        client_id: Number(data.client_id),
        assigned_salesperson_id: Number(selectedExecId),
        followup_date: data.followup_date,
        followup_time: data.followup_time || undefined,
        priority: data.priority || 'medium',
        remarks: data.remarks || undefined,
      });
      toast.success('Follow-up created successfully');
      reset();
      setSelectedExecId('');
      setShowAllFarmers(false);
      onCreate();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create follow-up');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={handleModalClose} title="Create Follow-up">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 1. Title */}
        <div>
          <label className="label">Purpose <span className="text-red-500">*</span></label>
          <input
            {...register('title', { required: 'Follow-up title is required' })}
            className="input"
            placeholder="Follow-up title"
          />
          {errors.title && <p className="form-error">{errors.title.message}</p>}
        </div>

        {/* 2. Technical Executive assigned to the ASM */}
        <div>
          <label className="label">
            Technical Executive <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedExecId}
            onChange={handleExecChange}
            className="input font-medium"
            required
          >
            <option value="">Select Technical Executive</option>
            {isASM && currentUser && (
              <option value={currentUser.id}>
                Myself ({currentUser.full_name})
              </option>
            )}
            {techExecutives.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role_display || 'Technical Executive'})
              </option>
            ))}
          </select>
          {directReports.length > 0 && isASM && (
            <p className="text-[11px] text-gray-500 mt-1">
              Showing Technical Executives reporting to your territory
            </p>
          )}
        </div>

        {/* 3. Farmer of the selected Technical Executive */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">
              Farmer <span className="text-red-500">*</span>
            </label>
            {selectedExecId && filteredClients.length > 0 && !showAllFarmers && (
              <span className="text-xs text-blue-600 font-medium">
                {filteredClients.length} {filteredClients.length === 1 ? 'farmer' : 'farmers'} available
              </span>
            )}
          </div>

          <select
            {...register('client_id', { required: 'Please select a farmer' })}
            className="input"
            disabled={!selectedExecId}
          >
            <option value="">
              {!selectedExecId
                ? 'Select Technical Executive first'
                : displayFarmers.length === 0
                  ? 'No farmers found for this executive'
                  : 'Select farmer'}
            </option>
            {displayFarmers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company_name} {c.city ? `(${c.city})` : ''}
              </option>
            ))}
          </select>
          {errors.client_id && <p className="form-error">{errors.client_id.message}</p>}

          {/* Helper when selected executive has no farmers mapped */}
          {selectedExecId && filteredClients.length === 0 && !showAllFarmers && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-amber-600">No farmers mapped to this executive.</span>
              <button
                type="button"
                onClick={() => setShowAllFarmers(true)}
                className="text-blue-600 hover:underline font-semibold ml-2 shrink-0"
              >
                Show all farmers ({clients?.length || 0})
              </button>
            </div>
          )}

          {showAllFarmers && (
            <div className="flex items-center justify-between mt-1 text-xs">
              <span className="text-blue-600 font-medium">Showing all farmers</span>
              <button
                type="button"
                onClick={() => setShowAllFarmers(false)}
                className="text-gray-500 hover:underline ml-2 shrink-0"
              >
                Filter by executive only
              </button>
            </div>
          )}
        </div>

        {/* 4. Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" {...register('followup_date', { required: 'Date is required' })} className="input" />
            {errors.followup_date && <p className="form-error">{errors.followup_date.message}</p>}
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" {...register('followup_time')} className="input" />
          </div>
        </div>

        {/* 5. Remarks */}
        <div>
          <label className="label">Remarks</label>
          <textarea {...register('remarks')} className="input" rows={2} placeholder="Optional remarks..." />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2.5 sm:gap-3 justify-end pt-2">
          <button type="button" onClick={handleModalClose} className="btn-secondary flex-1 sm:flex-initial py-2 sm:py-1.5">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1 sm:flex-initial py-2 sm:py-1.5">
            {loading ? 'Creating...' : 'Create Follow-up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Followups() {
  const qc = useQueryClient();
  const { user: currentUser, hasRole } = useAuth();
  const isAdmin = hasRole('super_admin', 'admin');
  const isManagerOrAdmin = hasRole('super_admin', 'admin', 'sales_manager');
  const canCreate = hasRole('super_admin', 'admin', 'sales_manager', 'sales_executive');
  const canAssignUsers = hasRole('super_admin', 'admin', 'sales_manager');

  const [activeTab, setActiveTab] = useState('followups'); // 'followups' | 'submissions'
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [rejectModal, setRejectModal] = useState(null);
  const [completeModal, setCompleteModal] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');

  // 1. Follow-ups queries
  const { data, isLoading } = useQuery({
    queryKey: ['followups', page, status],
    queryFn: () => followupApi.list({ page, limit: 20, status }).then((r) => r.data),
  });
  const { data: todayData } = useQuery({
    queryKey: ['followups-today'],
    queryFn: () => followupApi.today().then((r) => r.data.data),
  });
  const { data: overdueData } = useQuery({
    queryKey: ['followups-overdue'],
    queryFn: () => followupApi.overdue().then((r) => r.data.data),
  });
  const { data: clients } = useQuery({
    queryKey: ['clients-list'],
    queryFn: () => clientApi.list({ limit: 500 }).then((r) => r.data.data),
  });
  const { data: usersData } = useQuery({
    queryKey: ['users-list-followup'],
    queryFn: () => userApi.list({ limit: 200 }).then((r) => r.data.data),
    enabled: canAssignUsers,
  });

  // 2. Pending Submissions query (technician visit submissions pending review/approval)
  const { data: pendingVisitsData, isLoading: loadingVisits } = useQuery({
    queryKey: ['pending-submissions'],
    queryFn: () => visitApi.list({ approval_status: 'pending', limit: 50 }).then((r) => r.data),
  });
  const pendingSubmissions = pendingVisitsData?.data || [];
  const pendingCount = pendingVisitsData?.pagination?.total ?? pendingSubmissions.length;

  const handleComplete = async () => {
    try {
      await followupApi.complete(completeModal, completeNotes);
      toast.success('Follow-up completed!');
      setCompleteModal(null);
      setCompleteNotes('');
      qc.invalidateQueries(['followups']);
      qc.invalidateQueries(['followups-today']);
      qc.invalidateQueries(['followups-overdue']);
    } catch {
      toast.error('Failed to complete');
    }
  };

  const handleApproveVisit = async (visitId) => {
    try {
      await visitApi.approve(visitId, { status: 'approved' });
      toast.success('Visit submission approved');
      qc.invalidateQueries(['pending-submissions']);
      qc.invalidateQueries(['visits']);
      qc.invalidateQueries(['dashboard']);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to approve submission');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="page-title text-lg sm:text-xl font-bold text-gray-900 truncate">Follow-ups</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {activeTab === 'submissions'
              ? `${pendingCount} pending ${pendingCount === 1 ? 'submission' : 'submissions'}`
              : `${data?.pagination?.total || 0} total follow-ups`}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setAddModal(true)}
            className="btn-primary btn-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap active:scale-95 transition"
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            <span>Create Followup</span>
          </button>
        )}
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div
          onClick={() => {
            setActiveTab('followups');
            setStatus('');
          }}
          className={`card p-3.5 sm:p-4 flex items-center gap-3 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] ${activeTab === 'followups' && status === '' ? 'ring-2 ring-blue-500/20' : ''
            }`}
        >
          <BellIcon className="w-7 h-7 sm:w-8 sm:h-8 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{todayData?.length || 0}</p>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Today's Follow-ups</p>
          </div>
        </div>

        <div
          onClick={() => {
            setActiveTab('followups');
            setStatus('overdue');
          }}
          className={`card p-3.5 sm:p-4 flex items-center gap-3 border-l-4 border-red-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] ${activeTab === 'followups' && status === 'overdue' ? 'ring-2 ring-red-500/20' : ''
            }`}
        >
          <ExclamationTriangleIcon className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{overdueData?.length || 0}</p>
            <p className="text-xs sm:text-sm text-gray-500 truncate">Overdue</p>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('submissions')}
          className={`card p-3.5 sm:p-4 flex items-center gap-3 border-l-4 border-amber-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] col-span-2 sm:col-span-1 ${activeTab === 'submissions'
              ? 'ring-2 ring-amber-500/30 bg-amber-50/50'
              : pendingCount > 0
                ? 'bg-amber-50/30'
                : ''
            }`}
        >
          <DocumentTextIcon className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 shrink-0" />
          <div className="min-w-0 flex-1 flex sm:block items-center justify-between">
            <div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{pendingCount}</p>
              <p className="text-xs sm:text-sm text-gray-500 truncate">Pending Submissions</p>
            </div>
            {pendingCount > 0 && (
              <span className="sm:hidden text-xs font-semibold px-2.5 py-1 bg-amber-600 text-white rounded-lg shadow-xs">
                Review
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Technician Pending Submissions Alert Banner (when on Follow-ups tab) */}
      {pendingCount > 0 && activeTab === 'followups' && (
        <div className="p-3 sm:p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 fade-in shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <DocumentTextIcon className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs sm:text-sm text-amber-900 font-medium truncate">
              <span className="font-bold">{pendingCount}</span> technician visit {pendingCount === 1 ? 'submission is' : 'submissions are'} pending review
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white text-xs font-semibold rounded-lg shrink-0 transition shadow-xs"
          >
            Review Pendings
          </button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('followups')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 ${activeTab === 'followups'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
        >
          <BellIcon className="w-4 h-4" />
          <span>Follow-ups</span>
          {data?.pagination?.total ? (
            <span
              className={`px-1.5 py-0.5 text-xs rounded-full font-bold ${activeTab === 'followups' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'
                }`}
            >
              {data.pagination.total}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('submissions')}
          className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shrink-0 flex items-center gap-2 ${activeTab === 'submissions'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
        >
          <DocumentTextIcon className="w-4 h-4" />
          <span>Pending Submissions</span>
          {pendingCount > 0 && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-bold ${activeTab === 'submissions' ? 'bg-white text-amber-700' : 'bg-amber-100 text-amber-800'
                }`}
            >
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: PENDING SUBMISSIONS */}
      {activeTab === 'submissions' && (
        <div className="fade-in space-y-4">
          {loadingVisits ? (
            <PageSpinner />
          ) : (
            <div className="card">
              {pendingSubmissions.length === 0 ? (
                <EmptyState
                  title="No pending submissions"
                  description="All technician visit submissions have been reviewed and approved."
                  icon={DocumentTextIcon}
                />
              ) : (
                <div className="divide-y divide-gray-100">
                  {pendingSubmissions.map((v) => (
                    <div
                      key={v.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 hover:bg-gray-50/60 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Link
                            to={`/visits/${v.id}`}
                            className="text-sm font-bold text-gray-900 hover:text-blue-600 truncate block"
                          >
                            {v.company_name}
                          </Link>
                          <Badge color="yellow">Pending Approval</Badge>
                          <Badge color="blue">
                            {MEETING_TYPES.find((t) => t.value === v.meeting_type)?.label || v.meeting_type}
                          </Badge>
                          {v.tank_number && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              Tank {v.tank_number}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap mt-1">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800 bg-gray-100/90 px-2 py-0.5 rounded">
                            <UserIcon className="w-3.5 h-3.5 text-gray-500" />
                            {v.salesperson_name || 'Technical Executive'}
                          </span>
                          <span>•</span>
                          <span>
                            {v.visit_date}
                            {v.visit_time ? ` at ${v.visit_time}` : ''}
                          </span>
                          {v.city && (
                            <>
                              <span>•</span>
                              <span>{v.city}</span>
                            </>
                          )}
                        </div>

                        {v.visit_outcome && (
                          <p className="text-xs text-gray-600 mt-2 line-clamp-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                            <span className="font-semibold text-gray-700">Outcome:</span> {v.visit_outcome}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 justify-end">
                        <Link
                          to={`/visits/${v.id}`}
                          className="btn-secondary btn-sm text-xs py-1.5 px-3 rounded-lg"
                        >
                          View Details
                        </Link>
                        {isManagerOrAdmin && (
                          <>
                            <button
                              type="button"
                              onClick={() => setRejectModal(v.id)}
                              className="btn-sm text-xs py-1.5 px-3 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 active:bg-red-100 transition"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApproveVisit(v.id)}
                              className="btn-sm text-xs py-1.5 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-medium flex items-center gap-1 shadow-xs transition"
                            >
                              <CheckIcon className="w-3.5 h-3.5" /> Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: FOLLOW-UPS LIST */}
      {activeTab === 'followups' && (
        <div className="fade-in space-y-4">
          <FilterBar
            onReset={() => {
              setStatus('');
            }}
          >
            <SelectFilter
              label="All Status"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </FilterBar>

          {isLoading ? (
            <PageSpinner />
          ) : (
            <div className="card">
              {data?.data?.length === 0 ? (
                <EmptyState
                  title="No follow-ups"
                  icon={BellIcon}
                  action={
                    canCreate ? (
                      <button
                        onClick={() => setAddModal(true)}
                        className="btn-primary btn-sm flex items-center gap-1.5"
                      >
                        <PlusIcon className="w-4 h-4" /> Create Followup
                      </button>
                    ) : null
                  }
                />
              ) : (
                <>
                  <div className="divide-y divide-gray-50">
                    {data.data.map((f) => (
                      <div key={f.id} className="px-4 sm:px-6 py-4 flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                            <Badge
                              color={f.priority === 'high' ? 'red' : f.priority === 'medium' ? 'blue' : 'gray'}
                            >
                              {f.priority}
                            </Badge>
                            <Badge
                              color={
                                f.status === 'completed'
                                  ? 'green'
                                  : f.status === 'overdue'
                                    ? 'red'
                                    : f.status === 'cancelled'
                                      ? 'gray'
                                      : 'yellow'
                              }
                            >
                              {f.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{f.company_name}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {f.followup_date}
                            {f.followup_time ? ` at ${f.followup_time}` : ''}
                            {f.salesperson_name ? ` · Technician: ${f.salesperson_name}` : ''}
                          </p>
                        </div>
                        {f.status === 'pending' || f.status === 'overdue' ? (
                          <button
                            onClick={() => setCompleteModal(f.id)}
                            className="btn-success btn-sm flex-shrink-0"
                          >
                            <CheckCircleIcon className="w-4 h-4" /> Complete
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <Pagination meta={data.pagination} onPageChange={setPage} />
                </>
              )}
            </div>
          )}
        </div>
      )}

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

      {/* Completion Modal */}
      <Modal open={Boolean(completeModal)} onClose={() => setCompleteModal(null)} title="Mark as Completed">
        <div className="space-y-4">
          <div>
            <label className="label">Completion Notes</label>
            <textarea
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              className="input"
              rows={3}
              placeholder="What was discussed/achieved..."
            />
          </div>
          <div className="flex gap-2.5 sm:gap-3 justify-end pt-2">
            <button
              onClick={() => setCompleteModal(null)}
              className="btn-secondary flex-1 sm:flex-initial py-2 sm:py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              className="btn-success flex-1 sm:flex-initial py-2 sm:py-1.5"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </Modal>

      {/* Rejection Modal for Submissions */}
      <RejectModal
        visitId={rejectModal}
        onClose={() => setRejectModal(null)}
        onRejected={() => {
          qc.invalidateQueries(['pending-submissions']);
          qc.invalidateQueries(['visits']);
          qc.invalidateQueries(['dashboard']);
        }}
      />
    </div>
  );
}
