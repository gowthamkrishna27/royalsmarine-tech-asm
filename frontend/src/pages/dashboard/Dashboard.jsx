import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import StatCard from '../../components/common/StatCard';
import {
  MapPinIcon, BellIcon, ChartBarIcon, CheckCircleIcon,
  ClockIcon, ExclamationTriangleIcon, CurrencyRupeeIcon, UsersIcon,
  BuildingOfficeIcon, CircleStackIcon, ArchiveBoxIcon, ScaleIcon,
  BriefcaseIcon, WrenchScrewdriverIcon,
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
                <Bar dataKey="value" radius={[4,4,0,0]}>
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

function ManagementDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard label="Total Farmers" value={data.total_farmers ?? 0} icon={BuildingOfficeIcon} color="blue" to="/clients" />
        <StatCard label="Total Tanks" value={data.total_tanks ?? 0} icon={CircleStackIcon} color="purple" to="/tanks" />
        <StatCard label="Active Tanks" value={data.active_tanks ?? 0} icon={CheckCircleIcon} color="green" to="/tanks?status=active" />
        <StatCard label="Harvested Tanks" value={data.harvested_tanks ?? 0} icon={ArchiveBoxIcon} color="yellow" to="/tanks?status=harvested" />
        <StatCard label="Average ABW" value={data.average_abw ? `${Number(data.average_abw).toFixed(1)} g` : '0 g'} icon={ScaleIcon} color="indigo" to="/tanks?view=abw" />
        <StatCard label="Total ASM's" value={data.total_asms ?? 0} icon={BriefcaseIcon} color="blue" to="/team/asms" />
        <StatCard label="Total Technical Executives" value={data.total_technical_executives ?? 0} icon={WrenchScrewdriverIcon} color="green" to="/team/technical-executives" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Brand-wise Pipeline</h3></div>
          <div className="p-4 space-y-3">
            {!data.brand_pipeline || data.brand_pipeline.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No brand pipeline recorded</p>
            ) : (
              data.brand_pipeline.slice(0, 8).map(b => (
                <div key={b.name} className="flex items-center justify-between py-1">
                  <span className="text-sm font-medium text-gray-700">{b.name || 'Untagged'}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-400">{b.count} opps</span>
                    <span className="text-sm font-semibold text-gray-900">₹{Number(b.value).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold text-gray-900">Technical Executive Performance</h3></div>
          <div className="p-4">
            {!data.salesperson_performance || data.salesperson_performance.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No performance records found</p>
            ) : (
              data.salesperson_performance.slice(0, 8).map(sp => (
                <div key={sp.full_name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{sp.full_name}</p>
                    <p className="text-xs text-gray-400">{sp.visits} visits · {sp.won_opps} won</p>
                  </div>
                  <span className="text-sm font-bold text-green-600">₹{Number(sp.won_value).toLocaleString('en-IN')}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
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
