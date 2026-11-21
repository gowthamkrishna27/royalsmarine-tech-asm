import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clientService } from '../../services/clientService';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  CircleStackIcon,
  ArrowLeftIcon,
  FunnelIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ArchiveBoxArrowDownIcon,
  NoSymbolIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

const fmtNumber = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString();
};

export default function SeedTracker() {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Fetch seed tanks data
  const { data = {}, isLoading, error, refetch } = useQuery({
    queryKey: ['seed-tanks-data', search, regionFilter, statusFilter],
    queryFn: () =>
      clientService
        .getSeedTanks({
          search: search || undefined,
          region: regionFilter || undefined,
          status: statusFilter || undefined,
        })
        .then((r) => r.data.data || {}),
  });

  const rawTanks = useMemo(() => data.tanks || [], [data.tanks]);
  const summary = useMemo(() => data.summary || {}, [data.summary]);
  const availableRegions = useMemo(() => data.available_regions || [], [data.available_regions]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await clientService.exportSeed({
        search: search || undefined,
        region: regionFilter || undefined,
        status: statusFilter || undefined,
      });
      downloadBlob(res.data, 'tank-seed-report.xlsx');
      toast.success('Seed report exported successfully');
    } catch {
      toast.error('Failed to export seed report');
    } finally {
      setExporting(false);
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setRegionFilter('');
    setStatusFilter('');
  };

  const hasActiveFilters = Boolean(search || regionFilter || statusFilter);

  if (isLoading) return <PageSpinner />;

  return (
    <div className="space-y-5 fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard"
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition"
            title="Back to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
                Total Seed Tracker
              </h1>
              {/* Blinking Live Badge */}
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Live
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Live seed tracking across all ponds and tanks with harvest reductions
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || rawTanks.length === 0}
          className="btn-secondary btn-sm flex items-center justify-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Stocked Seed */}
        <div className="card p-4 border-l-4 border-blue-500 bg-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Stocked Seed
            </span>
            <CircleStackIcon className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
            {fmtNumber(summary.total_initial_seed)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Initial stocking across all tanks</p>
        </div>

        {/* Current Active Seed */}
        <div className="card p-4 border-l-4 border-emerald-500 bg-emerald-50/20 ring-1 ring-emerald-500/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Current Active Seed
            </span>
            <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-2">
            {fmtNumber(summary.total_current_seed)}
          </p>
          <p className="text-[11px] text-emerald-600/90 mt-0.5 font-medium">
            Live remaining seed right now
          </p>
        </div>

        {/* Reduced / Harvested Seed */}
        <div className="card p-4 border-l-4 border-amber-500 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Reduced / Harvested
            </span>
            <ArchiveBoxArrowDownIcon className="w-5 h-5 text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-amber-700 mt-2">
            {fmtNumber(summary.total_reduced_seed)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
            Reduced by harvests & closures
          </p>
        </div>

        {/* Active Tanks vs Total */}
        <div className="card p-4 border-l-4 border-indigo-500 bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Active Tanks
            </span>
            <BuildingOfficeIcon className="w-5 h-5 text-indigo-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-2">
            {summary.active_tanks ?? 0}
            <span className="text-sm font-normal text-gray-500 ml-1.5">
              / {summary.total_tanks ?? 0}
            </span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
            Tanks currently carrying seed
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search farmer, tank, phone, village..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Region Filter */}
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className={`h-[34px] px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer min-w-[130px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              regionFilter
                ? 'bg-blue-50/70 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Regions</option>
            {availableRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`h-[34px] px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer min-w-[140px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              statusFilter
                ? 'bg-blue-50/70 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Statuses</option>
            <option value="active">Active Seed Only (&gt; 0)</option>
            <option value="partial">Partially Harvested</option>
            <option value="harvested">Fully Harvested</option>
            <option value="closed">Farmer Closed</option>
            <option value="zero">Zero Seed Tanks</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-secondary btn-sm text-red-600 hover:bg-red-50 hover:border-red-200 transition h-[34px] px-2.5 flex items-center gap-1 shrink-0"
              title="Reset all filters"
            >
              <FunnelIcon className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Tanks List Table */}
      <div className="card overflow-hidden">
        {rawTanks.length === 0 ? (
          <EmptyState
            title="No tanks found"
            description={
              hasActiveFilters
                ? 'Try clearing your filters to see more tanks.'
                : 'No tanks recorded with seed stocking data.'
            }
            action={
              hasActiveFilters ? (
                <button type="button" onClick={handleResetFilters} className="btn-secondary btn-sm">
                  Clear Filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
              <thead className="bg-gray-50/80 text-gray-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-3 sm:px-4">Farmer / Company</th>
                  <th className="py-3 px-3 sm:px-4">Tank Name / No.</th>
                  <th className="py-3 px-3 sm:px-4">Region / Location</th>
                  <th className="py-3 px-3 sm:px-4">DOC / Seed Date</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Initial Seed</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Reduced Seed</th>
                  <th className="py-3 px-3 sm:px-4 text-right">Current Seed</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                  <th className="py-3 px-3 sm:px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rawTanks.map((tank) => {
                  const isZero = tank.current_seed === 0;
                  return (
                    <tr
                      key={tank.id}
                      className="hover:bg-gray-50/70 transition cursor-pointer"
                      onClick={() => setSelectedTank(tank)}
                    >
                      {/* Farmer */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-gray-900">
                          {tank.company_name || tank.contact_person || `Farmer #${tank.client_id}`}
                        </div>
                        <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                          {tank.contact_person && <span>{tank.contact_person}</span>}
                          {tank.farmer_phone && <span>• {tank.farmer_phone}</span>}
                        </div>
                      </td>

                      {/* Tank */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-gray-900">{tank.tank_number}</div>
                        <div className="text-[11px] text-gray-500">
                          {tank.area_acres ? `${tank.area_acres} Acres` : '—'} • {tank.culture_type}
                        </div>
                      </td>

                      {/* Region */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="text-gray-900 font-medium">{tank.region || '—'}</div>
                        <div className="text-[11px] text-gray-500">
                          {tank.village || tank.district || ''}
                        </div>
                      </td>

                      {/* DOC & Seed Date */}
                      <td className="py-3 px-3 sm:px-4">
                        <div className="font-semibold text-gray-900">
                          {tank.doc !== null && tank.doc !== undefined ? `DOC ${tank.doc}` : '—'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {tank.seed_date ? `Stocked: ${tank.seed_date}` : 'No date'}
                        </div>
                      </td>

                      {/* Initial Seed */}
                      <td className="py-3 px-3 sm:px-4 text-right font-medium text-gray-600">
                        {fmtNumber(tank.initial_seed)}
                      </td>

                      {/* Reduced Seed */}
                      <td className="py-3 px-3 sm:px-4 text-right font-medium">
                        {tank.reduced_seed > 0 ? (
                          <span className="text-amber-600">
                            -{fmtNumber(tank.reduced_seed)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* Current Active Seed */}
                      <td className="py-3 px-3 sm:px-4 text-right font-bold text-sm">
                        {isZero ? (
                          <span className="text-gray-400 font-medium">0</span>
                        ) : (
                          <span className="text-emerald-600 font-extrabold">
                            {fmtNumber(tank.current_seed)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 sm:px-4 text-center">
                        <StatusBadge status={tank.seed_status} />
                      </td>

                      {/* Action */}
                      <td
                        className="py-3 px-3 sm:px-4 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTank(tank);
                        }}
                      >
                        <button
                          type="button"
                          className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tank Seed Details Modal */}
      {selectedTank && (
        <TankSeedModal tank={selectedTank} onClose={() => setSelectedTank(null)} />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  if (status === 'Active') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
        Active
      </span>
    );
  }
  if (status === 'Partially Harvested') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-800">
        Partial Harvest
      </span>
    );
  }
  if (status === 'Fully Harvested') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
        Fully Harvested
      </span>
    );
  }
  if (status === 'Farmer Closed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
        Farmer Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
      {status || 'Unknown'}
    </span>
  );
}

function TankSeedModal({ tank, onClose }) {
  const isZero = tank.current_seed === 0;
  const partials = tank.partial_harvests || [];

  return (
    <Modal open={true} onClose={onClose} title="Tank Seed Breakdown" size="lg">
      <div className="space-y-4">
        {/* Tank & Farmer Header */}
        <div className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{tank.tank_number}</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                Farmer: <span className="font-semibold text-gray-900">{tank.company_name}</span>{' '}
                {tank.farmer_phone ? `(${tank.farmer_phone})` : ''}
              </p>
              <p className="text-[11px] text-gray-500">
                Region: {tank.region || '—'} • Village: {tank.village || '—'}
              </p>
            </div>
            <div className="self-start sm:self-center">
              <StatusBadge status={tank.seed_status} />
            </div>
          </div>
        </div>

        {/* Seed Calculation KPI cards */}
        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-lg border border-gray-200 bg-white">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Initial Stocking</p>
            <p className="text-base sm:text-lg font-bold text-gray-900 mt-1">
              {fmtNumber(tank.initial_seed)}
            </p>
            <p className="text-[10px] text-gray-400">
              {tank.seed_date ? `Date: ${tank.seed_date}` : 'Stocked'}
            </p>
          </div>

          <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30">
            <p className="text-[11px] font-medium text-amber-700 uppercase">Reduced Seed</p>
            <p className="text-base sm:text-lg font-bold text-amber-700 mt-1">
              -{fmtNumber(tank.reduced_seed)}
            </p>
            <p className="text-[10px] text-amber-600/80 truncate">
              {tank.partial_harvests_count} partial harvest(s)
            </p>
          </div>

          <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/40">
            <p className="text-[11px] font-semibold text-emerald-800 uppercase">Current Seed</p>
            <p className={`text-base sm:text-lg font-extrabold mt-1 ${isZero ? 'text-gray-400' : 'text-emerald-700'}`}>
              {fmtNumber(tank.current_seed)}
            </p>
            <p className="text-[10px] text-emerald-600/90 font-medium">Remaining Live</p>
          </div>
        </div>

        {/* Reduction Reason Banner */}
        {tank.reduction_reason && tank.reduction_reason !== 'None' && (
          <div className="p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg flex items-start gap-2 text-xs text-blue-900">
            <InformationCircleIcon className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Seed Reduction Reason:</span>{' '}
              <span>{tank.reduction_reason}</span>
            </div>
          </div>
        )}

        {/* Partial Harvests Table (if any) */}
        {partials.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Partial Harvests Logged ({partials.length})
            </h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-[11px] text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">DOC</th>
                    <th className="py-2 px-3">Biomass (kg)</th>
                    <th className="py-2 px-3">Count (pcs/kg)</th>
                    <th className="py-2 px-3 text-right">Seed Reduced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {partials.map((ph, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/60">
                      <td className="py-2 px-3">{ph.date || '—'}</td>
                      <td className="py-2 px-3">{ph.doc ? `DOC ${ph.doc}` : '—'}</td>
                      <td className="py-2 px-3 font-medium">
                        {ph.harvested_quantity || ph.harvested_biomass || ph.biomass || '—'} kg
                      </td>
                      <td className="py-2 px-3">{ph.count || '—'}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-700">
                        -{fmtNumber(ph.seed_reduced)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Final Harvest Info (if any) */}
        {tank.final_harvest && (
          <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg space-y-1 text-xs">
            <p className="font-bold text-amber-900">Final Harvest Completed</p>
            <p className="text-amber-800">
              Date: <span className="font-medium">{tank.final_harvest.date || '—'}</span> • DOC:{' '}
              <span className="font-medium">{tank.final_harvest.doc || '—'}</span> • Count:{' '}
              <span className="font-medium">{tank.final_harvest.count || '—'}</span> • Biomass:{' '}
              <span className="font-medium">
                {tank.final_harvest.harvested_quantity || tank.final_harvest.total_biomass || '—'} kg
              </span>
            </p>
            <p className="text-[11px] text-amber-700 font-medium">
              Final harvest completes the crop cycle, reducing remaining live seed to 0.
            </p>
          </div>
        )}

        {/* Farmer Closed Notice (if any) */}
        {tank.seed_status === 'Farmer Closed' && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5 text-red-800">
              <NoSymbolIcon className="w-4 h-4 text-red-600 shrink-0" />
              Farmer Closed
            </p>
            <p className="text-red-700">
              This farmer was closed ({tank.farmer_status?.replace('_', ' ')}). All tank seed has been reduced to 0.
            </p>
            {tank.close_reason && (
              <p className="text-[11px] text-red-600 font-medium">
                Reason: {tank.close_reason}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
