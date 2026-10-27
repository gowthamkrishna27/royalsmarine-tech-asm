import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi, userApi } from '../../services/api';
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
  UserIcon,
  PhoneIcon,
  CalendarDaysIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

function CreateFollowupModal({ open, onClose, clients, users, currentUser, onCreate }) {
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [showAllFarmers, setShowAllFarmers] = useState(false);

  const isASM = currentUser?.role === 'sales_manager';

  // Technical executives assigned to this ASM (where manager_id matches ASM)
  const directReports = (users || []).filter(
    (u) => u.role === 'sales_executive' && (u.manager_id === currentUser?.id)
  );

  // Filter farmers assigned to the selected technical executive / ASM
  const filteredClients = (clients || []).filter((c) => {
    if (!selectedExecId) return false;
    return String(c.assigned_salesperson_id) === String(selectedExecId);
  });

  const displayFarmers = showAllFarmers || filteredClients.length === 0
    ? (clients || [])
    : filteredClients;

  const handleExecChange = (e) => {
    const val = e.target.value;
    setSelectedExecId(val);
    setValue('assigned_salesperson_id', val);
    setValue('client_id', '');
    setShowAllFarmers(false);
  };

  const onSubmit = async (formData) => {
    setLoading(true);
    try {
      await followupApi.create({
        ...formData,
        assigned_salesperson_id: selectedExecId || currentUser?.id,
      });
      toast.success('Follow-up scheduled successfully');
      reset();
      setSelectedExecId('');
      onClose();
      onCreate();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create follow-up');
    } finally {
      setLoading(false);
    }
  };

  const handleModalClose = () => {
    reset();
    setSelectedExecId('');
    setShowAllFarmers(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleModalClose} title="Create Follow-up" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* 1. Title */}
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input
            {...register('title', { required: 'Title is required' })}
            className="input"
            placeholder="e.g. Water Quality Review & Stock Assessment"
          />
          {errors.title && <p className="form-error">{errors.title.message}</p>}
        </div>

        {/* 2. Assigned Executive (ASM or Technical Executive) */}
        <div>
          <label className="label">
            Assigned Executive <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedExecId}
            onChange={handleExecChange}
            className="input font-medium"
            required
          >
            <option value="">Select Technical Executive or ASM</option>
            {isASM && currentUser && (
              <option value={currentUser.id}>
                Myself ({currentUser.full_name}) - ASM
              </option>
            )}
            {(users || [])
              .filter((u) => ['sales_manager', 'sales_executive'].includes(u.role))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_display || (u.role === 'sales_manager' ? 'ASM' : 'Technical Executive')})
                </option>
              ))}
          </select>
        </div>

        {/* 3. Farmer of the selected Executive */}
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
                ? 'Select Executive first'
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

        {/* 5. Priority */}
        <div>
          <label className="label">Priority</label>
          <select {...register('priority')} defaultValue="medium" className="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* 6. Remarks */}
        <div>
          <label className="label">Remarks</label>
          <textarea {...register('remarks')} className="input" rows={2} placeholder="Optional instructions or notes..." />
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
  const canCreate = hasRole('super_admin', 'admin', 'sales_manager', 'sales_executive');
  const canAssignUsers = hasRole('super_admin', 'admin', 'sales_manager');

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('dues'); // Default to dues & overdues
  const [addModal, setAddModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);

  // Queries
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
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="min-w-0">
          <h1 className="page-title text-lg sm:text-xl font-bold text-gray-900 truncate">Follow-ups & Dues</h1>
          <p className="text-xs sm:text-sm text-gray-500">
            {data?.pagination?.total || 0} follow-up records
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div
          onClick={() => setStatus('dues')}
          className={`card p-4 flex items-center gap-3 border-l-4 border-amber-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'dues' ? 'ring-2 ring-amber-500/20 bg-amber-50/40' : ''
          }`}
        >
          <ClockIcon className="w-8 h-8 text-amber-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900">
              {(todayData?.length || 0) + (overdueData?.length || 0)}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 truncate font-medium">All Dues & Overdues</p>
          </div>
        </div>

        <div
          onClick={() => setStatus('pending')}
          className={`card p-4 flex items-center gap-3 border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'pending' ? 'ring-2 ring-blue-500/20 bg-blue-50/40' : ''
          }`}
        >
          <BellIcon className="w-8 h-8 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900">{todayData?.length || 0}</p>
            <p className="text-xs sm:text-sm text-gray-500 truncate font-medium">Today's Dues</p>
          </div>
        </div>

        <div
          onClick={() => setStatus('overdue')}
          className={`card p-4 flex items-center gap-3 border-l-4 border-red-500 cursor-pointer hover:shadow-md transition active:scale-[0.99] ${
            status === 'overdue' ? 'ring-2 ring-red-500/20 bg-red-50/40' : ''
          }`}
        >
          <ExclamationTriangleIcon className="w-8 h-8 text-red-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-2xl font-bold text-gray-900">{overdueData?.length || 0}</p>
            <p className="text-xs sm:text-sm text-gray-500 truncate font-medium">Overdue Dues</p>
          </div>
        </div>
      </div>

      {/* Filter Bar & List */}
      <div className="fade-in space-y-4">
        <FilterBar
          onReset={() => {
            setStatus('dues');
          }}
        >
          <SelectFilter
            label="Followup Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: 'dues', label: 'All Dues & Overdues' },
              { value: 'pending', label: 'Pending Dues Only' },
              { value: 'overdue', label: 'Overdue Dues Only' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
              { value: '', label: 'All Records' },
            ]}
          />
        </FilterBar>

        {isLoading ? (
          <PageSpinner />
        ) : (
          <div className="card">
            {data?.data?.length === 0 ? (
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
                      className="btn-primary btn-sm flex items-center gap-1.5"
                    >
                      <PlusIcon className="w-4 h-4" /> Create Followup
                    </button>
                  ) : null
                }
              />
            ) : (
              <>
                <div className="divide-y divide-gray-100">
                  {data.data.map((f) => {
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
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition hover:bg-gray-50/70 ${
                          f.status === 'overdue' ? 'bg-red-50/20' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          {/* Badges & Title */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <p className="text-base font-bold text-gray-900">{f.title}</p>
                            <Badge
                              color={
                                f.priority === 'high' ? 'red' : f.priority === 'medium' ? 'blue' : 'gray'
                              }
                            >
                              {f.priority?.toUpperCase()} PRIORITY
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
                              {f.status === 'overdue' && f.days_overdue
                                ? `${f.days_overdue}d Overdue`
                                : f.status?.toUpperCase()}
                            </Badge>
                          </div>

                          {/* Farmer & Location */}
                          <div className="flex items-center gap-2 text-sm text-gray-700 font-medium flex-wrap">
                            <span className="text-blue-700 font-semibold">{f.company_name}</span>
                            {(f.client_village || f.client_city) && (
                              <span className="text-xs text-gray-400">
                                ({[f.client_village, f.client_city].filter(Boolean).join(', ')})
                              </span>
                            )}
                          </div>

                          {/* Assigned Executive / ASM info with Role Badge & WhatsApp direct link */}
                          <div className="flex items-center gap-2 text-xs text-gray-600 flex-wrap mt-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                              <UserIcon className="w-3.5 h-3.5 text-blue-600" />
                              <span>{roleDisplay}:</span>
                              <span className="text-gray-900 font-bold">{f.salesperson_name || 'Unassigned'}</span>
                            </span>

                            {f.salesperson_mobile && (
                              <a
                                href={`https://api.whatsapp.com/send?phone=91${f.salesperson_mobile.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition font-medium"
                                title="Chat on WhatsApp"
                              >
                                <PhoneIcon className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+91 {f.salesperson_mobile}</span>
                                <ArrowTopRightOnSquareIcon className="w-3 h-3 text-emerald-500" />
                              </a>
                            )}

                            <span className="inline-flex items-center gap-1 text-gray-500 font-medium">
                              <CalendarDaysIcon className="w-3.5 h-3.5 text-gray-400" />
                              <span>Due: {f.followup_date}</span>
                              {f.followup_time ? <span>at {f.followup_time}</span> : null}
                            </span>
                          </div>

                          {/* Remarks */}
                          {f.remarks && (
                            <p className="text-xs text-gray-600 mt-2 bg-gray-50 p-2 rounded-lg border border-gray-100 line-clamp-2">
                              <span className="font-semibold text-gray-700">Remarks:</span> {f.remarks}
                            </p>
                          )}

                          {/* Completed Status Banner */}
                          {f.status === 'completed' && (
                            <div className="mt-2.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-1.5 flex-wrap">
                              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span className="font-bold">Completed</span>
                              <span>by {f.completed_by_name || 'Admin'}</span>
                              {f.completed_date && (
                                <span className="text-emerald-700">
                                  on {new Date(f.completed_date).toLocaleDateString()}
                                </span>
                              )}
                              {f.completion_notes && (
                                <span className="text-emerald-900 font-medium italic">
                                  — "{f.completion_notes}"
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Complete Button for Dues & Overdues */}
                        {isDue && (
                          <div className="pt-2 sm:pt-0 shrink-0 flex items-center gap-2">
                            <button
                              onClick={() => {
                                setCompleteTarget(f);
                                setCompleteNotes('');
                              }}
                              className="btn-success btn-sm flex items-center gap-1.5 px-3.5 py-2 shadow-xs active:scale-95 transition"
                            >
                              <CheckCircleIcon className="w-4 h-4" />
                              <span>Complete & Notify</span>
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
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-1.5 text-blue-900">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Assigned Executive:</span>
                <span className="font-bold text-gray-900">
                  {completeTarget.salesperson_name} (
                  {completeTarget.salesperson_role_name ||
                    (completeTarget.salesperson_role === 'sales_manager' ? 'ASM' : 'Technical Executive')}
                  )
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Mobile (WhatsApp):</span>
                <span className="font-semibold text-emerald-700">
                  {completeTarget.salesperson_mobile ? `+91 ${completeTarget.salesperson_mobile}` : 'No phone linked'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Farmer / Company:</span>
                <span className="font-bold text-gray-900">{completeTarget.company_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-medium">Due Date:</span>
                <span className="font-semibold text-gray-800">
                  {completeTarget.followup_date}
                  {completeTarget.followup_time ? ` at ${completeTarget.followup_time}` : ''}
                </span>
              </div>
            </div>

            {/* Workflow Notice */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 space-y-1">
              <p className="font-bold text-emerald-950 flex items-center gap-1">
                <CheckCircleIcon className="w-4 h-4 text-emerald-700" />
                Automated Actions on Completion:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                <li>Database status updated to <strong>COMPLETED</strong> with timestamp & your admin ID.</li>
                <li>Instant <strong>In-App Notification</strong> delivered to the executive's page bell.</li>
                <li>Official <strong>WhatsApp message</strong> prepared and opened to send to the executive.</li>
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
                className="btn-success flex-1 sm:flex-initial py-2 sm:py-1.5 flex items-center justify-center gap-1.5"
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
