import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { followupApi, clientApi, userApi, visitApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
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
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecId, setSelectedExecId] = useState('');
  const [showAllFarmers, setShowAllFarmers] = useState(false);

  const isASM = currentUser?.role === 'sales_manager';

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
      const res = await followupApi.complete(completeTarget.id, completeNotes);
      toast.success('Follow-up marked completed');

      const whatsappUrl = res.data?.data?.whatsapp_url;
      if (whatsappUrl) {
        window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      }

      setCompleteTarget(null);
      setCompleteNotes('');
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

  const totalDuesCount = statsData?.non_completed ?? ((duesData?.length || 0) + (overdueData?.length || 0));
  const completedCount = statsData?.completed || 0;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Follow-ups</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} follow-up records found
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setAddModal(true)}
            className="btn-primary btn-sm inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Follow-up</span>
          </button>
        )}
      </div>

      {/* Top Static Cards: Dues (Orange) & Completed (Green) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 bg-white border border-gray-200 rounded-xl shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-gray-100 overflow-hidden">
        {/* 1. Dues (Orange / Amber) */}
        <button
          type="button"
          onClick={() => handleStatusTabChange(status === 'dues' || status === 'pending' ? '' : 'dues')}
          className={`group p-4 sm:p-5 flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
            status === 'dues' || status === 'pending'
              ? 'bg-amber-50/80 ring-2 ring-inset ring-amber-500'
              : 'hover:bg-amber-50/40 hover:shadow-inner'
          }`}
          title="Filter by dues"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 ${
              status === 'dues' || status === 'pending'
                ? 'text-amber-700 font-bold'
                : 'text-gray-500 group-hover:text-amber-600'
            }`}>
              Dues
            </span>
            <Clock className={`w-4 h-4 transition-all duration-200 ${
              status === 'dues' || status === 'pending'
                ? 'text-amber-600 scale-110'
                : 'text-gray-400 group-hover:text-amber-500 group-hover:scale-115 group-hover:rotate-6'
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 h-8">
            <span className={`text-2xl font-bold tracking-tight transition-colors duration-150 ${
              status === 'dues' || status === 'pending'
                ? 'text-amber-900'
                : 'text-gray-900 group-hover:text-amber-900'
            }`}>
              {totalDuesCount}
            </span>
            <span className={`text-xs font-medium transition-colors duration-150 ${
              status === 'dues' || status === 'pending'
                ? 'text-amber-600'
                : 'text-gray-400 group-hover:text-amber-600'
            }`}>
              pending follow-ups
            </span>
          </div>
        </button>

        {/* 2. Completed (Green / Emerald) */}
        <button
          type="button"
          onClick={() => handleStatusTabChange(status === 'completed' ? '' : 'completed')}
          className={`group p-4 sm:p-5 flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
            status === 'completed'
              ? 'bg-emerald-50/80 ring-2 ring-inset ring-emerald-500'
              : 'hover:bg-emerald-50/40 hover:shadow-inner'
          }`}
          title="Filter by completed follow-ups"
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-semibold uppercase tracking-wider transition-colors duration-150 ${
              status === 'completed'
                ? 'text-emerald-700 font-bold'
                : 'text-gray-500 group-hover:text-emerald-600'
            }`}>
              Completed
            </span>
            <CheckCircle2 className={`w-4 h-4 transition-all duration-200 ${
              status === 'completed'
                ? 'text-emerald-600 scale-110'
                : 'text-gray-400 group-hover:text-emerald-500 group-hover:scale-115 group-hover:rotate-6'
            }`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 h-8">
            <span className={`text-2xl font-bold tracking-tight transition-colors duration-150 ${
              status === 'completed'
                ? 'text-emerald-900'
                : 'text-gray-900 group-hover:text-emerald-900'
            }`}>
              {completedCount}
            </span>
            <span className={`text-xs font-medium transition-colors duration-150 ${
              status === 'completed'
                ? 'text-emerald-600'
                : 'text-gray-400 group-hover:text-emerald-600'
            }`}>
              completed follow-ups
            </span>
          </div>
        </button>
      </div>

      {/* Minimal Status Tabs: All, Dues (Orange hover), Completed (Green hover) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          type="button"
          onClick={() => handleStatusTabChange('')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
            status === '' || status === 'all'
              ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 hover:shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-blue-50/60 hover:text-blue-700 hover:border-blue-300'
          }`}
        >
          All ({data?.pagination?.total || 0})
        </button>

        <button
          type="button"
          onClick={() => handleStatusTabChange('dues')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
            status === 'dues' || status === 'pending'
              ? 'bg-amber-600 text-white shadow-xs hover:bg-amber-700 hover:shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-amber-50/70 hover:text-amber-700 hover:border-amber-300'
          }`}
        >
          <span>Dues</span>
          {totalDuesCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors duration-150 ${
              status === 'dues' || status === 'pending'
                ? 'bg-amber-700 text-white'
                : 'bg-gray-100 text-gray-700 group-hover:bg-amber-100 group-hover:text-amber-800'
            }`}>
              {totalDuesCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleStatusTabChange('completed')}
          className={`group px-3 py-1.5 rounded-lg font-medium transition-all duration-150 cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
            status === 'completed'
              ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 hover:shadow-sm'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-emerald-50/70 hover:text-emerald-700 hover:border-emerald-300'
          }`}
        >
          <span>Completed</span>
          {completedCount > 0 && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold transition-colors duration-150 ${
              status === 'completed'
                ? 'bg-emerald-700 text-white'
                : 'bg-gray-100 text-gray-700 group-hover:bg-emerald-100 group-hover:text-emerald-800'
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
                            <span className="font-medium text-gray-900 text-sm block">
                              {f.title}
                            </span>
                            {f.remarks && (
                              <span className="text-xs text-gray-500 truncate block mt-0.5">
                                {f.remarks}
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
                                  <span className="text-[11px] text-red-600 font-medium">
                                    {f.days_overdue ? `${f.days_overdue}d overdue` : 'Overdue'}
                                  </span>
                                ) : Number(f.days_overdue) === 0 ? (
                                  <span className="text-[11px] text-amber-700 font-medium">
                                    Due today
                                  </span>
                                ) : Number(f.days_overdue) > 0 ? (
                                  <span className="text-[11px] text-amber-700 font-medium">
                                    {f.days_overdue}d due
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
                            <span className={
                              f.status === 'completed'
                                ? 'text-gray-900'
                                : f.status === 'cancelled'
                                ? 'text-gray-400'
                                : isOverdue
                                ? 'text-red-700'
                                : 'text-gray-700'
                            }>
                              {f.status === 'completed'
                                ? 'Completed'
                                : f.status === 'cancelled'
                                ? 'Cancelled'
                                : isOverdue
                                ? 'Overdue'
                                : 'Pending'}
                            </span>
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
            {/* Target details */}
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-1.5 text-gray-700">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Executive:</span>
                <span className="font-semibold text-gray-900">
                  {completeTarget.salesperson_name} ({completeTarget.salesperson_role_name || 'Technical Executive'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Farmer:</span>
                <span className="font-semibold text-gray-900">{completeTarget.company_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Scheduled Date:</span>
                <span className="font-mono text-gray-800">
                  {completeTarget.followup_date}
                  {completeTarget.followup_time ? ` at ${completeTarget.followup_time}` : ''}
                </span>
              </div>
            </div>

            {/* Completion Notes */}
            <div>
              <label className="label">
                Completion Notes <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="input"
                rows={3}
                placeholder="Enter completion remarks or recommendations..."
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
                <span>{completing ? 'Completing...' : 'Mark Completed'}</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
