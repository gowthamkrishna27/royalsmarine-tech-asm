import { useState } from 'react';
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
  PhoneIcon,
  MapPinIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  UserIcon,
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

function FarmersModal({ type, farmers, totalCount, searchTerm, onSearchChange, onClose }) {
  const isMyFarmers = type === 'my_farmers';
  const title = isMyFarmers ? 'My Farmers' : 'Farmers (Technical Executives)';
  const subtitle = isMyFarmers
    ? 'Farmers directly under the Area Sales Manager (ASM)'
    : 'Details of farmers managed by technical executives reporting to you';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/70">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h2>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isMyFarmers ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {farmers.length} of {totalCount} {farmers.length === 1 ? 'farmer' : 'farmers'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isMyFarmers ? "Search by farmer name, village, mobile..." : "Search by farmer, village, technical executive..."}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Farmers List (Responsive on Mobile) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {farmers.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <BuildingOfficeIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600">No farmers found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm ? 'Try adjusting your search query.' : 'There are no farmers currently listed in this category.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {farmers.map((f) => {
                const cleanPhone = (f.mobile || '').replace(/\D/g, '');
                const execPhone = (f.executive_mobile || '').replace(/\D/g, '');

                return (
                  <div
                    key={f.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-gray-200/90 bg-white hover:border-blue-300 hover:shadow-sm transition flex flex-col justify-between gap-3"
                  >
                    <div>
                      {/* Farmer Name & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/clients/${f.id}`}
                          className="font-bold text-gray-900 hover:text-blue-600 text-sm sm:text-base leading-snug line-clamp-1"
                        >
                          {f.company_name}
                        </Link>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
                          f.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {f.status || 'Active'}
                        </span>
                      </div>

                      {/* Technical Executive details if looking at technical executives' farmers */}
                      {!isMyFarmers && (
                        <div className="mt-2 p-2 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <UserIcon className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="text-gray-500 font-medium">Tech Exec:</span>
                            <span className="font-bold text-gray-900 truncate">
                              {f.executive_name || 'Unassigned'}
                            </span>
                          </div>
                          {execPhone && (
                            <a
                              href={`https://api.whatsapp.com/send?phone=91${execPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-800 shrink-0 inline-flex items-center gap-0.5 font-semibold text-[11px]"
                              title="Chat with Tech Executive"
                            >
                              <PhoneIcon className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Location & Farm Size */}
                      <div className="mt-2.5 flex items-center gap-2 text-xs text-gray-600 flex-wrap">
                        {(f.village || f.city) && (
                          <span className="inline-flex items-center gap-1 text-gray-700 font-medium">
                            <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span>{[f.village, f.city].filter(Boolean).join(', ')}</span>
                          </span>
                        )}
                        <span>•</span>
                        <span className="font-semibold text-gray-800">
                          {f.number_of_tanks ? `${f.number_of_tanks} Tanks` : 'Tanks N/A'}
                        </span>
                        {f.farm_extent_acres && (
                          <>
                            <span>•</span>
                            <span>{f.farm_extent_acres} Ac</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Footer Contact & Action Buttons */}
                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                      {cleanPhone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-semibold"
                          >
                            <PhoneIcon className="w-3.5 h-3.5 text-blue-600" />
                            <span>{f.mobile}</span>
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?phone=91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200"
                          >
                            WhatsApp
                          </a>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">No mobile</span>
                      )}

                      <Link
                        to={`/clients/${f.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
                      >
                        <span>Details</span>
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/70">
          <Link
            to={isMyFarmers ? "/clients?scope=my_farmers" : "/clients?scope=tech_exec_farmers"}
            className="text-xs font-semibold text-blue-600 hover:underline flex items-center gap-1"
          >
            <span>Open in Full Farmers List</span>
            <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm text-xs py-1.5 px-4"
          >
            Close
          </button>
        </div>
      </div>
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
  const [modalType, setModalType] = useState(null); // 'my_farmers' | 'tech_exec_farmers' | null
  const [searchTerm, setSearchTerm] = useState('');

  const farmersList = modalType === 'my_farmers'
    ? (data.my_farmers_list || [])
    : (data.tech_exec_farmers_list || []);

  const filteredFarmers = farmersList.filter((f) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const nameMatch = f.company_name?.toLowerCase().includes(q) || f.contact_person?.toLowerCase().includes(q);
    const locMatch = f.city?.toLowerCase().includes(q) || f.village?.toLowerCase().includes(q);
    const phoneMatch = f.mobile?.includes(q);
    const execMatch = f.executive_name?.toLowerCase().includes(q);
    return nameMatch || locMatch || phoneMatch || execMatch;
  });

  return (
    <div className="fade-in space-y-6">
      {/* ASM Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Farmers */}
        <StatCard
          label="Total Farmers"
          value={data.total_farmers ?? 0}
          icon={BuildingOfficeIcon}
          color="blue"
          to="/clients"
        />
        <StatCard
          label="My Farmers"
          value={data.my_farmers ?? 0}
          icon={CheckCircleIcon}
          color="emerald"
          onClick={() => {
            setSearchTerm('');
            setModalType('my_farmers');
          }}
        />
        <StatCard
          label="Farmers"
          value={data.tech_exec_farmers ?? 0}
          icon={UsersIcon}
          color="indigo"
          onClick={() => {
            setSearchTerm('');
            setModalType('tech_exec_farmers');
          }}
        />
      </div>

      <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />

      {/* Responsive Farmers Modal for My Farmers / Technical Executive Farmers */}
      {modalType && (
        <FarmersModal
          type={modalType}
          farmers={filteredFarmers}
          totalCount={farmersList.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
}

function ManagementDashboard({ data }) {
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

      {/* Grid: Recent Visits & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />

        {data.salesperson_performance && (
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
