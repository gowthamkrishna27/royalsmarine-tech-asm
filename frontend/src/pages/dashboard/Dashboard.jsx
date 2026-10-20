import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../services/api';
import { PageSpinner } from '../../components/common/Spinner';
import StatCard from '../../components/common/StatCard';
import {
  ClockIcon, BuildingOfficeIcon, DocumentTextIcon, ChartBarIcon,
} from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

function DashboardStatCards({ data }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <StatCard
        label="Total Farmers"
        value={data.total_farmers ?? 0}
        icon={BuildingOfficeIcon}
        color="blue"
        to="/clients"
      />
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
  return (
    <div className="fade-in space-y-6">
      <DashboardStatCards data={data} />
      <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />
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
      {(['management', 'super_admin', 'admin', 'backend_ops'].includes(role)) && data && <ManagementDashboard data={data} />}
    </div>
  );
}
