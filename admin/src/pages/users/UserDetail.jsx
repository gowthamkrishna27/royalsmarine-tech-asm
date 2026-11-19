import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi, reportApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import { UserModal } from './Users';
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  PhoneIcon,
  MapPinIcon,
  CalendarDaysIcon,
  ClockIcon,
  BriefcaseIcon,
  UserGroupIcon,
  UsersIcon,
  PencilSquareIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  ArrowTopRightOnSquareIcon,
  IdentificationIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [downloadingReport, setDownloadingReport] = useState(false);

  const handleDownloadReport = async () => {
    if (!user) return;
    setDownloadingReport(true);
    try {
      const params = { type: 'visits' };
      if (user.role === 'sales_manager') {
        params.asm_id = user.id;
      } else if (user.role === 'sales_executive') {
        params.technician_id = user.id;
        params.salesperson_id = user.id;
      }
      const res = await reportApi.export(params);
      const roleSuffix = user.role === 'sales_manager' ? 'asm' : 'technician';
      downloadBlob(res.data, `${user.full_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${roleSuffix}_report.xlsx`);
      toast.success('Downloaded report');
    } catch {
      toast.error('Download failed');
    } finally {
      setDownloadingReport(false);
    }
  };

  const { data: user, isLoading, error } = useQuery({
    queryKey: ['user-detail', id],
    queryFn: () => userApi.get(id).then((r) => r.data.data),
  });

  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: () => userApi.roles().then((r) => r.data.data),
  });

  const { data: asms } = useQuery({
    queryKey: ['asms'],
    queryFn: () => userApi.list({ role: 'sales_manager', status: 'active', limit: 100 }).then((r) => r.data.data),
  });

  const { data: technicalExecutives } = useQuery({
    queryKey: ['technicalExecutives'],
    queryFn: () => userApi.list({ role: 'sales_executive', status: 'active', limit: 100 }).then((r) => r.data.data),
  });

  const toggleStatus = async () => {
    if (!user) return;
    try {
      await userApi.update(user.id, {
        ...user,
        status: user.status === 'active' ? 'inactive' : 'active',
        role_id: user.role_id,
      });
      toast.success('User status updated');
      qc.invalidateQueries(['user-detail', id]);
      qc.invalidateQueries(['users']);
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleSaved = () => {
    qc.invalidateQueries(['user-detail', id]);
    qc.invalidateQueries(['users']);
    qc.invalidateQueries(['asms']);
    qc.invalidateQueries(['technicalExecutives']);
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <PageSpinner />
        <p className="text-xs text-gray-400 mt-2">Loading user details...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-8 text-center bg-white border border-gray-200 rounded-xl my-6">
        <h3 className="text-sm font-semibold text-gray-900">User Not Found</h3>
        <p className="text-xs text-gray-500 mt-1">The requested user does not exist or has been deleted.</p>
        <button
          type="button"
          onClick={() => navigate('/users')}
          className="btn-secondary btn-sm mt-4 inline-flex items-center gap-1.5"
        >
          <ArrowLeftIcon className="w-3.5 h-3.5" />
          <span>Back to Users & Team</span>
        </button>
      </div>
    );
  }

  const isAsm = user.role === 'sales_manager';
  const isTechExec = user.role === 'sales_executive';
  const stats = user.stats || {};
  const teamMembers = user.assigned_executives || [];
  const recentVisits = user.recent_visits || [];
  const recentFarmers = user.recent_farmers || [];

  return (
    <div className="space-y-5 fade-in pb-12">
      {/* 1. Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to="/users"
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition shrink-0"
            title="Back to Users & Team"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {user.full_name}
              </h1>
              <Badge color={isAsm ? 'blue' : isTechExec ? 'green' : 'gray'}>
                {user.role_display}
              </Badge>
              <button
                type="button"
                onClick={toggleStatus}
                className="cursor-pointer hover:opacity-85 transition"
                title="Click to toggle status"
              >
                <Badge color={user.status === 'active' ? 'green' : 'red'}>
                  {user.status}
                </Badge>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              User ID #{user.id} {user.department ? `• Department: ${user.department}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {user.mobile && (
            <a
              href={`tel:${user.mobile}`}
              className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5"
            >
              <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Call</span>
            </a>
          )}
          {user.email && (
            <a
              href={`mailto:${user.email}`}
              className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5"
            >
              <EnvelopeIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Email</span>
            </a>
          )}
          {(isAsm || isTechExec) && (
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Download Visit Report in standard format"
            >
              <ArrowDownTrayIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>{downloadingReport ? 'Downloading...' : 'Download Report'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="btn-primary btn-sm text-xs inline-flex items-center gap-1.5"
          >
            <PencilSquareIcon className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-gray-100 shadow-2xs overflow-hidden">
        {isAsm ? (
          <>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Team Size
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_team_members || 0} <span className="text-xs font-normal text-gray-400">executives</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Territory Farmers
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_farmers || 0} <span className="text-xs font-normal text-gray-400">farmers</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Team Field Visits
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_visits || 0} <span className="text-xs font-normal text-gray-400">logged</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Tanks Managed
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_ponds || 0} <span className="text-xs font-normal text-gray-400">ponds</span>
              </p>
            </div>
          </>
        ) : isTechExec ? (
          <>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Assigned Farmers
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_farmers || 0} <span className="text-xs font-normal text-gray-400">farmers</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Field Visits Logged
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_visits || 0} <span className="text-xs font-normal text-gray-400">visits</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Tanks / Ponds
              </p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
                {stats.total_ponds || 0} <span className="text-xs font-normal text-gray-400">tanks</span>
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Assigned Area
              </p>
              <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 truncate">
                {user.area || '—'}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Role
              </p>
              <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
                {user.role_display}
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Department
              </p>
              <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5">
                {user.department || 'Operations'}
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Account Status
              </p>
              <p className="text-base sm:text-lg font-bold text-gray-900 mt-0.5 capitalize">
                {user.status}
              </p>
            </div>
            <div className="p-3.5 sm:p-4">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                Last Activity
              </p>
              <p className="text-xs sm:text-sm font-medium text-gray-800 mt-1">
                {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* 3. Profile Information Card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-2xs">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
          <IdentificationIcon className="w-4 h-4 text-gray-500" /> User Profile & Assignment
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6 text-xs">
          <div>
            <span className="text-gray-400 block font-medium">Full Name</span>
            <span className="text-gray-900 font-semibold text-sm mt-0.5 block">{user.full_name}</span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Email Address</span>
            <span className="text-gray-800 font-medium mt-0.5 block truncate">{user.email || '—'}</span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Mobile Number</span>
            <span className="text-gray-800 font-mono font-medium mt-0.5 block">{user.mobile || '—'}</span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Role</span>
            <span className="text-gray-900 font-medium mt-0.5 block">{user.role_display}</span>
          </div>

          {isAsm && (
            <div>
              <span className="text-gray-400 block font-medium">Managed Region / Territory</span>
              <span className="text-blue-800 font-semibold mt-0.5 block">
                {user.region ? `📍 ${user.region}` : 'Unassigned'}
              </span>
            </div>
          )}

          {isTechExec && (
            <div>
              <span className="text-gray-400 block font-medium">Field Area / Territory</span>
              <span className="text-emerald-800 font-semibold mt-0.5 block">
                {user.area ? `📍 ${user.area}` : 'Unassigned'}
              </span>
            </div>
          )}

          {isTechExec && (
            <div>
              <span className="text-gray-400 block font-medium">Reporting Area Sales Manager (ASM)</span>
              {user.manager_id ? (
                <Link
                  to={`/users/${user.manager_id}`}
                  className="text-blue-600 hover:text-blue-800 font-medium mt-0.5 inline-flex items-center gap-1 hover:underline"
                >
                  <span>{user.manager_name}</span>
                  <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </Link>
              ) : (
                <span className="text-amber-700 font-medium mt-0.5 block">No ASM Assigned</span>
              )}
            </div>
          )}

          <div>
            <span className="text-gray-400 block font-medium">Department</span>
            <span className="text-gray-800 mt-0.5 block">{user.department || '—'}</span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Joining Date</span>
            <span className="text-gray-800 mt-0.5 block">
              {user.joining_date ? String(user.joining_date).slice(0, 10) : '—'}
            </span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Last Login</span>
            <span className="text-gray-800 mt-0.5 block">
              {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never logged in'}
            </span>
          </div>

          <div>
            <span className="text-gray-400 block font-medium">Account Created</span>
            <span className="text-gray-500 mt-0.5 block font-mono text-[11px]">
              {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Team Members List (If ASM) */}
      {isAsm && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <UserGroupIcon className="w-4 h-4 text-blue-600" />
              Technical Executives Under Management ({teamMembers.length})
            </h2>
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Manage Team
            </button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No technical executives are currently assigned to this ASM.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Executive</th>
                    <th className="py-2.5 px-3">Contact</th>
                    <th className="py-2.5 px-3">Assigned Area</th>
                    <th className="py-2.5 px-3 text-center">Farmers</th>
                    <th className="py-2.5 px-3 text-center">Visits</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teamMembers.map((exec) => (
                    <tr key={exec.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/users/${exec.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition"
                        >
                          {exec.full_name}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 font-mono text-[11px]">
                        <div>{exec.mobile || '—'}</div>
                        <div className="text-gray-400 font-sans">{exec.email}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {exec.area ? (
                          <span className="text-gray-800 font-medium">{exec.area}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-gray-800">
                        {exec.farmers_count || 0}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-gray-800">
                        {exec.visits_count || 0}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge color={exec.status === 'active' ? 'green' : 'red'}>
                          {exec.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/users/${exec.id}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 5. Recent Field Visits */}
      {(isAsm || isTechExec) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <ClipboardDocumentListIcon className="w-4 h-4 text-emerald-600" />
              Recent Field Visits {isAsm ? '(Team Activity)' : ''}
            </h2>
            <Link to="/visits" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View All Visits →
            </Link>
          </div>

          {recentVisits.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No recent field visits recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Farmer</th>
                    <th className="py-2.5 px-3">Location</th>
                    {isAsm && <th className="py-2.5 px-3">Technician</th>}
                    <th className="py-2.5 px-3">Visit Type</th>
                    <th className="py-2.5 px-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                        {v.visit_date}
                      </td>
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/clients/${v.client_id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition"
                        >
                          {v.farmer_name || 'Farmer'}
                        </Link>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 truncate max-w-[140px]">
                        {[v.village, v.district].filter(Boolean).join(', ') || '—'}
                      </td>
                      {isAsm && (
                        <td className="py-2.5 px-3 text-gray-800 font-medium">
                          {v.technician_name || '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-3">
                        <span className="capitalize px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                          {v.visit_type?.replace(/_/g, ' ') || 'Routine'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/visits/${v.id}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 6. Associated Farmers */}
      {(isAsm || isTechExec) && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
              Farmers Assigned / Registered
            </h2>
            <Link to="/clients" className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              View All Farmers →
            </Link>
          </div>

          {recentFarmers.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-400">
              No farmers assigned yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Farmer</th>
                    <th className="py-2.5 px-3">Phone</th>
                    <th className="py-2.5 px-3">Location</th>
                    {isAsm && <th className="py-2.5 px-3">Assigned Tech</th>}
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentFarmers.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/clients/${f.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition"
                        >
                          {f.company_name}
                        </Link>
                        {f.contact_person && (
                          <span className="text-[11px] text-gray-400 block">{f.contact_person}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-gray-600">
                        {f.mobile || '—'}
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 truncate max-w-[140px]">
                        {[f.village, f.district].filter(Boolean).join(', ') || '—'}
                      </td>
                      {isAsm && (
                        <td className="py-2.5 px-3 text-gray-800 font-medium">
                          {f.assigned_to_name || '—'}
                        </td>
                      )}
                      <td className="py-2.5 px-3">
                        <Badge color={f.status === 'active' ? 'green' : 'gray'}>
                          {f.status || 'active'}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Link
                          to={`/clients/${f.id}`}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition inline-flex items-center gap-1"
                        >
                          <span>Profile</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit User Modal */}
      {editModalOpen && (
        <UserModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          user={user}
          roles={roles}
          asms={asms}
          technicalExecutives={technicalExecutives}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
