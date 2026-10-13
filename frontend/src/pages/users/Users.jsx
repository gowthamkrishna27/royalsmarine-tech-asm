import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import { UsersIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

function UserModal({ open, onClose, roles, managers, onCreated }) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [loading, setLoading] = useState(false);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await userApi.create(data);
      toast.success('User created. Default password: Welcome@123');
      reset();
      onCreated();
      onClose();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Create User" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="label">Full Name <span className="text-red-500">*</span></label>
          <input {...register('full_name', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Email <span className="text-red-500">*</span></label>
          <input type="email" {...register('email', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Mobile <span className="text-red-500">*</span></label>
          <input {...register('mobile', { required: true })} className="input" />
        </div>
        <div>
          <label className="label">Role <span className="text-red-500">*</span></label>
          <select {...register('role_id', { required: true })} className="input">
            <option value="">Select role</option>
            {roles?.map(r => <option key={r.id} value={r.id}>{r.display_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Manager</label>
          <select {...register('manager_id')} className="input">
            <option value="">No manager</option>
            {managers?.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Department</label>
          <input {...register('department')} className="input" />
        </div>
        <div>
          <label className="label">Joining Date</label>
          <input type="date" {...register('joining_date')} className="input" />
        </div>
        <div className="sm:col-span-2 flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary">Create User</button>
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
  const [addModal, setAddModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, role, status, search],
    queryFn: () => userApi.list({ page, limit: 20, role, status, search }).then(r => r.data),
  });
  const { data: roles } = useQuery({ queryKey: ['roles'], queryFn: () => userApi.roles().then(r => r.data.data) });
  const { data: managers } = useQuery({ queryKey: ['managers'], queryFn: () => userApi.list({ role: 'sales_manager', status: 'active' }).then(r => r.data.data) });

  const toggleStatus = async (user) => {
    try {
      await userApi.update(user.id, { ...user, status: user.status === 'active' ? 'inactive' : 'active', role_id: roles?.find(r => r.name === user.role)?.id });
      toast.success('User status updated');
      qc.invalidateQueries(['users']);
    } catch { toast.error('Failed'); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="text-sm text-gray-500">{data?.pagination?.total || 0} users</p>
        </div>
        <button onClick={() => setAddModal(true)} className="btn-primary btn-sm">
          <PlusIcon className="w-4 h-4" /> Add User
        </button>
      </div>

      <FilterBar onSearch={setSearch} searchValue={search} onReset={() => { setRole(''); setStatus(''); setSearch(''); }}>
        <SelectFilter label="All Roles" value={role} onChange={setRole} options={roles?.map(r => ({ value: r.name, label: r.display_name })) || []} />
        <SelectFilter label="All Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
      </FilterBar>

      {isLoading ? <PageSpinner /> : (
        <div className="card">
          {data?.data?.length === 0 ? (
            <EmptyState title="No users found" icon={UsersIcon} action={<button onClick={() => setAddModal(true)} className="btn-primary btn-sm">Add User</button>} />
          ) : (
            <>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Mobile</th>
                      <th>Role</th>
                      <th>Manager</th>
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map(u => (
                      <tr key={u.id}>
                        <td className="font-medium text-gray-900">{u.full_name}</td>
                        <td className="text-gray-600">{u.email}</td>
                        <td className="text-gray-600">{u.mobile}</td>
                        <td><Badge color="blue">{u.role_display}</Badge></td>
                        <td className="text-gray-600">{u.manager_name || '—'}</td>
                        <td>
                          <button onClick={() => toggleStatus(u)} className="group">
                            <Badge color={u.status === 'active' ? 'green' : 'red'}>{u.status}</Badge>
                          </button>
                        </td>
                        <td className="text-gray-500 text-xs">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                        <td className="text-blue-600 text-sm hover:underline cursor-pointer">Edit</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={data.pagination} onPageChange={setPage} />
            </>
          )}
        </div>
      )}

      <UserModal open={addModal} onClose={() => setAddModal(false)} roles={roles} managers={managers}
        onCreated={() => qc.invalidateQueries(['users'])} />
    </div>
  );
}
