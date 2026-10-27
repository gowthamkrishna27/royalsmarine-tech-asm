import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, userApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import StatCard from '../../components/common/StatCard';
import {
  ClockIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  UsersIcon,
  CheckCircleIcon,
  XCircleIcon,
  CircleStackIcon,
  ArchiveBoxArrowDownIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';

function DashboardStatCards({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {/* Row 1: Farmers */}
      <StatCard
        label="Total Farmers"
        value={data.total_farmers ?? 0}
        icon={BuildingOfficeIcon}
        color="blue"
        to="/clients"
      />
      <StatCard
        label="Active Farmers"
        value={data.active_farmers ?? 0}
        icon={CheckCircleIcon}
        color="emerald"
        to="/clients"
      />
      <StatCard
        label="Inactive Farmers"
        value={data.inactive_farmers ?? 0}
        icon={XCircleIcon}
        color="gray"
        to="/clients"
      />

      {/* Row 2: Tanks */}
      <StatCard
        label="Total Tanks"
        value={data.total_tanks ?? 0}
        icon={CircleStackIcon}
        color="indigo"
        to="/clients"
      />
      <StatCard
        label="Active Tanks"
        value={data.active_tanks ?? 0}
        icon={CheckCircleIcon}
        color="emerald"
        to="/clients"
      />
      <StatCard
        label="Harvested Tanks"
        value={data.harvested_tanks ?? data.inactive_tanks ?? 0}
        icon={ArchiveBoxArrowDownIcon}
        color="amber"
        to="/harvested-tanks"
      />

      {/* Row 3: Submissions & Operations */}
      <StatCard
        label="Total Submissions"
        value={data.total_submissions ?? 0}
        icon={DocumentTextIcon}
        color="emerald"
        to="/visits"
      />
      <StatCard
        label="Due Follow-ups"
        value={data.due_followups ?? 0}
        icon={ClockIcon}
        color="amber"
        to="/followups"
      />
      <StatCard
        label="Forcely Closed Farmer"
        value={data.forcely_closed_farmers ?? 0}
        icon={NoSymbolIcon}
        color="amber"
        to="/clients?status=forcely_closed"
      />
    </div>
  );
}

function VisitLogsCard({ visits, showSalesperson = false }) {
  const displayVisits = (visits || []).slice(0, 5);

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Visit Logs</h3>
        <Link to="/visits" className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline">
          View all
        </Link>
      </div>

      <div className="p-4">
        {displayVisits.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No visit logs recorded</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {displayVisits.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 hover:bg-gray-50/60 rounded-md px-2 -mx-2 transition-colors"
              >
                <div className="min-w-0 pr-3">
                  <Link
                    to={`/visits/${v.id}`}
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate block"
                  >
                    {v.company_name}
                  </Link>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {v.visit_date}
                    {showSalesperson && v.salesperson_name ? ` · ${v.salesperson_name}` : ''}
                    {v.city ? ` · ${v.city}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/visits/${v.id}`}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SalesExecDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <DashboardStatCards data={data} />
      <VisitLogsCard visits={data.recent_visits} showSalesperson={false} />
    </div>
  );
}

function ManagerDashboard({ data }) {
  return (
    <div className="fade-in space-y-6">
      <DashboardStatCards data={data} />
      <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />
    </div>
  );
}

function ManagementDashboard({ data }) {
  // Query users to integrate admin features directly into minimal stat cards
  const { data: users } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => userApi.list({}).then((r) => r.data.data),
    staleTime: 60000,
  });

  const techExecs = (users || []).filter((u) => u.role === 'sales_executive');
  const areaManagers = (users || []).filter((u) => u.role === 'sales_manager');

  return (
    <div className="fade-in space-y-6">
      {/* Minimal Stat Cards Grid (Clean 3-column rows) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Row 1: Farmers */}
        <StatCard
          label="Total Farmers"
          value={data.total_farmers ?? 0}
          icon={BuildingOfficeIcon}
          color="blue"
          to="/clients"
        />
        <StatCard
          label="Active Farmers"
          value={data.active_farmers ?? 0}
          icon={CheckCircleIcon}
          color="emerald"
          to="/clients"
        />
        <StatCard
          label="Inactive Farmers"
          value={data.inactive_farmers ?? 0}
          icon={XCircleIcon}
          color="gray"
          to="/clients"
        />

        {/* Row 2: Tanks */}
        <StatCard
          label="Total Tanks"
          value={data.total_tanks ?? 0}
          icon={CircleStackIcon}
          color="indigo"
          to="/clients"
        />
        <StatCard
          label="Active Tanks"
          value={data.active_tanks ?? 0}
          icon={CheckCircleIcon}
          color="emerald"
          to="/clients"
        />
        <StatCard
        label="Harvested Tanks"
        value={data.harvested_tanks ?? data.inactive_tanks ?? 0}
        icon={ArchiveBoxArrowDownIcon}
        color="amber"
        to="/harvested-tanks"
      />

        {/* Row 3: Submissions & Operations */}
        <StatCard
          label="Total Submissions"
          value={data.total_submissions ?? 0}
          icon={DocumentTextIcon}
          color="emerald"
          to="/visits"
        />
        <StatCard
          label="Due Follow-ups"
          value={data.due_followups ?? 0}
          icon={ClockIcon}
          color="amber"
          to="/followups"
        />
        <StatCard
          label="Field Executives"
          value={techExecs.length}
          icon={UsersIcon}
          color="indigo"
          to="/users"
        />

        {/* Row 4: Management & Leadership */}
        <StatCard
          label="Area Managers"
          value={areaManagers.length}
          icon={UsersIcon}
          color="purple"
          to="/users"
        />
        <StatCard
          label="Forcely Closed Farmer"
          value={data.forcely_closed_farmers ?? 0}
          icon={NoSymbolIcon}
          color="amber"
          to="/clients?status=forcely_closed"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />
        </div>

        {/* Salesperson Performance */}
        {data.salesperson_performance && data.salesperson_performance.length > 0 && (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Technical Executive Performance</h3>
              <Link to="/reports" className="text-xs font-medium text-blue-600 hover:underline">
                Full report
              </Link>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {data.salesperson_performance.slice(0, 5).map((sp, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm py-1">
                    <span className="font-medium text-gray-800 truncate">{sp.full_name}</span>
                    <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                      {sp.visits} visits
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => dashboardApi.get().then((r) => r.data.data),
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

      {role === 'sales_executive' && data && <SalesExecDashboard data={data} />}
      {role === 'sales_manager' && data && <ManagerDashboard data={data} />}
      {['management', 'super_admin', 'admin', 'backend_ops'].includes(role) && data && (
        <ManagementDashboard data={data} />
      )}
    </div>
  );
}
