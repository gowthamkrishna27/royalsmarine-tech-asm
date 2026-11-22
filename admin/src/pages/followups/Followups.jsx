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
      {/* Header Bar */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Follow-ups & Tank Tests</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          {data?.pagination?.total || 0} follow-up and weekly test records
        </p>
      </div>

      {/* Top 4 Static Cards: Dues (Orange), Overdue (Red), Completed (Green) & Create (Blue) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-gray-100 overflow-hidden">
        {/* 1. Dues (Orange / Amber) */}
        <button
          type="button"
          onClick={() => handleStatusTabChange(status === 'dues' ? '' : 'dues')}
          className={`p-4 sm:p-5 flex flex-col justify-between text-left cursor-pointer transition-colors ${status === 'dues'
              ? 'bg-amber-50/80 ring-2 ring-inset ring-amber-500'
              : 'hover:bg-amber-50/40'
            }`}
          title="Filter by dues"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${status === 'dues'
                ? 'text-amber-700 font-bold'
                : 'text-gray-500'
              }`}>
              Dues (This Week)
            </span>
            <Clock className={`w-4 h-4 ${status === 'dues' ? 'text-amber-600' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 h-8">
            <span className={`text-2xl font-bold tracking-tight ${status === 'dues'
                ? 'text-amber-900'
                : 'text-gray-900'
              }`}>
              {duesCount}
            </span>
            <span className={`text-xs font-medium ${status === 'dues'
                ? 'text-amber-600'
                : 'text-gray-400'
              }`}>
              due tests & follow-ups
            </span>
          </div>
        </button>

        {/* 2. Overdue (Red / Rose) */}
        <button
          type="button"
          onClick={() => handleStatusTabChange(status === 'overdue' ? '' : 'overdue')}
          className={`p-4 sm:p-5 flex flex-col justify-between text-left cursor-pointer transition-colors ${status === 'overdue'
              ? 'bg-rose-50/80 ring-2 ring-inset ring-rose-500'
              : 'hover:bg-rose-50/40'
            }`}
          title="Filter by overdue (skipped week tests)"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${status === 'overdue'
                ? 'text-rose-700 font-bold'
                : 'text-gray-500'
              }`}>
              Overdue (Skipped Week)
            </span>
            <AlertTriangle className={`w-4 h-4 ${status === 'overdue' ? 'text-rose-600' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 h-8">
            <span className={`text-2xl font-bold tracking-tight ${status === 'overdue'
                ? 'text-rose-900'
                : 'text-gray-900'
              }`}>
              {overdueCount}
            </span>
            <span className={`text-xs font-medium ${status === 'overdue'
                ? 'text-rose-600'
                : 'text-gray-400'
              }`}>
              skipped week tests
            </span>
          </div>
        </button>

        {/* 3. Completed (Green / Emerald) */}
        <button
          type="button"
          onClick={() => handleStatusTabChange(status === 'completed' ? '' : 'completed')}
          className={`p-4 sm:p-5 flex flex-col justify-between text-left cursor-pointer transition-colors ${status === 'completed'
              ? 'bg-emerald-50/80 ring-2 ring-inset ring-emerald-500'
              : 'hover:bg-emerald-50/40'
            }`}
          title="Filter by completed follow-ups"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${status === 'completed'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500'
              }`}>
              Completed
            </span>
            <CheckCircle2 className={`w-4 h-4 ${status === 'completed' ? 'text-emerald-600' : 'text-gray-400'}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 h-8">
            <span className={`text-2xl font-bold tracking-tight ${status === 'completed'
                ? 'text-emerald-900'
                : 'text-gray-900'
              }`}>
              {completedCount}
            </span>
            <span className={`text-xs font-medium ${status === 'completed'
                ? 'text-emerald-600'
                : 'text-gray-400'
              }`}>
              completed tests
            </span>
          </div>
        </button>

        {/* 4. Create Follow-up Button (Clean blue with simple white plus) */}
        {canCreate && (
          <button
            type="button"
            onClick={() => setAddModal(true)}
            className="p-4 sm:p-5 flex items-center justify-center gap-2 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm sm:text-base transition-colors"
            title="Create Follow-up"
          >
            <Plus className="w-5 h-5 text-white" />
            <span>Create Follow-up</span>
          </button>
        )}
      </div>

      {/* Minimal Status Tabs: All, Dues, Overdue, Completed */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => handleStatusTabChange('')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${status === '' || status === 'all'
              ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 hover:shadow-sm'
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300'
            }`}
        >
          All ({data?.pagination?.total || 0})
        </button>

        <button
          type="button"
          onClick={() => handleStatusTabChange('dues')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${status === 'dues'
              ? 'bg-amber-600 text-white shadow-xs hover:bg-amber-700 hover:shadow-sm'
              : 'bg-amber-50/60 text-amber-800 border border-amber-300 hover:bg-amber-100/70 hover:border-amber-400 hover:text-amber-900 shadow-2xs'
            }`}
        >
          <span>Dues</span>
          {duesCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors duration-150 ${status === 'dues'
                ? 'bg-amber-700 text-white'
                : 'bg-amber-100 text-amber-800 group-hover:bg-amber-200 group-hover:text-amber-900'
              }`}>
              {duesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleStatusTabChange('overdue')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${status === 'overdue'
              ? 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 hover:shadow-sm'
              : 'bg-rose-50/60 text-rose-800 border border-rose-300 hover:bg-rose-100/70 hover:border-rose-400 hover:text-rose-900 shadow-2xs'
            }`}
        >
          <span>Overdue</span>
          {overdueCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors duration-150 ${status === 'overdue'
                ? 'bg-rose-700 text-white'
                : 'bg-rose-100 text-rose-800 group-hover:bg-rose-200 group-hover:text-rose-900'
              }`}>
              {overdueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleStatusTabChange('completed')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${status === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 hover:shadow-sm'
              : 'bg-emerald-50/60 text-emerald-800 border border-emerald-300 hover:bg-emerald-100/70 hover:border-emerald-400 hover:text-emerald-900 shadow-2xs'
            }`}
        >
          <span>Completed</span>
          {completedCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors duration-150 ${status === 'completed'
                ? 'bg-emerald-700 text-white'
                : 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 group-hover:text-emerald-900'
              }`}>
              {completedCount}
            </span>
          )}
        </button>
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
          {(!data?.data || data.data.length === 0) ? (
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
                      <th>Title & Remarks</th>
                      <th>Farmer / Location</th>
                      <th>Assigned Executive</th>
                      <th>Due Date</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.data || []).map((f) => {
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

                      const locationText = [f.client_village, f.client_city || f.city, f.client_district || f.district]
                        .filter(Boolean)
                        .join(', ');

                      return (
                        <tr key={f.id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Title & Remarks */}
                          <td className="min-w-[200px] max-w-sm">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium text-gray-900 text-sm block">
                                {f.title}
                              </span>
                              {Boolean(f.test_required) && (
                                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${f.test_week
                                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                  }`}>
                                  🧪 {f.test_week ? 'Weekly Tank Test' : 'Test Required'}
                                </span>
                              )}
                            </div>
                            {f.remarks && (
                              <span className="text-xs text-gray-500 truncate block mt-0.5">
                                {f.remarks}
                              </span>
                            )}
                            {f.tank_name && (
                              <span className="text-[11px] text-indigo-600 font-medium block mt-0.5">
                                Pond / Tank: {f.tank_name} {f.tank_number ? `(#${f.tank_number})` : ''}
                              </span>
                            )}
                          </td>

                          {/* Farmer */}
                          <td className="whitespace-nowrap text-xs">
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
                          <td className="whitespace-nowrap text-xs">
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
                            <span className="text-gray-400 text-[11px] block mt-0.5">
                              {roleDisplay}
                            </span>
                          </td>

                          {/* Due Date */}
                          <td className="whitespace-nowrap text-xs font-mono text-gray-700">
                            <div>
                              <span>{f.followup_date}</span>
                              {f.followup_time && <span className="text-gray-400 ml-1">{f.followup_time}</span>}
                            </div>
                            {f.status !== 'completed' && f.status !== 'cancelled' && (
                              <div className="mt-0.5 font-sans">
                                {isOverdue ? (
                                  <span className="text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {f.test_week ? 'Skipped Week (Overdue)' : (f.days_overdue ? `${f.days_overdue}d overdue` : 'Overdue')}
                                  </span>
                                ) : Number(f.days_overdue) === 0 ? (
                                  <span className="text-[11px] text-amber-700 font-medium">
                                    Due today
                                  </span>
                                ) : Number(f.days_overdue) > 0 ? (
                                  <span className="text-[11px] text-amber-700 font-medium">
                                    {f.test_week ? 'Due this week' : `${f.days_overdue}d due`}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">
                                    Upcoming
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="whitespace-nowrap text-xs text-gray-600 capitalize">
                            {f.priority || 'medium'}
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap text-xs font-medium">
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
                          <td className="text-right whitespace-nowrap text-xs">
                            {isDue ? (
                              <button
                                onClick={() => {
                                  setCompleteTarget(f);
                                  setCompleteNotes('');
                                }}
                                className="group relative inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50/70 shadow-2xs hover:shadow-xs hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-150 cursor-pointer"
                                title="Mark as completed"
                              >
                                <Check className="w-3.5 h-3.5 text-gray-400 group-hover:text-emerald-600 group-hover:scale-115 transition-transform duration-150" />
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
