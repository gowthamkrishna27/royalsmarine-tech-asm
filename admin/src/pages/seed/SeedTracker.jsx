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
    queryKey: ['seed-tanks-data', search],
    queryFn: () =>
      clientService
        .getSeedTanks({
          search: search || undefined,
        })
        .then((r) => r.data.data || {}),
  });

  const allTanks = useMemo(() => data.tanks || [], [data.tanks]);
  const summary = useMemo(() => data.summary || {}, [data.summary]);
  const availableRegions = useMemo(() => {
    if (data.available_regions?.length) return data.available_regions;
    const set = new Set();
    allTanks.forEach((t) => {
      if (t.region) set.add(t.region);
    });
    return Array.from(set).sort();
  }, [data.available_regions, allTanks]);

  const rawTanks = useMemo(() => {
    let list = allTanks;
    if (regionFilter) {
      const rLower = regionFilter.trim().toLowerCase();
      list = list.filter((t) => (t.region || '').toLowerCase() === rLower);
    }
    if (statusFilter) {
      const sLower = statusFilter.trim().toLowerCase();
      if (sLower === 'active') {
        list = list.filter((t) => t.current_seed > 0);
      } else if (sLower === 'partial') {
        list = list.filter((t) => t.seed_status === 'Partially Harvested');
      } else if (sLower === 'harvested') {
        list = list.filter((t) => t.seed_status === 'Fully Harvested');
      } else if (sLower === 'closed') {
        list = list.filter((t) => t.seed_status === 'Farmer Closed');
      }
    }
    return list;
  }, [allTanks, regionFilter, statusFilter]);

  const handleExport = async () => {
    try {
      setExporting(true);
      const res = await clientService.exportSeed({
        search: search || undefined,
        region: regionFilter || undefined,
        status: statusFilter || undefined,
      });
      downloadBlob(res.data, 'tank-seed-report.xlsx');
      toast.success('Exported successfully');
    } catch {
      toast.error('Export failed');
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

  if (error) {
    return (
      <div className="card p-8 text-center space-y-3">
        <p className="text-sm font-semibold text-red-600">Failed to load seed tracker data</p>
        <p className="text-xs text-gray-500">{error.response?.data?.message || error.message || 'Server error'}</p>
        <button type="button" onClick={() => refetch()} className="btn-primary btn-sm mx-auto">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard"
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition"
            title="Back to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight">
            Seed Tracker
          </h1>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || rawTanks.length === 0}
          className="btn-secondary btn-sm flex items-center gap-1.5 disabled:opacity-50"
        >
          <ArrowDownTrayIcon className="w-4 h-4" />
          <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-3 sm:p-4 border-l-4 border-blue-500 bg-blue-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Stocked Seed
            </span>
            <CircleStackIcon className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
            {fmtNumber(summary.total_initial_seed)}
          </p>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-emerald-500 bg-emerald-50/25">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
              Active Seed
            </span>
            <CheckCircleIcon className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
            {fmtNumber(summary.total_current_seed)}
          </p>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-amber-500 bg-amber-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Reduced Seed
            </span>
            <ArchiveBoxArrowDownIcon className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-amber-700 mt-1">
            {fmtNumber(summary.total_reduced_seed)}
          </p>
        </div>

        <div className="card p-3 sm:p-4 border-l-4 border-indigo-500 bg-indigo-50/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Active Tanks
            </span>
            <BuildingOfficeIcon className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900 mt-1">
            {summary.active_tanks ?? 0}
            <span className="text-xs font-normal text-gray-500 ml-1">
              / {summary.total_tanks ?? 0}
            </span>
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-xs p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative flex-1 min-w-[180px]">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
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
            className={`h-[34px] px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer min-w-[120px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
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
            className={`h-[34px] px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer min-w-[130px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
              statusFilter
                ? 'bg-blue-50/70 text-blue-900 border-blue-300 font-semibold'
                : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
            }`}
          >
            <option value="">All Status</option>
            <option value="active">Active Seed</option>
            <option value="partial">Partially Harvested</option>
            <option value="harvested">Fully Harvested</option>
            <option value="closed">Farmer Closed</option>
          </select>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-secondary btn-sm text-red-600 hover:bg-red-50 hover:border-red-200 transition h-[34px] px-2.5 flex items-center gap-1 shrink-0"
              title="Reset"
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
                  <th className="py-2.5 px-3 sm:px-4">Farmer</th>
                  <th className="py-2.5 px-3 sm:px-4">Tank</th>
                  <th className="py-2.5 px-3 sm:px-4">Region</th>
                  <th className="py-2.5 px-3 sm:px-4">DOC</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Initial Seed</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Reduced Seed</th>
                  <th className="py-2.5 px-3 sm:px-4 text-right">Current Seed</th>
                  <th className="py-2.5 px-3 sm:px-4 text-center">Status</th>
                  <th className="py-2.5 px-3 sm:px-4 text-center">Action</th>
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
                      <td className="py-2.5 px-3 sm:px-4 font-semibold text-gray-900">
                        {tank.company_name || tank.contact_person || `Farmer #${tank.client_id}`}
                      </td>

                      {/* Tank */}
                      <td className="py-2.5 px-3 sm:px-4 text-gray-900 font-medium">
                        {tank.tank_number}
                      </td>

                      {/* Region */}
                      <td className="py-2.5 px-3 sm:px-4 text-gray-700">
                        {tank.region || '—'}
                      </td>

                      {/* DOC */}
                      <td className="py-2.5 px-3 sm:px-4 text-gray-700">
                        {tank.doc !== null && tank.doc !== undefined ? `DOC ${tank.doc}` : '—'}
                      </td>

                      {/* Initial Seed */}
                      <td className="py-2.5 px-3 sm:px-4 text-right text-gray-600 font-medium">
                        {fmtNumber(tank.initial_seed)}
                      </td>

                      {/* Reduced Seed */}
                      <td className="py-2.5 px-3 sm:px-4 text-right font-medium">
                        {tank.reduced_seed > 0 ? (
                          <span className="text-amber-600">
                            -{fmtNumber(tank.reduced_seed)}
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>

                      {/* Current Active Seed */}
                      <td className="py-2.5 px-3 sm:px-4 text-right font-bold">
                        {isZero ? (
                          <span className="text-gray-400 font-medium">0</span>
                        ) : (
                          <span className="text-emerald-600 font-extrabold">
                            {fmtNumber(tank.current_seed)}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 sm:px-4 text-center">
                        <StatusBadge status={tank.seed_status} />
                      </td>

                      {/* Action */}
                      <td
                        className="py-2.5 px-3 sm:px-4 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTank(tank);
                        }}
                      >
                        <button
                          type="button"
                          className="px-2 py-0.5 text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition"
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

      {/* Tank Details Modal */}
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
        Partial
      </span>
    );
  }
  if (status === 'Fully Harvested') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800">
        Harvested
      </span>
    );
  }
  if (status === 'Farmer Closed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-800">
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600">
      {status || '—'}
    </span>
  );
}

function TankSeedModal({ tank, onClose }) {
  const isZero = tank.current_seed === 0;
  const partials = tank.partial_harvests || [];

  return (
    <Modal open={true} onClose={onClose} title="Tank Details" size="lg">
      <div className="space-y-3.5">
        {/* Tank & Farmer Header */}
        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{tank.tank_number}</h3>
              <p className="text-xs text-gray-600">
                {tank.company_name} {tank.region ? `• ${tank.region}` : ''}
              </p>
            </div>
            <StatusBadge status={tank.seed_status} />
          </div>
        </div>

        {/* Seed Calculation KPI cards */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2.5 rounded-lg border border-gray-200 bg-white">
            <p className="text-[11px] font-medium text-gray-500 uppercase">Stocked</p>
            <p className="text-base font-bold text-gray-900 mt-0.5">
              {fmtNumber(tank.initial_seed)}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50/30">
            <p className="text-[11px] font-medium text-amber-700 uppercase">Reduced</p>
            <p className="text-base font-bold text-amber-700 mt-0.5">
              -{fmtNumber(tank.reduced_seed)}
            </p>
          </div>

          <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/40">
            <p className="text-[11px] font-semibold text-emerald-800 uppercase">Current</p>
            <p className={`text-base font-extrabold mt-0.5 ${isZero ? 'text-gray-400' : 'text-emerald-700'}`}>
              {fmtNumber(tank.current_seed)}
            </p>
          </div>
        </div>

        {/* Reduction Reason Banner */}
        {tank.reduction_reason && tank.reduction_reason !== 'None' && (
          <div className="p-2 bg-blue-50/80 border border-blue-200 rounded-lg flex items-center gap-2 text-xs text-blue-900">
            <InformationCircleIcon className="w-4 h-4 text-blue-600 shrink-0" />
            <span>{tank.reduction_reason}</span>
          </div>
        )}

        {/* Partial Harvests Table (if any) */}
        {partials.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
              Partial Harvests ({partials.length})
            </h4>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                <thead className="bg-gray-50 text-[11px] text-gray-600 font-semibold uppercase">
                  <tr>
                    <th className="py-1.5 px-3">Date</th>
                    <th className="py-1.5 px-3">DOC</th>
                    <th className="py-1.5 px-3">Biomass</th>
                    <th className="py-1.5 px-3">Count</th>
                    <th className="py-1.5 px-3 text-right">Reduced</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {partials.map((ph, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/60">
                      <td className="py-1.5 px-3">{ph.date || '—'}</td>
                      <td className="py-1.5 px-3">{ph.doc ? `DOC ${ph.doc}` : '—'}</td>
                      <td className="py-1.5 px-3 font-medium">
                        {ph.harvested_quantity || ph.harvested_biomass || ph.biomass || '—'} kg
                      </td>
                      <td className="py-1.5 px-3">{ph.count || '—'}</td>
                      <td className="py-1.5 px-3 text-right font-bold text-amber-700">
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
          <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900">
            <span className="font-bold">Final Harvest:</span> Date: {tank.final_harvest.date || '—'} • DOC: {tank.final_harvest.doc || '—'} • Count: {tank.final_harvest.count || '—'} • Biomass: {tank.final_harvest.harvested_quantity || tank.final_harvest.total_biomass || '—'} kg
          </div>
        )}

        {/* Farmer Closed Notice (if any) */}
        {tank.seed_status === 'Farmer Closed' && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900 flex items-center gap-2">
            <NoSymbolIcon className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              Farmer closed ({tank.farmer_status?.replace('_', ' ')}). Seed reduced to 0.
            </span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
