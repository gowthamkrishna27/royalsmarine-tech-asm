import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, tankApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import StatCard from '../../components/common/StatCard';
import {
  MapPinIcon, BellIcon, ChartBarIcon, CheckCircleIcon,
  ClockIcon, ExclamationTriangleIcon, CurrencyRupeeIcon, UsersIcon,
  BuildingOfficeIcon, CircleStackIcon, ArchiveBoxIcon, ScaleIcon,
  BriefcaseIcon, WrenchScrewdriverIcon, FunnelIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Badge from '../../components/common/Badge';
import { OPPORTUNITY_STAGES } from '../../constants';
import { Link } from 'react-router-dom';

const STAGE_COLORS = { identification: '#94a3b8', qualified: '#3b82f6', evaluation: '#8b5cf6', quotation_sent: '#f59e0b', negotiation: '#f97316', finalization: '#6366f1', won: '#22c55e', lost: '#ef4444' };

function SalesExecDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Follow-ups" value={data.today_followups} icon={BellIcon} color="blue" />
        <StatCard label="Overdue Follow-ups" value={data.overdue_followups} icon={ExclamationTriangleIcon} color="red" />
        <StatCard label="Visits This Month" value={data.month_visits} icon={MapPinIcon} color="green" />
        <StatCard label="Pending Approvals" value={data.pending_visits} icon={ClockIcon} color="yellow" />
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Recent Visits</h3>
          <Link to="/visits" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="p-4">
          {!data.recent_visits || data.recent_visits.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No recent visits recorded</p>
          ) : (
            <div className="space-y-3">
              {data.recent_visits.map(v => (
                <div key={v.id} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{v.company_name}</p>
                    <p className="text-xs text-gray-400">{v.visit_date} · {v.city || 'Local'}</p>
                  </div>
                  <Badge color={v.approval_status === 'approved' ? 'green' : v.approval_status === 'rejected' ? 'red' : 'yellow'}>
                    {v.approval_status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManagerDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Approvals" value={data.pending_approvals} icon={ClockIcon} color="yellow" />
        <StatCard label="Overdue Follow-ups" value={data.overdue_followups} icon={ExclamationTriangleIcon} color="red" />
        <StatCard label="Pipeline Stages" value={data.pipeline?.length} icon={ChartBarIcon} color="blue" />
        <StatCard label="Team Members" value={data.team_visits?.length} icon={UsersIcon} color="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Team Visits This Month</h3></div>
          <div className="p-4">
            {data.team_visits?.map(t => (
              <div key={t.full_name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm font-medium text-gray-700">{t.full_name}</span>
                <Badge color={t.visit_count > 10 ? 'green' : t.visit_count > 5 ? 'blue' : 'gray'}>{t.visit_count} visits</Badge>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Pipeline Value by Stage</h3></div>
          <div className="p-4 h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.pipeline}>
                <XAxis dataKey="current_stage" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={v => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {data.pipeline?.map(p => <Cell key={p.current_stage} fill={STAGE_COLORS[p.current_stage] || '#3b82f6'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function DocTankExplorerSection() {
  const [docInput, setDocInput] = useState('');
  const [matchMode, setMatchMode] = useState('eq');
  const [statusFilter, setStatusFilter] = useState('');
  const docInputRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-tanks-by-doc', docInput, matchMode, statusFilter],
    queryFn: () => tankApi.list({
      doc: docInput ? parseInt(docInput, 10) : undefined,
      doc_op: matchMode,
      status: statusFilter || undefined,
      sort: 'doc_desc',
      limit: 50,
    }).then(r => r.data),
  });

  const tanks = data?.data || [];

  const handleSelectMode = (mode) => {
    setMatchMode(mode);
    if (!docInput) {
      docInputRef.current?.focus();
    }
  };

  const handlePreset = (val, mode) => {
    setDocInput(String(val));
    if (mode) setMatchMode(mode);
  };

  const handleReset = () => {
    setDocInput('');
    setMatchMode('eq');
    setStatusFilter('');
    docInputRef.current?.focus();
  };

  return (
    <div className="card shadow-sm border border-gray-200 overflow-hidden">
      <div className="card-header bg-gradient-to-r from-gray-50 to-blue-50/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border-b border-gray-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 text-base sm:text-lg">Tanks by DOC</h3>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
              {tanks.length} {tanks.length === 1 ? 'Tank' : 'Tanks'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5"></p>
        </div>
        <Link to="/tanks" className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition whitespace-nowrap flex items-center gap-1">
          View all tanks →
        </Link>
      </div>

      {/* Filter Controls Bar */}
      <div className="p-4 sm:p-5 border-b border-gray-100 bg-white space-y-3.5">
        <div className="flex flex-wrap items-center gap-3">
          {/* DOC Input Box */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 select-none">
              DOC:
            </span>
            <input
              ref={docInputRef}
              type="number"
              min="1"
              max="300"
              placeholder="Enter DOC (e.g. 45)..."
              value={docInput}
              onChange={(e) => setDocInput(e.target.value)}
              className="input pl-14 pr-8 h-10 w-full font-semibold text-gray-800 placeholder:font-normal placeholder:text-gray-400"
            />
            {docInput && (
              <button
                type="button"
                onClick={() => setDocInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-full"
                title="Clear DOC value"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Exact, Up to, At Least Segmented Pill Controls */}
          <div className="flex items-center rounded-lg border border-gray-300 bg-gray-50/80 p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => handleSelectMode('eq')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${matchMode === 'eq'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              title="Show tanks where DOC exactly equals this value"
            >
              <span className="font-mono font-bold text-[13px]">=</span>
              <span>Exact</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('lte')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${matchMode === 'lte'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              title="Show tanks where DOC is up to (less than or equal to) this value"
            >
              <span className="font-mono font-bold text-[13px]">≤</span>
              <span>Up to</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectMode('gte')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${matchMode === 'gte'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'text-gray-700 hover:text-gray-900 hover:bg-gray-200/60'
                }`}
              title="Show tanks where DOC is at least (greater than or equal to) this value"
            >
              <span className="font-mono font-bold text-[13px]">≥</span>
              <span>At Least</span>
            </button>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input h-10 w-36 flex-shrink-0 text-xs font-medium"
          >
            <option value="">All Status</option>
            <option value="active">Active Tanks</option>
            <option value="harvested">Harvested Tanks</option>
          </select>

          {/* Reset button */}
          {(docInput || statusFilter || matchMode !== 'eq') && (
            <button
              type="button"
              onClick={handleReset}
              className="btn-secondary h-10 px-3 text-xs flex items-center gap-1 text-gray-600 hover:text-gray-900"
              title="Reset Filters"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Quick Presets & Real-time Status Explanation */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-gray-400 font-medium mr-1 flex items-center gap-1">
              <FunnelIcon className="w-3.5 h-3.5" /> Quick DOC:
            </span>
            {[30, 45, 60, 75, 90, 110].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handlePreset(val)}
                className={`px-2 py-0.5 rounded text-xs transition border ${docInput === String(val)
                  ? 'bg-blue-50 border-blue-400 text-blue-700 font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
              >
                DOC {val}
              </button>
            ))}
            {docInput && (
              <button
                type="button"
                onClick={() => setDocInput('')}
                className="px-2 py-0.5 rounded text-xs text-blue-600 hover:underline"
              >
                Clear DOC
              </button>
            )}
          </div>

          {/* Dynamic Descriptive Feedback */}
          <div className="text-gray-500 font-medium flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500"></span>
            {docInput ? (
              <span>
                Filtering: <strong className="text-gray-800">
                  {matchMode === 'eq' ? `Exact DOC = ${docInput}` : matchMode === 'lte' ? `DOC Up to ≤ ${docInput}` : `DOC At Least ≥ ${docInput}`}
                </strong>
                {' '}
              </span>
            ) : (
              <span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Results Table */}
      {isLoading ? (
        <div className="p-10 flex justify-center"><PageSpinner /></div>
      ) : tanks.length === 0 ? (
        <div className="p-10 text-center">
          <CircleStackIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-700">
            {docInput
              ? `No tanks found with DOC ${matchMode === 'lte' ? '≤ ' : matchMode === 'gte' ? '≥ ' : '= '}${docInput}`
              : 'No tanks found matching the current filters'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Try switching between "Exact", "Up to", or "At Least", or enter another DOC value.
          </p>
          <button onClick={handleReset} className="btn-secondary btn-sm mt-3">Reset Filters</button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th className="w-24">
                  <div className="flex items-center gap-1">
                    <span>DOC</span>
                    <span className="text-[10px] text-blue-600 font-bold" title="Sorted descending">↓ desc</span>
                  </div>
                </th>
                <th>Tank Details</th>
                <th>Farmer Details</th>
                <th>Status</th>
                <th>ABW</th>
                <th>Culture & Seed</th>
                <th>Salinity</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tanks.map((t, idx) => {
                const docVal = Number(t.doc) || 0;
                const docBadgeColor =
                  docVal >= 90
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : docVal >= 50
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300';

                return (
                  <tr key={t.id || idx} className="hover:bg-blue-50/40 transition">
                    <td className="whitespace-nowrap">
                      <span className={`inline-flex items-center justify-center font-bold px-2.5 py-1 text-xs rounded-lg border shadow-xs ${docBadgeColor}`}>
                        DOC {t.doc ?? '—'}
                      </span>
                    </td>
                    <td>
                      <p className="font-bold text-gray-900">{t.tank_name || t.tank_number || 'Tank'}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        {t.tank_number && t.tank_number !== t.tank_name && <span>#{t.tank_number}</span>}
                        {t.size_acres && <span>{t.size_acres} Acres</span>}
                      </div>
                    </td>
                    <td>
                      <Link
                        to={t.farmer_id ? `/clients/${t.farmer_id}` : '/clients'}
                        className="font-semibold text-gray-900 hover:text-blue-600 transition"
                      >
                        {t.farmer_name || 'Farmer'}
                      </Link>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {t.farmer_mobile && <span>{t.farmer_mobile} · </span>}
                        {[t.village, t.city, t.state].filter(Boolean).join(', ') || 'Local'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge color={t.status === 'active' ? 'green' : t.status === 'harvested' ? 'yellow' : 'gray'}>
                        {t.status || 'Active'}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap">
                      {t.abw && Number(t.abw) > 0 ? (
                        <div>
                          <span className="font-bold text-gray-900">{Number(t.abw).toFixed(1)} g</span>
                          <span className="block text-[11px] text-gray-400">body weight</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td>
                      <p className="text-xs font-medium text-gray-700 capitalize">{t.culture_type || 'Shrimp'}</p>
                      <p className="text-[11px] text-gray-400">
                        {t.seed_date ? `Stocked: ${t.seed_date}` : t.feed_type ? `Feed: ${t.feed_type}` : '—'}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-gray-600">
                      {t.salinity ? `${t.salinity} ppt` : '—'}
                    </td>
                    <td className="whitespace-nowrap">
                      <Link
                        to={t.farmer_id ? `/clients/${t.farmer_id}` : '/clients'}
                        className="btn-secondary btn-sm text-xs hover:border-blue-400 hover:text-blue-600"
                      >
                        View Farmer →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ManagementDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard label="Total Farmers" value={data.total_farmers ?? 0} icon={BuildingOfficeIcon} color="blue" to="/clients" />
        <StatCard label="Total Tanks" value={data.total_tanks ?? 0} icon={CircleStackIcon} color="purple" to="/tanks" />
        <StatCard label="Active Tanks" value={data.active_tanks ?? 0} icon={CheckCircleIcon} color="green" to="/tanks?status=active" />
        <StatCard label="Harvested Tanks" value={data.harvested_tanks ?? 0} icon={ArchiveBoxIcon} color="yellow" to="/tanks?status=harvested" />
        <StatCard label="Active Farmers" value={data.active_farmers ?? 0} icon={UsersIcon} color="green" to="/clients?status=active" />
        <StatCard label="Total ASM's" value={data.total_asms ?? 0} icon={BriefcaseIcon} color="blue" to="/team/asms" />
        <StatCard label="Total Technical Executives" value={data.total_technical_executives ?? 0} icon={WrenchScrewdriverIcon} color="green" to="/team/technical-executives" />
      </div>

      <DocTankExplorerSection />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => dashboardApi.get().then(r => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  const role = user?.role;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.full_name}</p>
        </div>
      </div>

      {(role === 'sales_executive') && data && <SalesExecDashboard data={data} />}
      {(role === 'sales_manager') && data && <ManagerDashboard data={data} />}
      {(['management', 'super_admin', 'admin'].includes(role)) && data && <ManagementDashboard data={data} />}
      {role === 'backend_ops' && data && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Pending Quotations" value={data.pending_quotations} icon={ChartBarIcon} color="blue" />
          <StatCard label="Pending POs" value={data.pending_pos} icon={ClockIcon} color="yellow" />
          <StatCard label="Unmatched Billing" value={data.unmatched_billing} icon={ExclamationTriangleIcon} color="red" />
        </div>
      )}
    </div>
  );
}
