import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clientService } from '../../services/clientService';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

const fmt = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v);

export default function CountTracker() {
  const [countInput, setCountInput] = useState('1');
  const [regionFilter, setRegionFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Fetch all tanks and count data
  const { data = {}, isLoading, error, refetch } = useQuery({
    queryKey: ['count-tanks-data', search],
    queryFn: () =>
      clientService
        .getCountTanks({ search: search || undefined })
        .then((r) => r.data.data || {}),
  });

  const rawTanks = useMemo(() => data.tanks || [], [data.tanks]);

  // Extract distinct regions across dataset
  const availableRegions = useMemo(() => {
    if (data.available_regions?.length) return data.available_regions;
    const set = new Set();
    rawTanks.forEach((t) => {
      if (t.region) set.add(t.region);
      if (t.district) set.add(t.district);
    });
    return Array.from(set).sort();
  }, [data.available_regions, rawTanks]);

  // Extract distinct areas across dataset (scoped to selected region if any)
  const availableAreas = useMemo(() => {
    const set = new Set();
    rawTanks.forEach((t) => {
      const matchRegion =
        !regionFilter ||
        (t.region || '').toLowerCase() === regionFilter.toLowerCase() ||
        (t.district || '').toLowerCase() === regionFilter.toLowerCase();
      if (matchRegion) {
        if (t.area) set.add(t.area);
        if (t.village) set.add(t.village);
        if (t.mandal) set.add(t.mandal);
      }
    });
    return Array.from(set).sort();
  }, [rawTanks, regionFilter]);

  // Filter tanks by count, region, area, and search
  const filteredTanks = useMemo(() => {
    let list = rawTanks;

    // Filter by Count input (matches any recorded count on the tank)
    if (countInput && countInput.trim() !== '') {
      const targetStr = countInput.trim();
      const targetNum = parseFloat(targetStr);
      list = list.filter((t) => {
        const records = t.counts_records || [];
        return records.some((cr) => {
          if (!isNaN(targetNum) && typeof cr.count === 'number') {
            return Math.abs(cr.count - targetNum) < 0.01;
          }
          return String(cr.count).trim().toLowerCase() === targetStr.toLowerCase();
        });
      });
    }

    // Filter by Region
    if (regionFilter && regionFilter.trim() !== '') {
      const rLower = regionFilter.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.region || '').toLowerCase() === rLower ||
          (t.district || '').toLowerCase() === rLower ||
          (t.salesperson_region || '').toLowerCase() === rLower ||
          (t.manager_region || '').toLowerCase() === rLower
      );
    }

    // Filter by Area
    if (areaFilter && areaFilter.trim() !== '') {
      const aLower = areaFilter.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.area || '').toLowerCase() === aLower ||
          (t.village || '').toLowerCase() === aLower ||
          (t.mandal || '').toLowerCase() === aLower ||
          (t.salesperson_area || '').toLowerCase() === aLower ||
          (t.manager_area || '').toLowerCase() === aLower
      );
    }

    // Filter by Search text
    if (search && search.trim() !== '') {
      const sLower = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.company_name || '').toLowerCase().includes(sLower) ||
          (t.contact_person || '').toLowerCase().includes(sLower) ||
          (t.farmer_phone || '').toLowerCase().includes(sLower) ||
          (t.pond_name || '').toLowerCase().includes(sLower) ||
          (t.tank_number || '').toLowerCase().includes(sLower) ||
          (t.village || '').toLowerCase().includes(sLower) ||
          (t.mandal || '').toLowerCase().includes(sLower) ||
          (t.district || '').toLowerCase().includes(sLower) ||
          (t.salesperson_name || '').toLowerCase().includes(sLower)
      );
    }

    return list;
  }, [rawTanks, countInput, regionFilter, areaFilter, search]);

  // Group filtered tanks by Farmer
  const groupedFarmers = useMemo(() => {
    const map = new Map();
    filteredTanks.forEach((t) => {
      if (!map.has(t.client_id)) {
        map.set(t.client_id, {
          client_id: t.client_id,
          company_name: t.company_name || t.contact_person || `Farmer ${t.client_id}`,
          contact_person: t.contact_person,
          farmer_phone: t.farmer_phone,
          village: t.village,
          mandal: t.mandal,
          district: t.district,
          city: t.city,
          state: t.state,
          region: t.region || t.salesperson_region || t.district || '—',
          area: t.area || t.salesperson_area || t.mandal || t.village || '—',
          salesperson_name: t.salesperson_name,
          salesperson_phone: t.salesperson_phone,
          tanks: [],
          total_biomass: 0,
        });
      }
      const farmer = map.get(t.client_id);
      farmer.tanks.push(t);
      const b = parseFloat(t.primary_biomass || t.total_biomass || 0);
      if (!isNaN(b) && b > 0) farmer.total_biomass += b;
    });

    return Array.from(map.values()).map((f) => ({
      ...f,
      total_biomass: parseFloat(f.total_biomass.toFixed(2)),
    }));
  }, [filteredTanks]);

  // Summary statistics
  const summary = useMemo(() => {
    const totalFarmers = groupedFarmers.length;
    const totalTanks = filteredTanks.length;
    let totalBiomass = 0;

    filteredTanks.forEach((t) => {
      const b = parseFloat(t.primary_biomass || t.total_biomass || 0);
      if (!isNaN(b) && b > 0) totalBiomass += b;
    });

    return {
      totalFarmers,
      totalTanks,
      totalBiomass: totalBiomass > 0 ? `${Math.round(totalBiomass).toLocaleString()} kg` : '—',
      activeCount: countInput ? countInput.trim() : 'All',
    };
  }, [groupedFarmers, filteredTanks, countInput]);

  const hasActiveFilters = Boolean(
    countInput || regionFilter || areaFilter || search
  );

  const handleResetFilters = () => {
    setCountInput('');
    setRegionFilter('');
    setAreaFilter('');
    setSearch('');
  };

  // Export handler
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await clientService.exportCount({
        count: countInput || undefined,
        region: regionFilter || undefined,
        area: areaFilter || undefined,
        search: search || undefined,
      });
      downloadBlob(res.data, 'count-report.xlsx');
      toast.success('Count report exported successfully');
    } catch {
      try {
        const headers = [
          'Farmer / Company',
          'Contact Person',
          'Mobile',
          'Region',
          'Area',
          'Village',
          'Mandal',
          'District',
          'Technical Executive',
          'Tank Name',
          'Count',
          'Count Source',
          'DOC',
          'Biomass (kg)',
          'Harvest Date',
          'Status',
        ];

        const rows = filteredTanks.map((t) => [
          `"${t.company_name || ''}"`,
          `"${t.contact_person || ''}"`,
          `"${t.farmer_phone || ''}"`,
          `"${t.region || ''}"`,
          `"${t.area || ''}"`,
          `"${t.village || ''}"`,
          `"${t.mandal || ''}"`,
          `"${t.district || ''}"`,
          `"${t.salesperson_name || ''}"`,
          `"${t.tank_number || t.pond_name || ''}"`,
          `"${t.primary_count ?? ''}"`,
          `"${t.primary_source || ''}"`,
          `"${t.primary_doc || ''}"`,
          `"${t.primary_biomass || ''}"`,
          `"${t.primary_date ? String(t.primary_date).slice(0, 10) : ''}"`,
          `"${t.status || ''}"`,
        ]);

        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        downloadBlob(
          new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
          'count-report.csv'
        );
        toast.success('Count report exported (CSV)');
      } catch {
        toast.error('Failed to export Count report');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-1 border-b border-sky-100">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-sky-950 tracking-tight">Count</h1>

        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filteredTanks.length === 0}
            className="btn-secondary btn-sm py-1.5 px-3 text-xs inline-flex items-center gap-1.5 rounded-lg border-sky-200 bg-sky-50/60 hover:bg-sky-100 text-sky-800 shadow-none font-medium transition"
            title="Export to Excel"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5 text-sky-700" />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Light Blue Minimal Metric Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5 sm:p-3">
          <span className="text-[11px] font-semibold text-sky-800 uppercase tracking-wide block">Target Count</span>
          <p className="text-lg sm:text-xl font-bold text-sky-950 font-mono mt-0.5">
            {countInput ? countInput : 'All'}
          </p>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50/25 p-2.5 sm:p-3">
          <span className="text-[11px] font-medium text-sky-800 block">Farmers</span>
          <p className="text-lg sm:text-xl font-bold text-sky-950 tabular-nums mt-0.5">
            {summary.totalFarmers}
          </p>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50/25 p-2.5 sm:p-3">
          <span className="text-[11px] font-medium text-sky-800 block">Tanks</span>
          <p className="text-lg sm:text-xl font-bold text-sky-950 tabular-nums mt-0.5">
            {summary.totalTanks}
          </p>
        </div>

        <div className="rounded-lg border border-sky-100 bg-sky-50/25 p-2.5 sm:p-3">
          <span className="text-[11px] font-medium text-sky-800 block">Total Biomass</span>
          <p className="text-lg sm:text-xl font-bold text-sky-950 tabular-nums mt-0.5">
            {summary.totalBiomass}
          </p>
        </div>
      </div>

      {/* Filter Toolbar: Light Blue Theme, Responsive & Minimal */}
      <div className="rounded-lg border border-sky-100 bg-white p-2.5 sm:p-3">
        <div className="flex flex-wrap items-center gap-2.5 justify-start">
          {/* Count input only (Quick pills removed as requested) */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-sky-900">Count:</span>
            <div className="relative w-24 sm:w-28">
              <input
                type="number"
                step="any"
                min="0"
                placeholder="Count"
                value={countInput}
                onChange={(e) => setCountInput(e.target.value)}
                className="input py-1 px-2.5 text-xs font-mono font-bold text-sky-950 bg-sky-50/30 border-sky-200 focus:bg-white focus:border-sky-500 rounded-md w-full"
                title="Enter count"
              />
              {countInput && (
                <button
                  type="button"
                  onClick={() => setCountInput('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear count"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* Region */}
          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setAreaFilter('');
            }}
            className="h-8 px-2.5 py-1 text-xs font-medium rounded-md border border-sky-200 bg-sky-50/30 text-sky-950 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 min-w-[115px]"
            title="Filter by Region"
          >
            <option value="">All Regions</option>
            {availableRegions.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>

          {/* Area */}
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="h-8 px-2.5 py-1 text-xs font-medium rounded-md border border-sky-200 bg-sky-50/30 text-sky-950 hover:bg-white focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-400 min-w-[115px]"
            title="Filter by Area"
          >
            <option value="">All Areas</option>
            {availableAreas.map((ar) => (
              <option key={ar} value={ar}>
                {ar}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative min-w-[160px] sm:min-w-[190px]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search farmer, tank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full py-1 pl-7 pr-6 text-xs bg-sky-50/30 border-sky-200 focus:bg-white rounded-md"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Reset button */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-8 px-2.5 rounded-md border border-red-200 bg-red-50/40 text-red-600 hover:bg-red-50 text-xs font-medium inline-flex items-center gap-1 transition"
              title="Reset filters"
            >
              <XMarkIcon className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Light Blue Table Format (Zero Bottom Sliding Bar) */}
      {isLoading ? (
        <div className="rounded-lg border border-sky-100 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-xs text-sky-800">Loading records...</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-xs font-semibold text-red-900">Failed to load Count data</p>
          <p className="text-xs text-red-700 mt-0.5">{error.message || 'Unknown error'}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary btn-sm mt-2 text-xs"
          >
            Retry
          </button>
        </div>
      ) : filteredTanks.length === 0 ? (
        <EmptyState
          icon={TableCellsIcon}
          title={
            countInput
              ? `No farmers found with tanks matching Count ${countInput}`
              : 'No records match the selected filters'
          }
          description="Try entering another count value (e.g. 1, 20, 30, 40) or clearing your region/area filters."
          action={
            hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary btn-sm mt-2 text-xs"
              >
                Clear Filters
              </button>
            )
          }
        />
      ) : (
        /* Responsive Light Blue Table (No Horizontal Scrollbar / Sliding Bar) */
        <div className="rounded-lg border border-sky-200/80 bg-white overflow-hidden shadow-2xs">
          {/* Desktop & Tablet Table */}
          <div className="hidden sm:block w-full overflow-x-hidden">
            <table className="w-full text-left text-xs divide-y divide-sky-100">
              <thead className="bg-sky-50/70 text-sky-900 font-semibold text-[11px] uppercase tracking-wider border-b border-sky-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-10 text-center text-sky-800/60">No.</th>
                  <th className="py-2.5 px-3 font-semibold">Farmer</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold">Tanks</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-16">Tanks</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-24">Biomass</th>
                  <th className="py-2.5 px-3 font-semibold w-28">Tech</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sky-50 bg-white">
                {groupedFarmers.map((farmer, idx) => (
                  <tr key={farmer.client_id} className="hover:bg-sky-50/40 transition">
                    {/* No. */}
                    <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Farmer */}
                    <td className="py-2.5 px-3">
                      <Link
                        to={`/clients/${farmer.client_id}`}
                        className="font-semibold text-sky-950 hover:text-sky-600 transition block truncate max-w-[200px]"
                        title={farmer.company_name}
                      >
                        {farmer.company_name || farmer.farmer_name}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        {farmer.farmer_phone ? (
                          <a href={`tel:${farmer.farmer_phone}`} className="hover:text-sky-700 font-mono">
                            {farmer.farmer_phone}
                          </a>
                        ) : null}
                        {farmer.village ? <span>· {farmer.village}</span> : null}
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-2.5 px-3">
                      <span className="font-medium text-gray-800 block">
                        {farmer.region || '—'}
                      </span>
                      <span className="text-[11px] text-gray-400 block truncate max-w-[120px]">
                        {farmer.area || farmer.mandal || '—'}
                      </span>
                    </td>

                    {/* Matching Tanks with Count in light blue pill */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {farmer.tanks.map((tank) => (
                          <button
                            key={tank.id}
                            type="button"
                            onClick={() => setSelectedTank(tank)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-sky-200 bg-sky-50/60 hover:bg-sky-100 text-sky-950 text-[11px] transition shadow-2xs"
                            title="Click for tank details"
                          >
                            <span className="font-semibold text-sky-950">
                              {tank.tank_number || tank.pond_name || `Tank ${tank.id}`}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-sky-600 text-white font-mono font-bold text-[10px]">
                              Count: {tank.primary_count ?? countInput}
                            </span>
                            {tank.primary_biomass ? (
                              <span className="text-[10px] text-sky-800/70 font-mono">
                                ({tank.primary_biomass}kg)
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Tanks Count */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-sky-100 text-sky-800">
                        {farmer.tanks.length}
                      </span>
                    </td>

                    {/* Biomass */}
                    <td className="py-2.5 px-3 text-right font-medium font-mono text-gray-900 text-xs">
                      {farmer.total_biomass > 0 ? `${farmer.total_biomass.toLocaleString()} kg` : '—'}
                    </td>

                    {/* Tech Exec */}
                    <td className="py-2.5 px-3 text-xs text-gray-600 truncate max-w-[120px]">
                      {farmer.salesperson_name || '—'}
                    </td>

                    {/* Action */}
                    <td className="py-2.5 px-3 text-right">
                      <Link
                        to={`/clients/${farmer.client_id}`}
                        className="text-xs text-sky-600 hover:text-sky-800 font-medium underline-offset-2 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Layout (Zero Horizontal Scrollbar) */}
          <div className="sm:hidden divide-y divide-sky-100">
            {groupedFarmers.map((farmer, idx) => (
              <div key={farmer.client_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono mr-1">{idx + 1}.</span>
                    <Link
                      to={`/clients/${farmer.client_id}`}
                      className="font-bold text-xs text-sky-950 hover:text-sky-600"
                    >
                      {farmer.company_name || farmer.farmer_name}
                    </Link>
                    <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                      {farmer.farmer_phone ? (
                        <a href={`tel:${farmer.farmer_phone}`} className="font-mono">
                          {farmer.farmer_phone}
                        </a>
                      ) : null}
                      {farmer.village ? <span>· {farmer.village}</span> : null}
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-semibold shrink-0">
                    {farmer.region || '—'}
                  </span>
                </div>

                {/* Tanks */}
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  {farmer.tanks.map((tank) => (
                    <button
                      key={tank.id}
                      type="button"
                      onClick={() => setSelectedTank(tank)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-[10px] text-sky-950"
                    >
                      <span>{tank.tank_number || tank.pond_name || `Tank ${tank.id}`}</span>
                      <span className="font-mono font-bold">Count: {tank.primary_count ?? countInput}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-sky-50">
                  <span>Tech: {farmer.salesperson_name || '—'}</span>
                  <span className="font-mono font-semibold text-gray-800">
                    {farmer.total_biomass > 0 ? `${farmer.total_biomass} kg` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Light Blue Modal for Tank Details */}
      {selectedTank && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl border border-sky-200 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-3.5 border-b border-sky-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="font-bold text-sm text-sky-950">
                  {selectedTank.tank_number || selectedTank.pond_name || `Tank ${selectedTank.id}`}
                </h3>
                <p className="text-[11px] text-sky-800/70">
                  {selectedTank.company_name} · {selectedTank.village || selectedTank.district}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTank(null)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {/* Highlight Count Banner in light blue */}
              <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-sky-800 uppercase tracking-wide block">
                    Recorded Count
                  </span>
                  <p className="text-xl font-bold text-sky-950 font-mono mt-0.5">
                    {selectedTank.primary_count ?? '—'}
                  </p>
                  <span className="text-[10px] text-sky-700 block mt-0.5">
                    Source: {selectedTank.primary_source || 'Harvest Log'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-sky-800 block">Biomass</span>
                  <span className="text-base font-bold text-sky-950 font-mono">
                    {selectedTank.primary_biomass ? `${selectedTank.primary_biomass} kg` : '—'}
                  </span>
                </div>
              </div>

              {/* Farmer Info */}
              <div className="p-2.5 rounded-lg border border-sky-100 bg-white space-y-1.5">
                <span className="font-semibold text-sky-900 block text-[11px]">Farmer Information</span>
                <div className="grid grid-cols-2 gap-1.5 text-gray-600 text-[11px]">
                  <div>Farmer: <strong className="text-gray-900">{selectedTank.company_name}</strong></div>
                  <div>Phone: <strong className="text-gray-900 font-mono">{selectedTank.farmer_phone || '—'}</strong></div>
                  <div>Region: <strong className="text-gray-900">{selectedTank.region || '—'}</strong></div>
                  <div>Area: <strong className="text-gray-900">{selectedTank.area || '—'}</strong></div>
                  <div>Village: <strong className="text-gray-900">{selectedTank.village || '—'}</strong></div>
                  <div>Tech Exec: <strong className="text-gray-900">{selectedTank.salesperson_name || '—'}</strong></div>
                </div>
              </div>

              {/* All Count Logs */}
              {selectedTank.counts_records?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-sky-900 block text-[11px]">Count Log Sessions</span>
                  <div className="rounded border border-sky-200 overflow-hidden">
                    <table className="w-full text-left text-[11px]">
                      <thead className="bg-sky-50 text-sky-800 font-medium">
                        <tr>
                          <th className="py-1 px-2">Source</th>
                          <th className="py-1 px-2">Count</th>
                          <th className="py-1 px-2">DOC</th>
                          <th className="py-1 px-2">ABW (g)</th>
                          <th className="py-1 px-2">Biomass (kg)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-sky-100">
                        {selectedTank.counts_records.map((cr, idx) => (
                          <tr key={idx}>
                            <td className="py-1 px-2 text-gray-700">{cr.source}</td>
                            <td className="py-1 px-2 font-bold font-mono text-sky-900">{cr.count}</td>
                            <td className="py-1 px-2 font-mono">{cr.doc || '—'}</td>
                            <td className="py-1 px-2 font-mono">{cr.abw || '—'}</td>
                            <td className="py-1 px-2 font-mono">{cr.biomass ? `${cr.biomass} kg` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 border-t border-sky-100 bg-sky-50/50 flex items-center justify-between">
              <Link
                to={`/clients/${selectedTank.client_id}`}
                className="text-xs text-sky-700 hover:text-sky-900 font-semibold"
              >
                Go to Farmer Page →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedTank(null)}
                className="btn-secondary btn-sm py-1 px-2.5 text-xs rounded border-sky-200 bg-white text-sky-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
