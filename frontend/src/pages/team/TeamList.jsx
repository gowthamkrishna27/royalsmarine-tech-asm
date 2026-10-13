import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { userApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import FilterBar, { SelectFilter } from '../../components/common/FilterBar';
import EmptyState from '../../components/common/EmptyState';
import { UsersIcon, ArrowLeftIcon, BriefcaseIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function TeamListPage({ defaultRole }) {
  const qc = useQueryClient();
  const location = useLocation();

  // Determine role from prop or URL
  const isAsm = defaultRole === 'sales_manager' || location.pathname.includes('asm');
  const role = isAsm ? 'sales_manager' : 'sales_executive';
  const roleTitle = isAsm ? 'Area Sales Managers (ASMs)' : 'Technical Executives';
  const roleShort = isAsm ? 'ASM' : 'Technical Executive';
  const RoleIcon = isAsm ? BriefcaseIcon : WrenchScrewdriverIcon;

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['team-users', role, page, status, search],
    queryFn: () => userApi.list({ page, limit: 20, role, status, search }).then(r => r.data),
  });

  const toggleStatus = async (user) => {
    try {
      await userApi.update(user.id, {
        ...user,
        status: user.status === 'active' ? 'inactive' : 'active',
      });
      toast.success('Status updated');
      qc.invalidateQueries(['team-users']);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const users = data?.data || [];
  const meta = data?.pagination;

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2.5 py-1 rounded-md"
            >
              <ArrowLeftIcon className="w-3.5 h-3.5" /> Back to Dashboard
            </Link>
          </div>
          <h1 className="page-title">{roleTitle}</h1>
          <p className="text-sm text-gray-500">
            {meta?.total || users.length} {roleTitle.toLowerCase()} registered in the system
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        onSearch={setSearch}
        searchValue={search}
        onReset={() => {
          setStatus('');
          setSearch('');
          setPage(1);
        }}
      >
        <SelectFilter
          label="All Statuses"
          value={status}
          onChange={(val) => {
            setStatus(val);
            setPage(1);
          }}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
      </FilterBar>

      {/* Content */}
      {isLoading ? (
        <PageSpinner />
      ) : (
        <div className="card">
          {users.length === 0 ? (
            <EmptyState
              title={`No ${roleTitle} found`}
              message={
                search || status
                  ? 'No team members match your filter criteria.'
                  : `No ${roleTitle} have been created yet.`
              }
              icon={RoleIcon}
            />
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
                      {!isAsm && <th>Reporting ASM</th>}
                      <th>Status</th>
                      <th>Last Login</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="font-semibold text-gray-900">{u.full_name}</div>
                          {u.department && (
                            <span className="text-xs text-gray-400">{u.department}</span>
                          )}
                        </td>
                        <td className="text-gray-600">{u.email}</td>
                        <td className="text-gray-600">{u.mobile}</td>
                        <td>
                          <Badge color={isAsm ? 'blue' : 'green'}>{roleShort}</Badge>
                        </td>
                        {!isAsm && (
                          <td className="text-gray-600 font-medium">{u.manager_name || '—'}</td>
                        )}
                        <td>
                          <button onClick={() => toggleStatus(u)} className="group" title="Click to toggle status">
                            <Badge color={u.status === 'active' ? 'green' : 'red'}>
                              {u.status}
                            </Badge>
                          </button>
                        </td>
                        <td className="text-gray-500 text-xs">
                          {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                        </td>
                        <td>
                          <Link to="/users" className="text-blue-600 text-xs font-semibold hover:underline">
                            Manage in Users →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {meta && <Pagination meta={meta} onPageChange={setPage} />}
            </>
          )}
        </div>
      )}
    </div>
  );
}
