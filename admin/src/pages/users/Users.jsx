import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import {
  UsersIcon,
  PlusIcon,
  PencilSquareIcon,
  UserGroupIcon,
  MapPinIcon,
  CheckIcon,
  PhoneIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

function UserModal({ open, onClose, user, roles, asms, technicalExecutives, onSaved }) {
  const isEdit = Boolean(user?.id);
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);
  const [selectedExecIds, setSelectedExecIds] = useState([]);
  const [execSearch, setExecSearch] = useState('');

  const selectedRoleId = watch('role_id');
  const selectedRole = useMemo(() => {
    return roles?.find(r => String(r.id) === String(selectedRoleId));
  }, [roles, selectedRoleId]);

  const isAsm = selectedRole?.name === 'sales_manager';
  const isTechExec = selectedRole?.name === 'sales_executive';

  useEffect(() => {
    if (open) {
      if (user) {
        const joiningDateStr = user.joining_date ? user.joining_date.substring(0, 10) : '';
        const roleId = user.role_id || roles?.find(r => r.name === user.role)?.id || '';
        reset({
          full_name: user.full_name || '',
          email: user.email || '',
          mobile: user.mobile || '',
          role_id: roleId,
          manager_id: user.manager_id || '',
          department: user.department || '',
          region: user.region || '',
          area: user.area || '',
          status: user.status || 'active',
          joining_date: joiningDateStr,
        });

        // Pre-fill assigned executives for ASM
        if (user.id) {
          userApi.get(user.id)
            .then(res => {
              const execIds = res.data?.data?.executive_ids || [];
              setSelectedExecIds(execIds);
            })
            .catch(() => {
              setSelectedExecIds([]);
            });
        }
      } else {
        reset({
          full_name: '',
          email: '',
          mobile: '',
          role_id: '',
          manager_id: '',
          department: '',
          region: '',
          area: '',
          status: 'active',
          joining_date: '',
        });
        setSelectedExecIds([]);
      }
      setExecSearch('');
    }
  }, [open, user, reset, roles]);

  const toggleExecSelection = (id) => {
    setSelectedExecIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredExecutives = useMemo(() => {
    if (!technicalExecutives) return [];
    if (!execSearch.trim()) return technicalExecutives;
    const term = execSearch.toLowerCase();
    return technicalExecutives.filter(e =>
      e.full_name?.toLowerCase().includes(term) ||
      e.email?.toLowerCase().includes(term) ||
      e.area?.toLowerCase().includes(term) ||
      e.mobile?.includes(term)
    );
  }, [technicalExecutives, execSearch]);

  const selectAllUnassigned = () => {
    const unassignedIds = (technicalExecutives || [])
      .filter(e => !e.manager_id || (user && e.manager_id === user.id))
      .map(e => e.id);
    setSelectedExecIds(Array.from(new Set([...selectedExecIds, ...unassignedIds])));
  };

  const clearAllSelected = () => {
    setSelectedExecIds([]);
  };

  const onSubmit = async (formData) => {
    setLoading(true);
    try {
      const payload = {
        full_name: formData.full_name,
        mobile: formData.mobile,
        role_id: Number(formData.role_id),
        status: formData.status || 'active',
        department: formData.department || null,
        joining_date: formData.joining_date || null,
        region: isAsm ? (formData.region || null) : null,
        area: isTechExec ? (formData.area || null) : null,
        manager_id: isTechExec && formData.manager_id ? Number(formData.manager_id) : (formData.manager_id ? Number(formData.manager_id) : null),
      };

      if (isAsm) {
        payload.executive_ids = selectedExecIds;
      }

      if (isEdit) {
        await userApi.update(user.id, payload);
        toast.success('User updated successfully');
      } else {
        payload.email = formData.email;
        await userApi.create(payload);
        toast.success('User created. Default password: Welcome@123');
      }

      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit User Details' : 'Create New User'} size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Section 1: Basic Information */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <UsersIcon className="w-3.5 h-3.5" /> Basic Details
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="label">Full Name <span className="text-red-500">*</span></label>
              <input
                {...register('full_name', { required: 'Full name is required' })}
                className="input"
                placeholder="e.g. Ramesh Kumar"
              />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
            </div>

            <div>
              <label className="label">Email Address <span className="text-red-500">*</span></label>
              <input
                type="email"
                disabled={isEdit}
                {...register('email', { required: !isEdit && 'Email is required' })}
                className={`input ${isEdit ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                placeholder="user@example.com"
              />
              {isEdit && <p className="text-[11px] text-gray-400 mt-1">Email cannot be modified.</p>}
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Mobile Number <span className="text-red-500">*</span></label>
              <input
                {...register('mobile', { required: 'Mobile number is required' })}
                className="input font-mono"
                placeholder="e.g. 9876543210"
              />
              {errors.mobile && <p className="text-xs text-red-500 mt-1">{errors.mobile.message}</p>}
            </div>

            <div>
              <label className="label">Role Assignment <span className="text-red-500">*</span></label>
              <select
                {...register('role_id', { required: 'Role is required' })}
                className="input font-medium"
              >
                <option value="">Select role</option>
                {roles?.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.display_name} {r.name === 'sales_manager' ? '(ASM)' : r.name === 'sales_executive' ? '(Technical Executive)' : ''}
                  </option>
                ))}
              </select>
              {errors.role_id && <p className="text-xs text-red-500 mt-1">{errors.role_id.message}</p>}
            </div>

            <div>
              <label className="label">Account Status</label>
              <select {...register('status')} className="input">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 2: ASM Specific Setup */}
        {isAsm && (
          <div className="border border-blue-200 bg-blue-50/40 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-blue-900 font-semibold text-sm">
              <span className="p-1 rounded-md bg-blue-100 text-blue-700">
                <UserGroupIcon className="w-4 h-4" />
              </span>
              Area Sales Manager (ASM) Territory & Team
            </div>

            <div>
              <label className="label text-blue-950 font-medium">
                Assigned Region <span className="text-red-500">*</span>
              </label>
              <input
                {...register('region', { required: isAsm && 'Assigned region is required for ASM' })}
                className="input bg-white"
                placeholder="e.g. Nellore Region, South Coast Zone, Krishna District"
              />
              {errors.region && <p className="text-xs text-red-500 mt-1">{errors.region.message}</p>}
              <p className="text-[11px] text-gray-500 mt-1">Territory or region managed by this ASM.</p>
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-2">
                <label className="label text-blue-950 font-medium !mb-0">
                  Assign Technical Executives ({selectedExecIds.length} selected)
                </label>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={selectAllUnassigned}
                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                  >
                    Select Unassigned
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={clearAllSelected}
                    className="text-gray-500 hover:text-gray-700 hover:underline"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="relative mb-2">
                <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  value={execSearch}
                  onChange={e => setExecSearch(e.target.value)}
                  placeholder="Filter executives by name, area, or mobile..."
                  className="input pl-8 py-1.5 text-xs bg-white"
                />
                {execSearch && (
                  <button
                    type="button"
                    onClick={() => setExecSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XMarkIcon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="max-h-48 overflow-y-auto border border-blue-200/80 rounded-lg bg-white divide-y divide-gray-100 shadow-inner">
                {filteredExecutives.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-400">
                    No technical executives found matching "{execSearch}"
                  </div>
                ) : (
                  filteredExecutives.map(exec => {
                    const isChecked = selectedExecIds.includes(exec.id);
                    const isAssignedElsewhere = exec.manager_id && (!user || exec.manager_id !== user.id);

                    return (
                      <label
                        key={exec.id}
                        className={`flex items-center justify-between gap-2 p-2.5 hover:bg-blue-50/40 cursor-pointer text-xs transition select-none ${
                          isChecked ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleExecSelection(exec.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4 shrink-0"
                          />
                          <div className="min-w-0">
                            <span className="font-medium text-gray-900 block sm:inline truncate">{exec.full_name}</span>
                            <span className="text-gray-400 text-[11px] sm:ml-2 font-mono">({exec.mobile})</span>
                            {exec.area && (
                              <span className="sm:ml-2 inline-flex items-center text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded text-[10px] font-medium border border-emerald-100">
                                📍 {exec.area}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          {isChecked ? (
                            <span className="text-[10px] text-blue-700 bg-blue-100 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckIcon className="w-3 h-3" /> Reporting
                            </span>
                          ) : isAssignedElsewhere ? (
                            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                              ASM: {exec.manager_name || 'Other'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic">Unassigned</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-1.5">
                Checked executives will have their reporting manager set to this ASM.
              </p>
            </div>
          </div>
        )}

        {/* Section 2: Technical Executive Specific Setup */}
        {isTechExec && (
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3.5 sm:p-4 space-y-3.5">
            <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
              <span className="p-1 rounded-md bg-emerald-100 text-emerald-700">
                <MapPinIcon className="w-4 h-4" />
              </span>
              Technical Executive Territory & Reporting
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="label text-emerald-950 font-medium">
                  Assigned Area <span className="text-red-500">*</span>
                </label>
                <input
                  {...register('area', { required: isTechExec && 'Area is required for Technical Executive' })}
                  className="input bg-white"
                  placeholder="e.g. Kavali, Bapatla, Bhimavaram"
                />
                {errors.area && <p className="text-xs text-red-500 mt-1">{errors.area.message}</p>}
                <p className="text-[11px] text-gray-500 mt-1">Field territory assigned to this executive.</p>
              </div>

              <div>
                <label className="label text-emerald-950 font-medium">
                  Assign under ASM <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('manager_id', { required: isTechExec && 'Please select reporting ASM' })}
                  className="input bg-white font-medium"
                >
                  <option value="">Select ASM (Area Sales Manager)</option>
                  {asms?.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.region ? `— Region: ${m.region}` : ''}
                    </option>
                  ))}
                </select>
                {errors.manager_id && <p className="text-xs text-red-500 mt-1">{errors.manager_id.message}</p>}
                <p className="text-[11px] text-gray-500 mt-1">ASM this executive reports to.</p>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Additional Employment Details */}
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <ClockIcon className="w-3.5 h-3.5" /> Additional Info
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {!isAsm && !isTechExec && (
              <div>
                <label className="label">Reporting Manager</label>
                <select {...register('manager_id')} className="input">
                  <option value="">No manager</option>
                  {asms?.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.full_name} {m.region ? `(${m.region})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label">Department</label>
              <input {...register('department')} className="input" placeholder="e.g. Field Operations, Sales" />
            </div>
            <div>
              <label className="label">Joining Date</label>
              <input type="date" {...register('joining_date')} className="input" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
          <button type="button" onClick={onClose} className="btn-secondary !px-4">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="btn-primary !px-5">
            {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Users() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, role, status, search],
    queryFn: () => userApi.list({ page, limit: 20, role, status, search }).then(r => r.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.roles().then(r => r.data.data),
  });

  const { data: asms } = useQuery({
    queryKey: ['asms'],
    queryFn: () => userApi.list({ role: 'sales_manager', status: 'active', limit: 100 }).then(r => r.data.data),
  });

  const { data: technicalExecutives } = useQuery({
    queryKey: ['technicalExecutives'],
    queryFn: () => userApi.list({ role: 'sales_executive', limit: 100 }).then(r => r.data.data),
  });

  const toggleStatus = async (user) => {
    try {
      await userApi.update(user.id, {
        ...user,
        status: user.status === 'active' ? 'inactive' : 'active',
        role_id: user.role_id || roles?.find(r => r.name === user.role)?.id,
      });
      toast.success('User status updated');
      qc.invalidateQueries(['users']);
      qc.invalidateQueries(['asms']);
      qc.invalidateQueries(['technicalExecutives']);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const openAddModal = () => {
    setEditingUser(null);
    setModalOpen(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setModalOpen(true);
  };

  const handleSaved = () => {
    qc.invalidateQueries(['users']);
    qc.invalidateQueries(['asms']);
    qc.invalidateQueries(['technicalExecutives']);
  };

  return (
    <div>
      {/* Clean Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Users & Team</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {data?.pagination?.total || 0} users in system
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="btn-primary btn-sm flex items-center gap-1.5"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <FilterBar
        onSearch={setSearch}
        searchValue={search}
        onReset={() => { setRole(''); setStatus(''); setSearch(''); }}
      >
        <SelectFilter
          label="All Roles"
          value={role}
          onChange={setRole}
          options={roles?.map(r => ({
            value: r.name,
            label: r.name === 'sales_manager' ? 'ASM (Area Sales Manager)' : r.name === 'sales_executive' ? 'Technical Executive' : r.display_name,
          })) || []}
        />
        <SelectFilter
          label="All Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterBar>

      {/* Main Content Area */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card overflow-hidden">
          {data?.data?.length === 0 ? (
            <EmptyState
              title="No users found"
              description="No users matched your search and filter criteria."
              icon={UsersIcon}
              action={<button onClick={openAddModal} className="btn-primary btn-sm">Add User</button>}
            />
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-1/4">User</th>
                      <th className="w-1/5">Contact</th>
                      <th>Role</th>
                      <th>Region / Area</th>
                      <th>Hierarchy / Team</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.data.map(u => {
                      const isAsmUser = u.role === 'sales_manager';
                      const isTechExecUser = u.role === 'sales_executive';

                      return (
                        <tr key={u.id} className="hover:bg-gray-50/80 transition">
                          <td>
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                                isAsmUser ? 'bg-blue-600' :
                                isTechExecUser ? 'bg-emerald-600' :
                                'bg-gray-600'
                              }`}>
                                {u.full_name?.[0]?.toUpperCase() || 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{u.full_name}</div>
                                {u.department ? (
                                  <span className="text-[11px] text-gray-400 font-medium">{u.department}</span>
                                ) : (
                                  <span className="text-[11px] text-gray-400">#{u.id}</span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <div className="space-y-0.5 text-xs">
                              <div className="text-gray-700 flex items-center gap-1.5 truncate" title={u.email}>
                                <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="truncate">{u.email}</span>
                              </div>
                              <div className="text-gray-500 font-mono flex items-center gap-1.5">
                                <PhoneIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span>{u.mobile}</span>
                              </div>
                            </div>
                          </td>

                          <td>
                            <Badge color={isAsmUser ? 'blue' : isTechExecUser ? 'green' : 'gray'}>
                              {u.role_display}
                            </Badge>
                          </td>

                          <td>
                            {isAsmUser && (
                              <div>
                                {u.region ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                    <MapPinIcon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    {u.region}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">Unassigned</span>
                                )}
                              </div>
                            )}
                            {isTechExecUser && (
                              <div>
                                {u.area ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                    <MapPinIcon className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    {u.area}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">Unassigned</span>
                                )}
                              </div>
                            )}
                            {!isAsmUser && !isTechExecUser && (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>

                          <td>
                            {isAsmUser && (
                              <div>
                                {u.assigned_executives_count > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100 cursor-help"
                                    title={`Assigned Technical Executives:\n${u.assigned_executives_names}`}
                                  >
                                    <UserGroupIcon className="w-3.5 h-3.5 text-indigo-600" />
                                    {u.assigned_executives_count} Executives
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-xs italic">0 executives</span>
                                )}
                              </div>
                            )}
                            {isTechExecUser && (
                              <div className="text-xs">
                                {u.manager_name ? (
                                  <span className="text-gray-800">
                                    ASM: <span className="font-medium text-blue-700">{u.manager_name}</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                                    No ASM Assigned
                                  </span>
                                )}
                              </div>
                            )}
                            {!isAsmUser && !isTechExecUser && (
                              <span className="text-gray-600 text-xs">{u.manager_name || '—'}</span>
                            )}
                          </td>

                          <td>
                            <button
                              onClick={() => toggleStatus(u)}
                              className="group cursor-pointer hover:opacity-80 transition"
                              title="Click to toggle status"
                            >
                              <Badge color={u.status === 'active' ? 'green' : 'red'}>
                                {u.status}
                              </Badge>
                            </button>
                          </td>

                          <td className="text-right">
                            <button
                              onClick={() => openEditModal(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition active:scale-95"
                              title="Edit user"
                            >
                              <PencilSquareIcon className="w-3.5 h-3.5" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card Layout */}
              <div className="md:hidden divide-y divide-gray-100">
                {data.data.map(u => {
                  const isAsmUser = u.role === 'sales_manager';
                  const isTechExecUser = u.role === 'sales_executive';

                  return (
                    <div key={u.id} className="p-4 space-y-3 hover:bg-gray-50/70 transition">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ${
                            isAsmUser ? 'bg-blue-600' :
                            isTechExecUser ? 'bg-emerald-600' :
                            'bg-gray-600'
                          }`}>
                            {u.full_name?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 text-sm leading-tight truncate">{u.full_name}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge color={isAsmUser ? 'blue' : isTechExecUser ? 'green' : 'gray'}>
                                {u.role_display}
                              </Badge>
                              {u.department && (
                                <span className="text-[11px] text-gray-400 truncate">{u.department}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => toggleStatus(u)}
                          className="cursor-pointer shrink-0"
                          title="Toggle Status"
                        >
                          <Badge color={u.status === 'active' ? 'green' : 'red'}>
                            {u.status}
                          </Badge>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-gray-50/80 p-3 rounded-lg border border-gray-100">
                        <div className="space-y-1">
                          <a href={`mailto:${u.email}`} className="text-gray-700 flex items-center gap-1.5 truncate hover:text-blue-600">
                            <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </a>
                          <a href={`tel:${u.mobile}`} className="text-gray-700 font-mono flex items-center gap-1.5 hover:text-blue-600">
                            <PhoneIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{u.mobile}</span>
                          </a>
                        </div>

                        <div className="space-y-1 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200/60">
                          {isAsmUser && (
                            <div>
                              <span className="text-gray-500">Region: </span>
                              <span className="font-medium text-blue-800">{u.region || 'None'}</span>
                            </div>
                          )}
                          {isTechExecUser && (
                            <div>
                              <span className="text-gray-500">Area: </span>
                              <span className="font-medium text-emerald-800">{u.area || 'None'}</span>
                            </div>
                          )}

                          {isAsmUser && (
                            <div>
                              <span className="text-gray-500">Team: </span>
                              <span className="font-medium text-indigo-700">
                                {u.assigned_executives_count} Executives
                              </span>
                            </div>
                          )}
                          {isTechExecUser && (
                            <div>
                              <span className="text-gray-500">Reporting ASM: </span>
                              <span className="font-medium text-gray-800">
                                {u.manager_name || 'Unassigned'}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-[11px] text-gray-400">
                          Last login: {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                        </span>
                        <button
                          onClick={() => openEditModal(u)}
                          className="btn-secondary !py-1 !px-2.5 text-xs flex items-center gap-1 text-blue-600 font-medium"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" />
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Pagination */}
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      {/* User Modal */}
      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        user={editingUser}
        roles={roles}
        asms={asms}
        technicalExecutives={technicalExecutives}
        onSaved={handleSaved}
      />
    </div>
  );
}
