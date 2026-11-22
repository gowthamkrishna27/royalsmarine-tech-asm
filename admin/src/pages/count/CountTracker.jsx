import { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [countInput, setCountInput] = useState('');
  const [tempCount, setTempCount] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);
  const [exporting, setExporting] = useState(false);
  const tableRef = useRef(null);

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

  // Extract distinct counts across dataset
  const availableCounts = useMemo(() => {
    const set = new Set();
    rawTanks.forEach((t) => {
      (t.counts_records || []).forEach((cr) => {
        const val = parseFloat(cr.count);
        if (!isNaN(val) && val > 0) set.add(val);
      });
      const p = parseFloat(t.primary_count);
      if (!isNaN(p) && p > 0) set.add(p);
    });
    const arr = Array.from(set).sort((a, b) => a - b);
    return arr.length > 0 ? arr : [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  }, [rawTanks]);

  const applyCountSearch = (val) => {
    const clean = val !== undefined ? String(val).trim() : '';
    setCountInput(clean);
    setTempCount(clean);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleStepUp = () => {
    const current = parseFloat(tempCount || countInput);
    let nextVal;
    if (isNaN(current) || (!tempCount && !countInput)) {
      nextVal = availableCounts.length > 0 ? availableCounts[0] : 10;
    } else {
      const next = availableCounts.find((c) => c > current);
      nextVal = next !== undefined ? next : Math.round(current + 10);
    }
    applyCountSearch(String(nextVal));
  };

  const handleStepDown = () => {
    const current = parseFloat(tempCount || countInput);
    if (isNaN(current) || (!tempCount && !countInput)) return;
    const prev = [...availableCounts].reverse().find((c) => c < current);
    let prevVal;
    if (prev !== undefined) {
      prevVal = prev;
    } else if (current > 10) {
      prevVal = Math.round(current - 10);
    } else {
      prevVal = '';
    }
    applyCountSearch(String(prevVal));
  };

  const handleWheelCount = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleStepUp();
    } else if (e.deltaY > 0) {
      handleStepDown();
    }
  };

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
    setTempCount('');
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
    <div className="space-y-4 max-w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Count Tracker</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary.totalFarmers} farmers · {summary.totalTanks} tanks matching target count
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filteredTanks.length === 0}
            className="btn-secondary btn-sm py-1.5 px-3 text-xs inline-flex items-center gap-1.5 rounded-lg border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition cursor-pointer"
            title="Export to Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-gray-500" />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Minimal Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Minimal Editable Target Count Card */}
        <div
          className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4 transition hover:border-blue-400 group relative"
          onWheel={handleWheelCount}
          title="Type count & press Enter to search, or scroll mouse wheel"
        >
          <span className="text-xs font-medium text-gray-500 block">Target Count</span>
          <div className="mt-1 flex items-center justify-between gap-1">
            <input
              type="number"
              step="any"
              min="0"
              value={tempCount}
              onChange={(e) => setTempCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyCountSearch(tempCount);
                }
              }}
              placeholder="All"
              className="text-xl sm:text-2xl font-bold text-gray-900 font-mono w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0 placeholder-gray-300"
            />
            {tempCount && (
              <button
                type="button"
                onClick={() => applyCountSearch('')}
                className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer rounded"
                title="Clear count"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Farmers</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {summary.totalFarmers}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Tanks</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {summary.totalTanks}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Total Biomass</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">
            {summary.totalBiomass}
          </p>
        </div>
      </div>

      {/* Filter Toolbar: Minimal & Clean */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Region */}
          <select
            value={regionFilter}
            onChange={(e) => {
              setRegionFilter(e.target.value);
              setAreaFilter('');
            }}
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 min-w-[120px] cursor-pointer"
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
            className="h-8 px-2.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400 min-w-[120px] cursor-pointer"
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
          <div className="relative flex-1 min-w-[170px]">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search farmer, tank..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full pl-8 pr-6 text-xs rounded-lg border border-gray-200 text-gray-900 bg-white placeholder-gray-400 hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400"
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
              className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer"
              title="Reset filters"
            >
              <XMarkIcon className="w-3.5 h-3.5 text-gray-400" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-xs text-gray-500">Loading records...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
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
        /* Minimal Table matching other pages */
        <div ref={tableRef} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-2xs scroll-mt-4">
          {/* Desktop & Tablet Table */}
          <div className="hidden sm:block w-full overflow-x-hidden">
            <table className="w-full text-left text-xs divide-y divide-gray-100">
              <thead className="bg-gray-50 text-gray-600 font-semibold text-[11px] uppercase tracking-wider border-b border-gray-100">
                <tr>
                  <th className="py-2.5 px-3 font-semibold w-10 text-center text-gray-400">No.</th>
                  <th className="py-2.5 px-3 font-semibold">Farmer</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold">Matching Tanks</th>
                  <th className="py-2.5 px-3 font-semibold text-center w-16">Total Tanks</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-24">Biomass</th>
                  <th className="py-2.5 px-3 font-semibold w-28">Tech</th>
                  <th className="py-2.5 px-3 font-semibold text-right w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {groupedFarmers.map((farmer, idx) => (
                  <tr key={farmer.client_id} className="hover:bg-gray-50/60 transition">
                    {/* No. */}
                    <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-[11px]">
                      {idx + 1}
                    </td>

                    {/* Farmer */}
                    <td className="py-2.5 px-3">
                      <Link
                        to={`/clients/${farmer.client_id}`}
                        className="font-semibold text-gray-900 hover:text-blue-600 transition block truncate max-w-[200px]"
                        title={farmer.company_name}
                      >
                        {farmer.company_name || farmer.farmer_name}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                        {farmer.farmer_phone ? (
                          <a href={`tel:${farmer.farmer_phone}`} className="hover:text-blue-600 font-mono">
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

                    {/* Matching Tanks with Count in minimal tag */}
                    <td className="py-2.5 px-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {farmer.tanks.map((tank) => (
                          <button
                            key={tank.id}
                            type="button"
                            onClick={() => setSelectedTank(tank)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-800 text-[11px] transition shadow-2xs cursor-pointer"
                            title="Click for tank details"
                          >
                            <span className="font-medium text-gray-900">
                              {tank.tank_number || tank.pond_name || `Tank ${tank.id}`}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-mono font-semibold text-[10px]">
                              Count: {tank.primary_count ?? countInput}
                            </span>
                            {tank.primary_biomass ? (
                              <span className="text-[10px] text-gray-500 font-mono">
                                ({tank.primary_biomass}kg)
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Tanks Count */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-medium bg-gray-100 text-gray-700">
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
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Layout */}
          <div className="sm:hidden divide-y divide-gray-100">
            {groupedFarmers.map((farmer, idx) => (
              <div key={farmer.client_id} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] text-gray-400 font-mono mr-1">{idx + 1}.</span>
                    <Link
                      to={`/clients/${farmer.client_id}`}
                      className="font-bold text-xs text-gray-900 hover:text-blue-600"
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
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-semibold shrink-0">
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
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[10px] text-gray-800"
                    >
                      <span>{tank.tank_number || tank.pond_name || `Tank ${tank.id}`}</span>
                      <span className="font-mono font-bold text-blue-600">Count: {tank.primary_count ?? countInput}</span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-100">
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

      {/* Tank Details Modal */}
      {selectedTank &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-lg w-full max-h-[90vh] overflow-y-auto relative z-10">
              <div className="p-3.5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <div>
                  <h3 className="font-bold text-sm text-gray-900">
                    {selectedTank.tank_number || selectedTank.pond_name || `Tank ${selectedTank.id}`}
                  </h3>
                  <p className="text-[11px] text-gray-500">
                    {selectedTank.company_name} · {selectedTank.village || selectedTank.district}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTank(null)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                {/* Highlight Count Banner */}
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                      Recorded Count
                    </span>
                    <p className="text-xl font-bold text-gray-900 font-mono mt-0.5">
                      {selectedTank.primary_count ?? '—'}
                    </p>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Source: {selectedTank.primary_source || 'Harvest Log'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-500 block">Biomass</span>
                    <span className="text-base font-bold text-gray-900 font-mono">
                      {selectedTank.primary_biomass ? `${selectedTank.primary_biomass} kg` : '—'}
                    </span>
                  </div>
                </div>

                {/* Farmer Info */}
                <div className="p-2.5 rounded-lg border border-gray-100 bg-white space-y-1.5">
                  <span className="font-semibold text-gray-900 block text-[11px]">Farmer Information</span>
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
                    <span className="font-semibold text-gray-900 block text-[11px]">Count Log Sessions</span>
                    <div className="rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-gray-50 text-gray-700 font-medium border-b border-gray-100">
                          <tr>
                            <th className="py-1.5 px-2 font-semibold">Source</th>
                            <th className="py-1.5 px-2 font-semibold">Count</th>
                            <th className="py-1.5 px-2 font-semibold">DOC</th>
                            <th className="py-1.5 px-2 font-semibold">ABW (g)</th>
                            <th className="py-1.5 px-2 font-semibold">Biomass (kg)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {selectedTank.counts_records.map((cr, idx) => (
                            <tr key={idx}>
                              <td className="py-1.5 px-2 text-gray-700">{cr.source}</td>
                              <td className="py-1.5 px-2 font-bold font-mono text-gray-900">{cr.count}</td>
                              <td className="py-1.5 px-2 font-mono text-gray-600">{cr.doc || '—'}</td>
                              <td className="py-1.5 px-2 font-mono text-gray-600">{cr.abw || '—'}</td>
                              <td className="py-1.5 px-2 font-mono text-gray-600">{cr.biomass ? `${cr.biomass} kg` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                <Link
                  to={`/clients/${selectedTank.client_id}`}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Go to Farmer Page →
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedTank(null)}
                  className="btn-secondary btn-sm py-1 px-2.5 text-xs rounded-lg border-gray-200 bg-white text-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
