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
import {
  Bell,
  Plus,
  Check,
  CheckCircle2,
  Clock,
  AlertTriangle,
  User,
  Phone,
  Calendar,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

function CreateFollowupModal({ open, onClose, clients, users, currentUser, onCreate }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [showAllFarmers, setShowAllFarmers] = useState(false);
  const [testRequired, setTestRequired] = useState(false);
  const [tankId, setTankId] = useState('');
  const [ponds, setPonds] = useState([]);
  const [loadingPonds, setLoadingPonds] = useState(false);

  const isASM = currentUser?.role === 'sales_manager';
  const selectedClientId = watch('client_id');

  // Load ponds when a farmer is selected
  useEffect(() => {
    if (selectedClientId) {
      setLoadingPonds(true);
      clientApi
        .listPonds(selectedClientId)
        .then((res) => {
          setPonds(res.data?.data || []);
        })
        .catch(() => {
          setPonds([]);
        })
        .finally(() => setLoadingPonds(false));
    } else {
      setPonds([]);
      setTankId('');
    }
  }, [selectedClientId]);

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
    setPonds([]);
    setTankId('');
  };

  const onSubmit = async (formData) => {
    setLoading(true);
    try {
      await followupApi.create({
        ...formData,
        assigned_salesperson_id: selectedExecId || currentUser?.id,
        test_required: testRequired ? 1 : 0,
        tank_id: testRequired && tankId ? Number(tankId) : null,
      });
      toast.success('Follow-up scheduled successfully');
      reset();
      setSelectedExecId('');
      setTestRequired(false);
      setTankId('');
      setPonds([]);
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
    setTestRequired(false);
    setTankId('');
    setPonds([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleModalClose} title="Create Follow-up" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Title */}
        <div>
          <label className="label">Title <span className="text-red-500">*</span></label>
          <input
            {...register('title', { required: 'Title is required' })}
            className="input"
            placeholder="e.g. Water Quality Review & Stock Assessment"
          />
          {errors.title && <p className="form-error">{errors.title.message}</p>}
        </div>

        {/* Assigned Executive */}
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
              .filter((u) => (u.status ? u.status === 'active' : true) && ['sales_manager', 'sales_executive'].includes(u.role))
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_display || (u.role === 'sales_manager' ? 'ASM' : 'Technical Executive')})
                </option>
              ))}
          </select>
        </div>

        {/* Farmer */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">
              Farmer <span className="text-red-500">*</span>
            </label>
            {selectedExecId && filteredClients.length > 0 && !showAllFarmers && (
              <span className="text-xs text-gray-500 font-medium">
                {filteredClients.length} {filteredClients.length === 1 ? 'farmer' : 'farmers'} mapped
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
              <span className="text-gray-500">No farmers mapped to this executive.</span>
              <button
                type="button"
                onClick={() => setShowAllFarmers(true)}
                className="text-gray-900 underline font-medium ml-2 shrink-0 cursor-pointer"
              >
                Show all farmers ({clients?.length || 0})
              </button>
            </div>
          )}
        </div>

        {/* Minimal Water Test Requirement */}
        <div className="space-y-2 pt-1">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-gray-700 hover:text-gray-900">
            <input
              type="checkbox"
              checked={testRequired}
              onChange={(e) => setTestRequired(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
            />
            <span>Water test required on completion</span>
          </label>

          {testRequired && (
            <div className="pl-6">
              <select
                value={tankId}
                onChange={(e) => setTankId(e.target.value)}
                className="input text-xs py-1.5"
                disabled={!selectedClientId || loadingPonds}
              >
                <option value="">
                  {!selectedClientId
                    ? 'Select Farmer first'
                    : loadingPonds
                      ? 'Loading ponds...'
                      : 'Target Pond / Tank (Optional)'}
                </option>
                {ponds.map((p) => {
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
          )}
        </div>

        {/* Date & Time */}
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

        {/* Priority */}
        <div>
          <label className="label">Priority</label>
          <select {...register('priority')} defaultValue="medium" className="input">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Remarks */}
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

  const [searchParams, setSearchParams] = useSearchParams();
  const urlStatus = searchParams.get('status');
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(urlStatus !== null ? urlStatus : '');
  const [asmId, setAsmId] = useState('');
  const [techId, setTechId] = useState('');
  const [date, setDate] = useState('');
  const [addModal, setAddModal] = useState(false);
  const [completeTarget, setCompleteTarget] = useState(null);
  const [completeNotes, setCompleteNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  const [adminEnterTest, setAdminEnterTest] = useState(false);
  const [adminTestData, setAdminTestData] = useState({ ph: '', salinity: '', ammonia: '', nitrite: '', alkalinity: '', dissolved_oxygen: '' });

  useEffect(() => {
    const s = searchParams.get('status');
    if (s !== null && s !== status) {
      setStatus(s);
      setPage(1);
    }
  }, [searchParams]);

  // Fetch filter metadata (ASMs, techs)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => visitApi.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  const asmOptions = useMemo(() => {
    const list = (filterMeta?.asms || []).filter((a) => (a.status ? a.status === 'active' : true));
    return list.map((a) => ({
      value: String(a.id),
      label: a.name + (a.region ? ` (${a.region})` : ''),
    }));
  }, [filterMeta?.asms]);

  const techOptions = useMemo(() => {
    let list = (filterMeta?.techs || []).filter((t) => (t.status ? t.status === 'active' : true));
    if (asmId) {
      list = list.filter((t) => String(t.manager_id) === String(asmId));
    }
    return list.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, asmId]);

  const handleAsmChange = (newAsmId) => {
    setAsmId(newAsmId);
    setPage(1);

    if (techId && newAsmId) {
      const currentTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techId));
      if (currentTech && String(currentTech.manager_id) !== String(newAsmId)) {
        setTechId('');
      }
    }
  };

  const handleTechChange = (newTechId) => {
    setTechId(newTechId);
    setPage(1);

    if (newTechId) {
      const chosenTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(newTechId));
      if (chosenTech && chosenTech.manager_id && !asmId) {
        setAsmId(String(chosenTech.manager_id));
      }
    }
  };

  const handleStatusTabChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);
      if (newStatus) updated.set('status', newStatus);
      else updated.delete('status');
      return updated;
    });
  };

  const handleResetFilters = () => {
    setAsmId('');
    setTechId('');
    setDate('');
    setStatus('');
    setPage(1);
    setSearchParams({});
  };

  const hasActiveFilters = Boolean(asmId || techId || date || status);

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['followups', page, status, asmId, techId, date],
    queryFn: () =>
      followupApi
        .list({
          page,
          limit: 20,
          status: status || undefined,
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
          date: date || undefined,
        })
        .then((r) => r.data),
  });

  const { data: duesData } = useQuery({
    queryKey: ['followups-dues', asmId, techId],
    queryFn: () =>
      followupApi
        .dues({
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
  });

  const { data: overdueData } = useQuery({
    queryKey: ['followups-overdue', asmId, techId],
    queryFn: () =>
      followupApi
        .overdue({
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['followups-stats', asmId, techId],
    queryFn: () =>
      followupApi
        .stats({
          asm_id: asmId || undefined,
          tech_id: techId || undefined,
        })
        .then((r) => r.data.data),
    retry: false,
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
      const payload = {
        completion_notes: completeNotes,
        ...(adminEnterTest && adminTestData.ph ? {
          test_data: adminTestData,
          tank_id: completeTarget.tank_id || null,
        } : {}),
      };
      await followupApi.complete(completeTarget.id, payload);
      toast.success('Follow-up marked completed');

      setCompleteTarget(null);
      setCompleteNotes('');
      setAdminEnterTest(false);
      setAdminTestData({ ph: '', salinity: '', ammonia: '', nitrite: '', alkalinity: '', dissolved_oxygen: '' });
      qc.invalidateQueries({ queryKey: ['followups'] });
      qc.invalidateQueries({ queryKey: ['followups-stats'] });
      qc.invalidateQueries({ queryKey: ['followups-dues'] });
      qc.invalidateQueries({ queryKey: ['followups-overdue'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to complete follow-up');
    } finally {
      setCompleting(false);
    }
  };

  const duesCount = statsData?.dues ?? (duesData?.length || 0);
  const overdueCount = statsData?.overdue ?? (overdueData?.length || 0);
  const completedCount = statsData?.completed || 0;

  return (
    <div className="space-y-4">
      {/* Header Bar with Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Follow-ups & Tank Tests</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} follow-up and weekly test records
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={() => setAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs sm:text-sm font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition cursor-pointer self-start sm:self-auto"
            title="Create Follow-up"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Create Follow-up</span>
          </button>
        )}
      </div>

      {/* Segmented Status Cards (Prominent & Clean) */}
      <div className="w-full">
        <div className="grid grid-cols-2 sm:flex bg-gray-100/90 p-1.5 rounded-2xl w-full sm:w-fit gap-1.5 border border-gray-200/50">
          <button
            type="button"
            onClick={() => handleStatusTabChange('')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl text-center transition cursor-pointer flex items-center justify-center gap-2 ${
              status === '' || status === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>All</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-lg font-bold transition ${
                status === '' || status === 'all'
                  ? 'bg-gray-100 text-gray-900'
                  : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {data?.pagination?.total || 0}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusTabChange('dues')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl text-center transition cursor-pointer flex items-center justify-center gap-2 ${
              status === 'dues'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Dues</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-lg font-bold transition ${
                status === 'dues'
                  ? 'bg-amber-100 text-amber-900'
                  : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {duesCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusTabChange('overdue')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl text-center transition cursor-pointer flex items-center justify-center gap-2 ${
              status === 'overdue'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Overdue</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-lg font-bold transition ${
                status === 'overdue'
                  ? 'bg-rose-100 text-rose-900'
                  : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {overdueCount}
            </span>
          </button>
          <button
            type="button"
            onClick={() => handleStatusTabChange('completed')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl text-center transition cursor-pointer flex items-center justify-center gap-2 ${
              status === 'completed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>Completed</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-lg font-bold transition ${
                status === 'completed'
                  ? 'bg-emerald-100 text-emerald-900'
                  : 'bg-gray-200/70 text-gray-600'
              }`}
            >
              {completedCount}
            </span>
          </button>
        </div>
      </div>



      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-2 w-full text-xs">
          {/* ASM select */}
          <select
            value={asmId}
            onChange={(e) => handleAsmChange(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full lg:flex-1 cursor-pointer"
          >
            <option value="">All ASMs</option>
            {asmOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Tech select */}
          <select
            value={techId}
            onChange={(e) => handleTechChange(e.target.value)}
            className="h-8 px-2.5 rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 w-full lg:flex-1 cursor-pointer"
          >
            <option value="">All Techs</option>
            {techOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 h-8 bg-white text-gray-700 w-full lg:w-auto">
            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setPage(1);
              }}
              className="bg-transparent border-0 text-xs text-gray-800 focus:outline-none focus:ring-0 p-0 cursor-pointer"
            />
            {date && (
              <button
                type="button"
                onClick={() => {
                  setDate('');
                  setPage(1);
                }}
                className="text-gray-400 hover:text-gray-600 ml-1"
                title="Clear date"
              >
                &times;
              </button>
            )}
          </div>

          {/* Reset */}
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="h-8 px-2.5 font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3 text-gray-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card overflow-hidden">
          {(!data?.data || data?.data?.length === 0) ? (
            <EmptyState
              title="No follow-ups found"
              description="No follow-ups matched the selected status or filters."
              icon={Bell}
              action={
                canCreate ? (
                  <button onClick={() => setAddModal(true)} className="btn-primary btn-sm">
                    Create Follow-up
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Minimal Table View */}
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Farmer / Location</th>
                      <th>Assigned Executive</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.data || []).map((f) => {
                      const isOverdue =
                        f.status === 'overdue' ||
                        (Number(f.days_overdue) > 7 && f.status !== 'completed' && f.status !== 'cancelled');
                      const isDue = f.status === 'pending' || f.status === 'overdue';
                      const cleanTitle = (f.title || '').replace(/\s*\((?:Skipped Week|Overdue)\)/gi, '').trim();
                      const isWeeklyTest = Boolean(f.test_week);
                      const isAutoRemark = f.remarks?.startsWith('Overdue: Weekly test skipped') || f.remarks?.startsWith('Weekly water quality test for');
                      const showRemark = f.remarks && !isAutoRemark;
                      const hasTankInTitle = cleanTitle.toLowerCase().includes(f.tank_name?.toLowerCase() || 'tank');
                      const showTank = f.tank_name && !hasTankInTitle && !isWeeklyTest;

                      const locationText = [f.client_village, f.client_city || f.city, f.client_district || f.district]
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <tr key={f.id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Title */}
                          <td className="min-w-[180px] max-w-sm py-3 px-4">
                            <span className="font-medium text-gray-900 text-sm block">
                              {cleanTitle}
                            </span>
                            {showRemark && (
                              <span className="text-xs text-gray-500 truncate block mt-0.5">
                                {f.remarks}
                              </span>
                            )}
                            {showTank && (
                              <span className="text-[11px] text-gray-500 font-medium block mt-0.5">
                                Tank: {f.tank_name}
                              </span>
                            )}
                          </td>

                          {/* Farmer */}
                          <td className="whitespace-nowrap text-xs py-3 px-4">
                            <span className="font-medium text-gray-900 block">
                              {f.company_name}
                            </span>
                            {locationText && (
                              <span className="text-gray-400 block mt-0.5">
                                {locationText}
                              </span>
                            )}
                          </td>

                          {/* Assigned Executive */}
                          <td className="whitespace-nowrap text-xs py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-gray-900">
                                {f.salesperson_name || 'Unassigned'}
                              </span>
                              {f.salesperson_mobile && (
                                <a
                                  href={`https://api.whatsapp.com/send?phone=91${f.salesperson_mobile.replace(/\D/g, '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-gray-400 hover:text-emerald-600 transition"
                                  title="WhatsApp"
                                >
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                </a>
                              )}
                            </div>
                          </td>

                          {/* Due Date */}
                          <td className="whitespace-nowrap text-xs font-mono text-gray-800 py-3 px-4">
                            <span>{f.followup_date}</span>
                            {f.followup_time && f.followup_time !== '09:00:00' && !isWeeklyTest && (
                              <span className="text-gray-400 ml-1">{f.followup_time.slice(0, 5)}</span>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="whitespace-nowrap text-xs py-3 px-4">
                            <span className={f.priority === 'high' ? 'text-rose-600 font-medium' : 'text-gray-500'}>
                              {f.priority ? f.priority.charAt(0).toUpperCase() + f.priority.slice(1) : 'Medium'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap text-xs font-medium py-3 px-4">
                            {f.status === 'completed' ? (
                              <Badge variant="success">Completed</Badge>
                            ) : f.status === 'cancelled' ? (
                              <Badge variant="gray">Cancelled</Badge>
                            ) : isOverdue ? (
                              <Badge variant="danger">{f.test_week ? 'Skipped Week' : 'Overdue'}</Badge>
                            ) : (
                              <Badge variant="warning">{f.test_week ? 'Due' : 'Pending'}</Badge>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="text-right whitespace-nowrap text-xs py-3 px-4">
                            {isDue ? (
                              <button
                                onClick={() => {
                                  setCompleteTarget(f);
                                  setCompleteNotes('');
                                }}
                                className="inline-flex items-center gap-1 py-1 px-2.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition cursor-pointer"
                                title="Mark as completed"
                              >
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Complete</span>
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
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
            qc.invalidateQueries({ queryKey: ['followups'] });
            qc.invalidateQueries({ queryKey: ['followups-stats'] });
            qc.invalidateQueries({ queryKey: ['followups-dues'] });
            qc.invalidateQueries({ queryKey: ['followups-overdue'] });
            setStatus('');
          }}
        />
      )}

      {/* Completion Modal */}
      <Modal
        open={Boolean(completeTarget)}
        onClose={() => setCompleteTarget(null)}
        title="Complete Follow-up"
        size="md"
      >
        {completeTarget && (
          <div className="space-y-4">
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

            {/* Admin Direct Completion Banner */}
            {Boolean(completeTarget.test_required) && (
              <p className="text-xs text-blue-700 bg-blue-50/70 border border-blue-200/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Field test required · Admin direct completion enabled</span>
              </p>
            )}

            {/* Optional Test Parameters Entry */}
            <div className="pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700 select-none">
                <input
                  type="checkbox"
                  checked={adminEnterTest}
                  onChange={(e) => setAdminEnterTest(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                />
                <span>Record Field Water Test Parameters (Optional)</span>
              </label>
            </div>

            {adminEnterTest && (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-3 text-xs">
                <p className="text-[11px] font-semibold text-gray-700">Water Quality Test Results (Optional for Admin):</p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="label text-[11px]">pH</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 7.8"
                      value={adminTestData.ph}
                      onChange={(e) => setAdminTestData({ ...adminTestData, ph: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label text-[11px]">Salinity (ppt)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="e.g. 15"
                      value={adminTestData.salinity}
                      onChange={(e) => setAdminTestData({ ...adminTestData, salinity: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label text-[11px]">Ammonia (ppm)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.1"
                      value={adminTestData.ammonia}
                      onChange={(e) => setAdminTestData({ ...adminTestData, ammonia: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="label text-[11px]">Nitrite (ppm)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 0.05"
                      value={adminTestData.nitrite}
                      onChange={(e) => setAdminTestData({ ...adminTestData, nitrite: e.target.value })}
                      className="input text-xs"
                    />
                  </div>
                </div>
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
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing}
                className="group btn-primary flex-1 sm:flex-initial py-2 sm:py-1.5 inline-flex items-center justify-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                <Check className="w-4 h-4 text-white group-hover:scale-115 transition-transform duration-150" />
                <span>{completing ? 'Completing...' : 'Complete Follow-up'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
