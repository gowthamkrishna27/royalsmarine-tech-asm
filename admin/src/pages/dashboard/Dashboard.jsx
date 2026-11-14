import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, userApi } from '../../services/api';
import { clientService } from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import StatCard from '../../components/common/StatCard';
import { TankDetailModal } from '../tanks/HarvestedTanks';
import {
  ClockIcon,
  BuildingOfficeIcon,
  DocumentTextIcon,
  UsersIcon,
  BuildingStorefrontIcon,
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
  UserGroupIcon,
  ScaleIcon,
  BeakerIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';

function DashboardStatCards({ data }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <StatCard
        label="My Farmers"
        value={data.total_farmers ?? 0}
        sub={`${data.active_farmers ?? 0} active`}
        icon={BuildingOfficeIcon}
        color="blue"
        to="/clients"
      />
      <StatCard
        label="Tanks"
        value={data.total_tanks ?? 0}
        sub={`${data.active_tanks ?? 0} active`}
        icon={CircleStackIcon}
        color="indigo"
        to="/clients"
      />
      <StatCard
        label="Visits Logged"
        value={data.total_submissions ?? 0}
        sub={`${data.month_visits ?? 0} this month`}
        icon={DocumentTextIcon}
        color="emerald"
        to="/visits"
      />
      <StatCard
        label="Due Follow-ups"
        value={data.due_followups ?? 0}
        sub={data.today_followups ? `${data.today_followups} today` : 'Pending'}
        icon={ClockIcon}
        color="amber"
        to="/followups"
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-gray-50/90 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gray-50/80 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">{title}</h2>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isMyFarmers ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                {farmers.length} of {totalCount} {farmers.length === 1 ? 'farmer' : 'farmers'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={isMyFarmers ? "Search by farmer, village, mobile..." : "Search by farmer, village, technical executive..."}
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

        {/* Modal Body / Farmers List */}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-3.5">
              {farmers.map((f) => {
                const cleanPhone = (f.mobile || '').replace(/\D/g, '');
                const execPhone = (f.executive_mobile || '').replace(/\D/g, '');

                return (
                  <div
                    key={f.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-gray-200/80 bg-white hover:border-blue-300 hover:shadow-sm transition flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2.5">
                      {/* Farmer Name & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/clients/${f.id}`}
                          className="font-bold text-gray-900 hover:text-blue-600 text-sm sm:text-base leading-snug line-clamp-1"
                        >
                          {f.company_name}
                        </Link>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${f.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                          {f.status || 'Active'}
                        </span>
                      </div>

                      {/* Technical Executive banner */}
                      {!isMyFarmers && (
                        <div className="p-2 bg-blue-50/60 border border-blue-100 rounded-lg text-xs flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                              TE
                            </span>
                            <span className="text-gray-500 font-medium">Tech Exec:</span>
                            <span className="font-semibold text-gray-900 truncate">
                              {f.executive_name || 'Unassigned'}
                            </span>
                          </div>
                          {execPhone && (
                            <a
                              href={`https://api.whatsapp.com/send?phone=91${execPhone}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 hover:text-emerald-800 shrink-0 inline-flex items-center gap-1 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200"
                              title="Chat with Technical Executive"
                            >
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      )}

                      {/* Location & Farm Size badges */}
                      <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-gray-600 flex-wrap">
                        {(f.village || f.city) && (
                          <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 font-medium text-gray-700">
                            <MapPinIcon className="w-3 h-3 text-gray-400 shrink-0" />
                            <span>{[f.village, f.city].filter(Boolean).join(', ')}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-semibold text-blue-700">
                          {f.number_of_tanks ? `${f.number_of_tanks} Tanks` : 'Tanks N/A'}
                        </span>
                        {f.farm_extent_acres && (
                          <span className="inline-flex items-center gap-1 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100 text-gray-600">
                            {f.farm_extent_acres} Ac
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Footer Contact & Action Buttons */}
                    <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
                      {cleanPhone ? (
                        <div className="flex items-center gap-2">
                          <a
                            href={`tel:${cleanPhone}`}
                            className="inline-flex items-center gap-1 text-gray-700 hover:text-blue-600 font-mono font-medium"
                          >
                            <PhoneIcon className="w-3.5 h-3.5 text-gray-400" />
                            <span>{f.mobile}</span>
                          </a>
                          <a
                            href={`https://api.whatsapp.com/send?phone=91${cleanPhone}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold border border-emerald-200 text-[11px]"
                          >
                            <span>WhatsApp</span>
                          </a>
                        </div>
                      ) : (
                        <span className="text-gray-400">No mobile</span>
                      )}

                      <Link
                        to={`/clients/${f.id}`}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-semibold text-xs ml-auto"
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
        <div className="px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/80 shrink-0">
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
            className="btn-secondary btn-sm text-xs py-1.5 px-4 rounded-xl"
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

function TechsModal({ techs, totalCount, searchTerm, onSearchChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 max-w-4xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-gray-50/90 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-purple-50/60 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">My Technical Executives</h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                {techs.length} of {totalCount} {techs.length === 1 ? 'executive' : 'executives'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">Technical executives reporting directly to you</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by name, area, mobile, or email..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition"
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

        {/* Modal Body / Techs List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3">
          {techs.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <UsersIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600">No technical executives found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm ? 'Try adjusting your search query.' : 'There are no technical executives currently reporting to you.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {techs.map((tech) => {
                const cleanPhone = (tech.mobile || '').replace(/\D/g, '');
                return (
                  <div
                    key={tech.id}
                    className="p-4 rounded-xl border border-gray-200/90 bg-white hover:border-purple-300 hover:shadow-md transition flex flex-col justify-between gap-3.5"
                  >
                    <div>
                      {/* Name & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-sm">
                            {tech.full_name?.[0]?.toUpperCase() || 'T'}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{tech.full_name}</h3>
                            {tech.area ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100 mt-0.5">
                                <MapPinIcon className="w-3 h-3 text-emerald-600 shrink-0" />
                                {tech.area}
                              </span>
                            ) : (
                              <span className="text-[11px] text-gray-400 italic">No assigned area</span>
                            )}
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${tech.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {tech.status || 'active'}
                        </span>
                      </div>

                      {/* Contact Info */}
                      <div className="mt-3 space-y-1.5 text-xs bg-gray-50/80 p-2.5 rounded-lg border border-gray-100">
                        {tech.mobile && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500 flex items-center gap-1">
                              <PhoneIcon className="w-3.5 h-3.5 text-gray-400" /> Phone:
                            </span>
                            <a
                              href={`tel:${cleanPhone}`}
                              className="font-mono text-blue-600 hover:underline font-medium"
                            >
                              {tech.mobile}
                            </a>
                          </div>
                        )}
                        {tech.email && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-500 shrink-0">Email:</span>
                            <a
                              href={`mailto:${tech.email}`}
                              className="text-gray-700 hover:text-blue-600 truncate"
                              title={tech.email}
                            >
                              {tech.email}
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Work Metrics Strip */}
                      <div className="grid grid-cols-2 gap-2 mt-3 pt-2 border-t border-gray-100 text-xs">
                        <div className="bg-blue-50/70 p-2 rounded-lg border border-blue-100/60">
                          <span className="text-gray-500 block text-[10px] font-medium">Assigned Farmers</span>
                          <span className="text-sm font-bold text-blue-700">{tech.total_farmers ?? 0}</span>
                          {tech.active_farmers !== undefined && (
                            <span className="text-[10px] text-gray-500 ml-1">({tech.active_farmers} active)</span>
                          )}
                        </div>
                        <div className="bg-indigo-50/70 p-2 rounded-lg border border-indigo-100/60">
                          <span className="text-gray-500 block text-[10px] font-medium">Visits Logged</span>
                          <span className="text-sm font-bold text-indigo-700">{tech.total_visits ?? 0}</span>
                          <span className="text-[10px] text-gray-500 ml-1">({tech.monthly_visits ?? 0} this mo.)</span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Info */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                      <span>Joined: {tech.joining_date ? new Date(tech.joining_date).toLocaleDateString() : 'N/A'}</span>
                      <span>Last Login: {tech.last_login ? new Date(tech.last_login).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-gray-50/80 border-t border-gray-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function HarvestedTanksModal({ onClose }) {
  const [activeFilter, setActiveFilter] = useState('partial'); // 'partial' | 'final'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTankForDetail, setSelectedTankForDetail] = useState(null);

  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['admin-harvested-tanks'],
    queryFn: () => clientService.getHarvestedTanks().then((r) => r.data.data || []),
  });

  const partialTanks = useMemo(() => {
    return tanks.filter((t) => {
      const partials = t.harvest_info?.partial_harvests;
      return t.has_partial_harvest || (Array.isArray(partials) && partials.length > 0);
    });
  }, [tanks]);

  const finalTanks = useMemo(() => {
    return tanks.filter((t) => {
      const finalH = t.harvest_info?.final_harvest;
      const hasFinalData = finalH && typeof finalH === 'object' && Object.values(finalH).some(Boolean);
      return t.has_final_harvest || hasFinalData || t.status === 'harvested';
    });
  }, [tanks]);

  const activeList = activeFilter === 'partial' ? partialTanks : finalTanks;

  const filteredTanks = useMemo(() => {
    if (!searchTerm.trim()) return activeList;
    const q = searchTerm.toLowerCase();
    return activeList.filter((t) => {
      const tankName = (t.tank_number || t.pond_name || '').toLowerCase();
      const farmer = (t.company_name || '').toLowerCase();
      const contact = (t.contact_person || '').toLowerCase();
      const phone = (t.farmer_phone || '').toLowerCase();
      const village = (t.village || '').toLowerCase();
      const district = (t.district || '').toLowerCase();
      const exec = (t.salesperson_name || '').toLowerCase();
      return (
        tankName.includes(q) ||
        farmer.includes(q) ||
        contact.includes(q) ||
        phone.includes(q) ||
        village.includes(q) ||
        district.includes(q) ||
        exec.includes(q)
      );
    });
  }, [activeList, searchTerm]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-gray-100 max-w-5xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Pull Bar */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-gray-50/90 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-amber-50/80 via-white to-gray-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
              <ArchiveBoxArrowDownIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">Harvested Tanks</h2>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate"></p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* The Two Filters: Partial and Final + Search */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveFilter('partial')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${activeFilter === 'partial'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span>Partial</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeFilter === 'partial' ? 'bg-gray-100 text-gray-700' : 'text-gray-400'
                  }`}>
                  {partialTanks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveFilter('final')}
                className={`px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition flex items-center gap-1.5 ${activeFilter === 'final'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                <span>Final</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${activeFilter === 'final' ? 'bg-gray-100 text-gray-700' : 'text-gray-400'
                  }`}>
                  {finalTanks.length}
                </span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={`Search ${activeFilter} harvested tanks by farmer, tank #, phone, village, tech exec...`}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Modal Body / Tanks List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5">
          {isLoading ? (
            <div className="py-16 text-center">
              <PageSpinner />
              <p className="text-sm text-gray-500 mt-3">Loading harvested tanks...</p>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-red-600 bg-red-50 border border-red-200 rounded-2xl">
              <p className="font-semibold">Failed to load harvested tanks</p>
              <p className="text-xs mt-1 text-gray-600">{error.message}</p>
              <button
                type="button"
                onClick={() => refetch()}
                className="btn-secondary btn-sm mt-3"
              >
                Retry
              </button>
            </div>
          ) : filteredTanks.length === 0 ? (
            <div className="py-14 text-center text-gray-400">
              <ArchiveBoxArrowDownIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <h3 className="font-bold text-gray-700 text-base">
                {activeFilter === 'partial'
                  ? 'No Partial Harvested Tanks Found'
                  : 'No Final Harvested Tanks Found'}
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                {searchTerm
                  ? 'No results matched your search query. Try clearing the search filter.'
                  : activeFilter === 'partial'
                    ? 'No tanks currently have partial harvest logs recorded.'
                    : 'No tanks currently have final harvest records logged.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
              {filteredTanks.map((tank) => {
                const finalH = tank.harvest_info?.final_harvest || null;
                const partials = Array.isArray(tank.harvest_info?.partial_harvests)
                  ? tank.harvest_info.partial_harvests
                  : [];

                return (
                  <div
                    key={tank.id}
                    className={`p-4 rounded-2xl border transition flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md ${activeFilter === 'partial'
                      ? 'border-amber-200/80 bg-white hover:border-amber-300'
                      : 'border-emerald-200/80 bg-white hover:border-emerald-300'
                      }`}
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm sm:text-base">
                            {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${activeFilter === 'partial'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}>
                            {activeFilter === 'partial' ? 'Partial Harvest' : 'Final Harvest'}
                          </span>
                        </div>
                        <Link
                          to={`/clients/${tank.client_id}`}
                          className="text-xs font-semibold text-primary-700 hover:underline mt-0.5 block"
                        >
                          {tank.company_name || 'Unknown Farmer'}
                        </Link>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-gray-900 font-mono">
                          {Number(tank.area_acres || tank.area || 0).toFixed(2)}
                        </span>
                        <span className="text-[10px] text-gray-500 block -mt-0.5">Acres</span>
                      </div>
                    </div>

                    {/* Farmer & Location Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50/70 p-2.5 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <PhoneIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        {tank.farmer_phone ? (
                          <a href={`tel:${tank.farmer_phone}`} className="hover:underline font-mono text-gray-800">
                            {tank.farmer_phone}
                          </a>
                        ) : (
                          <span className="text-gray-400">No phone</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <span className="truncate">
                          {[tank.village, tank.mandal, tank.district].filter(Boolean).join(', ') || 'Location unrecorded'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <BeakerIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span className="truncate">
                          Species: <strong className="text-gray-800 font-medium">{tank.culture_type || 'Shrimp / Vannamei'}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-500">
                        <UserIcon className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="truncate">
                          Tech: <strong className="text-gray-800 font-medium">{tank.salesperson_name || 'Unassigned'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* DETAILS: PARTIAL HARVEST */}
                    {activeFilter === 'partial' ? (
                      <div className="bg-gradient-to-br from-amber-50/60 to-white border border-amber-200/90 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                            <ScaleIcon className="w-4 h-4 text-amber-700" />
                            Partial Harvest Sessions ({partials.length})
                          </span>
                          {partials.length > 0 && (
                            <span className="text-[11px] font-semibold text-amber-800">
                              Total: {partials.reduce((sum, p) => sum + (parseFloat(p.harvested_biomass || p.biomass || 0) || 0), 0).toLocaleString()} kg
                            </span>
                          )}
                        </div>

                        {partials.length === 0 ? (
                          <div className="text-xs text-gray-500 italic py-2 text-center bg-white/60 rounded-lg border border-dashed border-amber-200">
                            Partial harvest recorded without itemized visit logs.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                            {partials.map((p, idx) => (
                              <div key={idx} className="bg-white rounded-lg p-2.5 border border-amber-100 shadow-2xs space-y-1.5">
                                <div className="flex items-center justify-between text-[11px] border-b border-gray-100 pb-1">
                                  <span className="font-bold text-amber-950">
                                    Harvest #{idx + 1} {p.date ? `• ${p.date}` : ''}
                                  </span>
                                  {p.reason && (
                                    <span className="text-[10px] text-gray-500 italic truncate max-w-[150px]">
                                      {p.reason}
                                    </span>
                                  )}
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 text-center text-xs">
                                  <div className="bg-amber-50/50 p-1 rounded">
                                    <span className="text-[10px] text-gray-500 block">DOC</span>
                                    <span className="font-bold text-gray-900">{p.doc || '-'}</span>
                                  </div>
                                  <div className="bg-amber-50/50 p-1 rounded">
                                    <span className="text-[10px] text-gray-500 block">ABW</span>
                                    <span className="font-bold text-gray-900">{p.abw ? `${p.abw}g` : '-'}</span>
                                  </div>
                                  <div className="bg-amber-50/50 p-1 rounded">
                                    <span className="text-[10px] text-gray-500 block">Biomass</span>
                                    <span className="font-bold text-amber-800">
                                      {p.harvested_biomass || p.biomass ? `${p.harvested_biomass || p.biomass}kg` : '-'}
                                    </span>
                                  </div>
                                  <div className="bg-amber-50/50 p-1 rounded">
                                    <span className="text-[10px] text-gray-500 block">Count</span>
                                    <span className="font-bold text-gray-900">{p.count || '-'}</span>
                                  </div>
                                  <div className="bg-amber-50/50 p-1 rounded col-span-2 sm:col-span-1">
                                    <span className="text-[10px] text-gray-500 block">Survival</span>
                                    <span className="font-bold text-emerald-700">{p.survival_rate ? `${p.survival_rate}%` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* DETAILS: FINAL HARVEST */
                      <div className="bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 border border-emerald-200/90 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950 flex items-center gap-1.5">
                            <ScaleIcon className="w-4 h-4 text-emerald-700" />
                            Final Harvest Yield & Performance
                          </span>
                          {finalH?.date && (
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                              Date: {finalH.date}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">Final DOC</span>
                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                              {finalH?.doc || tank.doc || '-'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">Final ABW</span>
                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                              {finalH?.abw ? `${finalH.abw}g` : (tank.abw ? `${tank.abw}g` : '-')}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">Total Biomass</span>
                            <span className="font-bold text-emerald-800 text-xs sm:text-sm">
                              {finalH?.total_biomass || finalH?.harvested_biomass ? `${finalH.total_biomass || finalH.harvested_biomass}kg` : '-'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">Count/kg</span>
                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                              {finalH?.count || '-'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">FCR</span>
                            <span className="font-bold text-gray-900 text-xs sm:text-sm">
                              {finalH?.fcr || tank.fcr || '-'}
                            </span>
                          </div>
                          <div className="bg-white p-2 rounded-lg border border-emerald-100 shadow-2xs">
                            <span className="text-[10px] text-gray-500 block">Survival</span>
                            <span className="font-bold text-emerald-700 text-xs sm:text-sm">
                              {finalH?.survival_rate ? `${finalH.survival_rate}%` : '-'}
                            </span>
                          </div>
                        </div>

                        {(finalH?.remarks || tank.remarks) && (
                          <div className="bg-white/90 p-2 rounded-lg border border-emerald-100 text-[11px] text-gray-700">
                            <strong className="text-gray-900 font-semibold">Remarks: </strong>
                            <span>{finalH?.remarks || tank.remarks}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Footer */}
                    <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                      <Link
                        to={`/clients/${tank.client_id}`}
                        className="text-primary-600 hover:text-primary-800 font-medium hover:underline flex items-center gap-1"
                      >
                        <UserIcon className="w-3.5 h-3.5" />
                        <span>Farmer Profile</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setSelectedTankForDetail(tank)}
                        className="btn-primary btn-sm py-1 px-3 text-xs flex items-center gap-1 shadow-2xs"
                      >
                        <span>Full Pond Specs</span>
                        <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between">
          <Link
            to={`/harvested-tanks?type=${activeFilter}`}
            onClick={onClose}
            className="text-xs text-primary-600 hover:text-primary-800 font-semibold hover:underline flex items-center gap-1"
          >
            <span>Open Full Harvested Tanks Page →</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition shadow-xs"
          >
            Close
          </button>
        </div>
      </div>

      {/* Embedded Full Pond Specs Modal if requested */}
      {selectedTankForDetail && (
        <TankDetailModal
          tank={selectedTankForDetail}
          onClose={() => setSelectedTankForDetail(null)}
        />
      )}
    </div>
  );
}

function ManagerDashboard({ data }) {
  const [modalType, setModalType] = useState(null); // 'my_farmers' | 'tech_exec_farmers' | 'my_techs' | null
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

  const techsList = data.my_techs || [];
  const filteredTechs = techsList.filter((t) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      t.full_name?.toLowerCase().includes(q) ||
      t.email?.toLowerCase().includes(q) ||
      t.mobile?.includes(q) ||
      t.area?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fade-in space-y-6">
      {/* ASM Stat Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
          label="Tech Farmers"
          value={data.tech_exec_farmers ?? 0}
          icon={UsersIcon}
          color="indigo"
          onClick={() => {
            setSearchTerm('');
            setModalType('tech_exec_farmers');
          }}
        />
        <StatCard
          label="My Techs"
          value={data.my_techs_count ?? data.my_techs?.length ?? 0}
          icon={UserGroupIcon}
          color="purple"
          sub="Technical Executives"
          onClick={() => {
            setSearchTerm('');
            setModalType('my_techs');
          }}
        />
      </div>

      <VisitLogsCard visits={data.recent_visits} showSalesperson={true} />

      {/* Responsive Farmers Modal for My Farmers / Technical Executive Farmers */}
      {modalType && modalType !== 'my_techs' && (
        <FarmersModal
          type={modalType}
          farmers={filteredFarmers}
          totalCount={farmersList.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClose={() => setModalType(null)}
        />
      )}

      {/* Responsive Techs Modal for My Techs */}
      {modalType === 'my_techs' && (
        <TechsModal
          techs={filteredTechs}
          totalCount={techsList.length}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
}


function DealersModal({ dealers, totalCount, searchTerm, onSearchChange, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-blue-50/80 via-white to-gray-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
              <BuildingStorefrontIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">Dealers</h2>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition shrink-0"
            title="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search dealers by name..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              autoFocus
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

        {/* Dealers List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {dealers.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <BuildingStorefrontIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600">No dealers found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm
                  ? 'No dealer matches your search.'
                  : 'No dealers recorded yet. When ASM or technicians add a dealer name while creating/editing farmers, they will appear here.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {dealers.map((dealer, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-gray-200/80 bg-white hover:border-blue-300 hover:shadow-xs transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-100">
                      <BuildingStorefrontIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-gray-900 truncate" title={dealer.dealer_name}>
                        {dealer.dealer_name}
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {dealer.farmer_count} {dealer.farmer_count === 1 ? 'farmer' : 'farmers'} · {dealer.tank_count} {dealer.tank_count === 1 ? 'tank' : 'tanks'}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 shrink-0">
                    {dealer.tank_count} {dealer.tank_count === 1 ? 'Tank' : 'Tanks'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Total: <strong>{totalCount}</strong> distinct dealers</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function ManagementDashboard({ data }) {
  const [showDealersModal, setShowDealersModal] = useState(false);
  const [dealerSearchTerm, setDealerSearchTerm] = useState('');
  const [showHarvestedModal, setShowHarvestedModal] = useState(false);

  // Query users to integrate admin features directly into minimal stat cards
  const { data: users } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: () => userApi.list({}).then((r) => r.data.data),
    staleTime: 60000,
  });

  const techExecs = (users || []).filter((u) => u.role === 'sales_executive');
  const areaManagers = (users || []).filter((u) => u.role === 'sales_manager');

  const dealersList = data.dealers_list || [];
  const filteredDealers = dealersList.filter((d) =>
    d.dealer_name?.toLowerCase().includes(dealerSearchTerm.toLowerCase().trim())
  );

  return (
    <div className="fade-in space-y-6">
      {/* Minimal Stat Cards Grid (Clean 3-column rows) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Row 1: Farmers */}
        <StatCard
          label="Area Managers"
          value={areaManagers.length}
          icon={UsersIcon}
          color="purple"
          to="/users"
        />
        <StatCard
          label="Field Executives"
          value={techExecs.length}
          icon={UsersIcon}
          color="indigo"
          to="/users"
        />
        <StatCard
          label="Dealers"
          value={data.total_dealers ?? dealersList.length ?? 0}
          icon={BuildingStorefrontIcon}
          color="blue"
          onClick={() => {
            setDealerSearchTerm('');
            setShowDealersModal(true);
          }}
        />
        <StatCard
          label="Total Submissions"
          value={data.total_submissions ?? 0}
          icon={DocumentTextIcon}
          color="emerald"
          to="/visits"
        />
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
          onClick={() => setShowHarvestedModal(true)}
        />

        {/* Row 3: Submissions & Operations */}
        <StatCard
          label="Due Follow-ups"
          value={data.due_followups ?? 0}
          icon={ClockIcon}
          color="amber"
          to="/followups"
        />

        {/* Row 4: Management & Leadership */}

        <StatCard
          label="Forcely Closed Farmer"
          value={data.forcely_closed_farmers ?? 0}
          icon={NoSymbolIcon}
          color="amber"
          to="/clients?status=forcely_closed"
        />
      </div>

      {/* Harvested Tanks Modal with Partial & Final Filters */}
      {showHarvestedModal && (
        <HarvestedTanksModal onClose={() => setShowHarvestedModal(false)} />
      )}
      {/* Dealers Modal */}
      {showDealersModal && (
        <DealersModal
          dealers={filteredDealers}
          totalCount={dealersList.length}
          searchTerm={dealerSearchTerm}
          onSearchChange={setDealerSearchTerm}
          onClose={() => setShowDealersModal(false)}
        />
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => dashboardApi.get().then((r) => r.data.data),
  });

  if (isLoading) return <PageSpinner />;

  if (isError || !data) {
    return (
      <div className="card p-8 text-center space-y-3 max-w-lg mx-auto mt-8">
        <p className="text-sm font-medium text-gray-900">Could not load dashboard data</p>
        <p className="text-xs text-gray-500">
          {error?.response?.data?.message || error?.message || 'Failed to fetch dashboard data'}
        </p>
        <button type="button" onClick={() => refetch()} className="btn-primary btn-sm mx-auto">
          Retry
        </button>
      </div>
    );
  }

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
