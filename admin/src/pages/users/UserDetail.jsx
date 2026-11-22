import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi, reportApi } from '../../services/api';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import Badge from '../../components/common/Badge';
import { UserModal } from './Users';
import {
  ArrowLeftIcon as ArrowLeft,
  PhoneIcon as Phone,
  EnvelopeIcon as Mail,
  ArrowDownTrayIcon as Download,
  PencilSquareIcon as Pencil,
  UserIcon as User,
  UserGroupIcon as Users,
  MapPinIcon as MapPin,
  ArrowTopRightOnSquareIcon as ExternalLink,
  ClipboardDocumentListIcon as ClipboardList,
  BuildingOffice2Icon as Building2,
  ArrowRightIcon as ArrowRight,
  ShieldCheckIcon as ShieldCheck,
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
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Users</span>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to="/users"
            className="w-9 h-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition shrink-0 shadow-2xs"
            title="Back to Users"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">
                {user.full_name}
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                {user.role_display}
              </span>
              <button
                type="button"
                onClick={toggleStatus}
                className="cursor-pointer hover:opacity-80 transition"
                title="Click to toggle status"
              >
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                    user.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {user.status}
                </span>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
              <span>User ID #{user.id}</span>
              {user.department && (
                <>
                  <span className="text-gray-300">•</span>
                  <span>Department: {user.department}</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {user.mobile && (
            <a
              href={`tel:${user.mobile}`}
              className="btn-secondary h-8 !py-0 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-gray-500" />
              <span>Call</span>
            </a>
          )}
          {user.email && (
            <a
              href={`mailto:${user.email}`}
              className="btn-secondary h-8 !py-0 px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Mail className="w-3.5 h-3.5 text-gray-500" />
              <span>Email</span>
            </a>
          )}
          {(isAsm || isTechExec) && (
            <button
              type="button"
              onClick={handleDownloadReport}
              disabled={downloadingReport}
              className="btn-secondary h-8 !py-0 px-3 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              title="Download Visit Report in standard format"
            >
              <Download className="w-3.5 h-3.5 text-gray-500" />
              <span>{downloadingReport ? 'Downloading...' : 'Download Report'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="btn-primary h-8 !py-0 px-3 text-xs inline-flex items-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* 2. Key Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-gray-100 overflow-hidden">
        {isAsm ? (
          <>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Team Size
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_team_members || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">executives</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Territory Farmers
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_farmers || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">farmers</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Team Field Visits
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_visits || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">logged</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Tanks Managed
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_ponds || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">ponds</span>
              </div>
            </div>
          </>
        ) : isTechExec ? (
          <>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Assigned Farmers
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_farmers || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">farmers</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Field Visits Logged
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_visits || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">visits</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Tanks / Ponds
              </p>
              <div className="mt-1.5 flex items-baseline gap-1.5 h-8">
                <span className="text-2xl font-bold text-gray-900 tracking-tight">
                  {stats.total_ponds || 0}
                </span>
                <span className="text-xs font-medium text-gray-400">tanks</span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Assigned Area
              </p>
              <div className="mt-1.5 flex items-center gap-1.5 h-8">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="text-base sm:text-lg font-bold text-gray-900 truncate">
                  {user.area || '—'}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Role
              </p>
              <div className="mt-1.5 flex items-center h-8">
                <span className="text-base font-bold text-gray-900">
                  {user.role_display}
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Department
              </p>
              <div className="mt-1.5 flex items-center h-8">
                <span className="text-base font-bold text-gray-900">
                  {user.department || 'Operations'}
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Account Status
              </p>
              <div className="mt-1.5 flex items-center h-8">
                <span className="text-base font-bold text-gray-900 capitalize">
                  {user.status}
                </span>
              </div>
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Last Activity
              </p>
              <div className="mt-1.5 flex items-center h-8">
                <span className="text-xs sm:text-sm font-medium text-gray-700">
                  {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 3. Profile Information Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-gray-400" />
            <span>User Profile & Assignment</span>
          </h2>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-y-6 gap-x-8 text-xs">
          {/* Row 1 */}
          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Full Name
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-semibold text-gray-900">
                {user.full_name}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Email Address
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-medium text-gray-800 truncate">
                {user.email || '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Mobile Number
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-mono font-medium text-gray-800">
                {user.mobile || '—'}
              </span>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Role
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-medium text-gray-900">
                {user.role_display}
              </span>
            </div>
          </div>

          {isTechExec ? (
            <>
              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Field Area / Territory
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  {user.area ? (
                    <span className="text-sm font-medium text-gray-900 inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{user.area}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Reporting ASM
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  {user.manager_id ? (
                    <Link
                      to={`/users/${user.manager_id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 hover:underline"
                    >
                      <span>{user.manager_name}</span>
                      <ExternalLink className="w-3 h-3 text-blue-500 shrink-0" />
                    </Link>
                  ) : (
                    <span className="text-sm text-amber-700 font-medium">No ASM Assigned</span>
                  )}
                </div>
              </div>
            </>
          ) : isAsm ? (
            <>
              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Managed Region / Territory
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  {user.region ? (
                    <span className="text-sm font-medium text-gray-900 inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{user.region}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400">Unassigned</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Managed Team
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  <span className="text-sm font-medium text-gray-900">
                    {teamMembers.length} {teamMembers.length === 1 ? 'Executive' : 'Executives'}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Access Level
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  <span className="text-sm font-medium text-gray-900 inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>Administrator</span>
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-start">
                <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
                  Scope
                </span>
                <div className="mt-1.5 min-h-[22px] flex items-center">
                  <span className="text-sm font-medium text-gray-900">
                    Full System Access
                  </span>
                </div>
              </div>
            </>
          )}

          {/* Row 3 */}
          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Department
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm text-gray-800">
                {user.department || '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Joining Date
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm text-gray-800">
                {user.joining_date ? String(user.joining_date).slice(0, 10) : '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Last Login
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm text-gray-800">
                {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never logged in'}
              </span>
            </div>
          </div>

          {/* Row 4 */}
          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Account Created
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-mono text-gray-500">
                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              Account Status
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                  user.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {user.status === 'active' ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-start">
            <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider block">
              User ID
            </span>
            <div className="mt-1.5 min-h-[22px] flex items-center">
              <span className="text-sm font-mono text-gray-500">
                #{user.id}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Team Members List (If ASM) */}
      {isAsm && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span>Technical Executives Under Management ({teamMembers.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => setEditModalOpen(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
            >
              <span>Manage Team</span>
              <ExternalLink className="w-3 h-3 text-blue-500" />
            </button>
          </div>

          {teamMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No technical executives are currently assigned to this ASM.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Executive</th>
                    <th className="py-2.5 px-4">Contact</th>
                    <th className="py-2.5 px-4">Assigned Area</th>
                    <th className="py-2.5 px-4 text-center">Farmers</th>
                    <th className="py-2.5 px-4 text-center">Visits</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {teamMembers.map((exec) => (
                    <tr key={exec.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4">
                        <Link
                          to={`/users/${exec.id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition"
                        >
                          {exec.full_name}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-mono text-[11px]">
                        <div>{exec.mobile || '—'}</div>
                        <div className="text-gray-400 font-sans">{exec.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        {exec.area ? (
                          <span className="text-gray-800 font-medium inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            <span>{exec.area}</span>
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-800">
                        {exec.farmers_count || 0}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-gray-800">
                        {exec.visits_count || 0}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            exec.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {exec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/users/${exec.id}`}
                          className="btn-secondary !py-1 !px-2.5 text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
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
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              <span>Recent Field Visits {isAsm ? '(Team Activity)' : ''}</span>
            </h2>
            <Link
              to="/visits"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
            >
              <span>View All Visits</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentVisits.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No recent field visits recorded.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Farmer</th>
                    <th className="py-2.5 px-4">Location</th>
                    {isAsm && <th className="py-2.5 px-4">Technician</th>}
                    <th className="py-2.5 px-4">Visit Type</th>
                    <th className="py-2.5 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentVisits.map((v) => (
                    <tr key={v.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                        {v.visit_date}
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          to={`/clients/${v.client_id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition"
                        >
                          {v.farmer_name || 'Farmer'}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-500 truncate max-w-[140px]">
                        {[v.village, v.district].filter(Boolean).join(', ') || '—'}
                      </td>
                      {isAsm && (
                        <td className="py-3 px-4 text-gray-800 font-medium">
                          {v.technician_name || '—'}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span className="capitalize px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                          {v.visit_type?.replace(/_/g, ' ') || 'Routine'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/visits/${v.id}`}
                          className="btn-secondary !py-1 !px-2.5 text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
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
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-500" />
              <span>Farmers Assigned / Registered</span>
            </h2>
            <Link
              to="/clients"
              className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-1 hover:underline"
            >
              <span>View All Farmers</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {recentFarmers.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              <Building2 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p>No farmers assigned yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Farmer</th>
                    <th className="py-2.5 px-4">Phone</th>
                    <th className="py-2.5 px-4">Location</th>
                    {isAsm && <th className="py-2.5 px-4">Assigned Tech</th>}
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentFarmers.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50/70 transition">
                      <td className="py-3 px-4">
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
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-600">
                        {f.mobile || '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 truncate max-w-[140px]">
                        {[f.village, f.district].filter(Boolean).join(', ') || '—'}
                      </td>
                      {isAsm && (
                        <td className="py-3 px-4 text-gray-800 font-medium">
                          {f.assigned_to_name || '—'}
                        </td>
                      )}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                            f.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-gray-100 text-gray-700 border-gray-200'
                          }`}
                        >
                          {f.status || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          to={`/clients/${f.id}`}
                          className="btn-secondary !py-1 !px-2.5 text-xs font-medium text-gray-700 inline-flex items-center gap-1"
                        >
                          <span>Profile</span>
                          <ExternalLink className="w-3 h-3 text-gray-400" />
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
