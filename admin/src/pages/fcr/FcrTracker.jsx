import { useState, useMemo } from 'react';
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
  ScaleIcon,
  CheckBadgeIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

const fmt = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v);

export default function FcrTracker() {
  const [docInput, setDocInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Fetch all tanks once; client-side filtering handles search & DOC reactively with zero lag
  const { data: tanks = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['fcr-tanks'],
    queryFn: () =>
      clientService
        .getFcrTanks()
        .then((r) => r.data.data || []),
  });

  // Extract all distinct DOC values available across the harvested tanks
  const availableDocs = useMemo(() => {
    const docs = new Set();
    tanks.forEach((t) => {
      const d = t.harvest_doc || t.final_harvest?.doc || t.current_doc;
      if (d !== undefined && d !== null && !isNaN(d)) docs.add(parseInt(d, 10));
    });
    return Array.from(docs).sort((a, b) => a - b);
  }, [tanks]);

  // Reactive instant filtering by DOC and search keyword
  const filteredTanks = useMemo(() => {
    let result = tanks;

    // Filter by DOC
    if (docInput.trim()) {
      const target = parseInt(docInput, 10);
      if (!Number.isNaN(target)) {
        result = result.filter((t) => {
          const h = parseInt(t.harvest_doc || t.final_harvest?.doc, 10);
          const c = parseInt(t.current_doc, 10);
          const p = parseInt(t.doc, 10);
          const v = t.recorded_docs || [];
          return h === target || c === target || p === target || v.includes(target);
        });
      }
    }

    // Filter by search text (farmer name, tank number, phone, village, district, feed type)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => {
        const tankNum = String(t.tank_number || t.pond_name || `Tank #${t.id}`).toLowerCase();
        const company = String(t.company_name || '').toLowerCase();
        const contact = String(t.contact_person || '').toLowerCase();
        const phone = String(t.farmer_phone || '').toLowerCase();
        const village = String(t.village || '').toLowerCase();
        const district = String(t.district || '').toLowerCase();
        const feed = String(t.feed_type || '').toLowerCase();
        return (
          tankNum.includes(q) ||
          company.includes(q) ||
          contact.includes(q) ||
          phone.includes(q) ||
          village.includes(q) ||
          district.includes(q) ||
          feed.includes(q)
        );
      });
    }

    return result;
  }, [tanks, docInput, search]);

  // Reactive summary metrics calculated directly from the filtered tanks
  const summary = useMemo(() => {
    const totalTanks = filteredTanks.length;
    let totalBiomass = 0;
    let fcrSum = 0;
    let fcrCount = 0;
    let docSum = 0;
    let docCount = 0;

    filteredTanks.forEach((t) => {
      const b = parseFloat(t.total_biomass || t.final_harvest?.total_biomass || t.final_harvest?.harvested_biomass || 0);
      if (!isNaN(b) && b > 0) totalBiomass += b;

      const f = parseFloat(t.fcr || t.final_harvest?.fcr || t.latest_feeding?.fcr || 0);
      if (!isNaN(f) && f > 0) {
        fcrSum += f;
        fcrCount += 1;
      }

      const d = parseInt(t.harvest_doc || t.final_harvest?.doc || t.current_doc, 10);
      if (!isNaN(d) && d > 0) {
        docSum += d;
        docCount += 1;
      }
    });

    return {
      totalTanks,
      avgFcr: fcrCount > 0 ? (fcrSum / fcrCount).toFixed(2) : '—',
      totalBiomass: totalBiomass > 0 ? `${Math.round(totalBiomass).toLocaleString()} kg` : '—',
      avgDoc: docCount > 0 ? `${Math.round(docSum / docCount)}d` : '—',
    };
  }, [filteredTanks]);

  const hasActiveFilters = Boolean(docInput || search);

  const handleResetFilters = () => {
    setDocInput('');
    setSearch('');
  };

  // Export handler with fallback to client-side CSV
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await clientService.exportFcr({
        search: search || undefined,
        doc: docInput || undefined,
      });
      downloadBlob(res.data, 'fcr-report.xlsx');
      toast.success('FCR report exported successfully');
    } catch {
      // Client-side fallback to CSV if backend export fails
      try {
        const headers = [
          'Tank Name/Number',
          'Farmer / Company',
          'Contact Person',
          'Mobile',
          'Village',
          'District',
          'Harvest DOC',
          'Final FCR',
          'Final ABW (g)',
          'Biomass (kg)',
          'Survival Rate',
          'Harvest Date',
          'Area (Acres)',
          'Stocking (Lakhs)',
          'Feed Type',
        ];

        const rows = filteredTanks.map((t) => {
          const fh = t.final_harvest || {};
          const lf = t.latest_feeding || {};
          const hDoc = t.harvest_doc || fh.doc || t.current_doc || '';
          const fcr = fh.fcr || t.fcr || lf.fcr || '';
          const abw = fh.abw || t.abw || lf.abw || '';
          const biomass = fh.total_biomass || fh.harvested_biomass || t.total_biomass || '';
          const survival = fh.survival_rate || t.survival_rate || '';
          const hDate = fh.date || t.harvest_date || '';
          const area = Number(t.area_acres || t.area || 0).toFixed(2);

          return [
            `"${(t.tank_number || t.pond_name || `Tank #${t.id}`).replace(/"/g, '""')}"`,
            `"${(t.company_name || '').replace(/"/g, '""')}"`,
            `"${(t.contact_person || '').replace(/"/g, '""')}"`,
            `"${(t.farmer_phone || '').replace(/"/g, '""')}"`,
            `"${(t.village || '').replace(/"/g, '""')}"`,
            `"${(t.district || '').replace(/"/g, '""')}"`,
            `"${hDoc}"`,
            `"${fcr}"`,
            `"${abw}"`,
            `"${biomass}"`,
            `"${survival}"`,
            `"${hDate ? String(hDate).slice(0, 10) : ''}"`,
            `"${area}"`,
            `"${t.stocking_quantity_lakhs || ''}"`,
            `"${(t.feed_type || '').replace(/"/g, '""')}"`,
          ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        downloadBlob(new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }), 'fcr-report.csv');
        toast.success('FCR report exported (CSV)');
      } catch {
        toast.error('Failed to export FCR report');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">FCR Tracker</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {summary.totalTanks} harvested tanks {hasActiveFilters ? 'matching filters' : 'recorded'}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary btn-sm py-1.5 px-3 text-xs inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition cursor-pointer"
            title="Refresh data"
          >
            <ArrowPathIcon className={`h-3.5 w-3.5 text-gray-500 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filteredTanks.length === 0}
            className="btn-secondary btn-sm py-1.5 px-3 text-xs inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium transition cursor-pointer disabled:opacity-50"
            title="Export FCR data to Excel"
          >
            <ArrowDownTrayIcon className="h-3.5 w-3.5 text-gray-500" />
            <span>{exporting ? 'Exporting...' : 'Export Excel'}</span>
          </button>
        </div>
      </div>

      {/* Minimal Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Harvested Tanks</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{summary.totalTanks}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Average FCR</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{summary.avgFcr}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Total Biomass</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{summary.totalBiomass}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-3 sm:p-4">
          <span className="text-xs font-medium text-gray-500 block">Avg Harvest DOC</span>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 tabular-nums mt-1">{summary.avgDoc}</p>
        </div>
      </div>

      {/* Filter and Search Bar: Minimal & Clean */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-2.5 sm:p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* DOC Filter & Quick Select Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">DOC:</span>
            <div className="relative w-28">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Any DOC"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                aria-label="Filter by DOC"
              />
              {docInput && (
                <button
                  type="button"
                  onClick={() => setDocInput('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  aria-label="Clear DOC"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {availableDocs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDocInput('')}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    !docInput
                      ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  All
                </button>
                {availableDocs.slice(0, 8).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDocInput(String(d))}
                    className={`rounded-lg px-2 py-1 text-xs font-medium tabular-nums transition cursor-pointer ${
                      docInput === String(d)
                        ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Box & Controls */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search farmer, tank, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white pl-8 pr-7 py-1 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
                aria-label="Search"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-7 px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1 transition cursor-pointer shrink-0"
                title="Reset filters"
              >
                <XMarkIcon className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}

            <span className="shrink-0 text-xs text-gray-400 tabular-nums">
              {filteredTanks.length} shown
            </span>
          </div>
        </div>
      </div>

      {/* Table Content Area */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-xs text-gray-500">Loading harvested tanks...</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-gray-900">Could not load FCR data</p>
          <p className="mt-1 text-xs text-gray-500">{error.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary btn-sm mt-3"
          >
            Retry
          </button>
        </div>
      ) : filteredTanks.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white">
          <EmptyState
            icon={ScaleIcon}
            title="No harvested tanks found"
            description={
              hasActiveFilters
                ? 'No tanks match the selected filters. Clear the filter to see all.'
                : 'Tanks and farmer details will appear here once the tank completes final harvest.'
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn-secondary btn-sm"
                >
                  Clear filters
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50/75 text-xs font-semibold uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Tank</th>
                  <th className="px-4 py-2.5 font-semibold">Farmer</th>
                  <th className="px-4 py-2.5 font-semibold">Harvest DOC</th>
                  <th className="px-4 py-2.5 font-semibold">Final FCR</th>
                  <th className="px-4 py-2.5 font-semibold">ABW</th>
                  <th className="px-4 py-2.5 font-semibold">Biomass</th>
                  <th className="px-4 py-2.5 font-semibold">Survival</th>
                  <th className="px-4 py-2.5 font-semibold">Harvest Date</th>
                  <th className="px-4 py-2.5 font-semibold">Area</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTanks.map((tank) => {
                  const fh = tank.final_harvest || tank.harvest_info?.final_harvest || {};
                  const lf = tank.latest_feeding || {};
                  const harvestDoc = tank.harvest_doc || fh.doc || tank.current_doc;
                  const fcrVal = fh.fcr || tank.fcr || lf.fcr;
                  const abwVal = fh.abw || tank.abw || lf.abw;
                  const biomassVal = fh.total_biomass || fh.harvested_biomass || tank.total_biomass;
                  const survivalVal = fh.survival_rate || tank.survival_rate;
                  const harvestDate = fh.date || tank.harvest_date;

                  return (
                    <tr key={tank.id} className="hover:bg-gray-50/80 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">
                          {fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}
                        </div>
                        <div className="text-xs text-gray-400">ID {tank.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/clients/${tank.client_id}`}
                          className="font-semibold text-gray-900 hover:text-blue-600 transition"
                        >
                          {fmt(tank.company_name)}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {fmt(tank.farmer_phone || tank.village)}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          {harvestDoc ? `DOC ${harvestDoc}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold text-gray-900">
                        {fcrVal ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                            {fcrVal}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {abwVal ? `${abwVal} g` : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {biomassVal ? `${Math.round(parseFloat(biomassVal)).toLocaleString()} kg` : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-emerald-700 font-medium">
                        {survivalVal ? (String(survivalVal).includes('%') ? survivalVal : `${survivalVal}%`) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {harvestDate ? String(harvestDate).slice(0, 10) : '—'}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">
                        {Number(tank.area_acres || tank.area || 0).toFixed(2)} ac
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTank(tank)}
                          className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition shadow-2xs cursor-pointer"
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
        </div>
      )}

      {selectedTank && <TankModal tank={selectedTank} onClose={() => setSelectedTank(null)} />}
    </div>
  );
}

function TankModal({ tank, onClose }) {
  const fh = tank.final_harvest || tank.harvest_info?.final_harvest || {};
  const lf = tank.latest_feeding || {};
  const harvestDoc = tank.harvest_doc || fh.doc || tank.current_doc;
  const fcrVal = fh.fcr || tank.fcr || lf.fcr;
  const abwVal = fh.abw || tank.abw || lf.abw;
  const biomassVal = fh.total_biomass || fh.harvested_biomass || tank.total_biomass;
  const survivalVal = fh.survival_rate || tank.survival_rate;
  const harvestDate = fh.date || tank.harvest_date;

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-gray-900">
                {fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <CheckBadgeIcon className="h-3 w-3" /> Harvested
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {fmt(tank.company_name)} · {fmt([tank.village, tank.district].filter(Boolean).join(', '))}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition cursor-pointer"
            aria-label="Close"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body: Minimal & Clean */}
        <div className="p-4 space-y-3 text-xs">
          {/* Key FCR & Harvest Highlight Card */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
                Final FCR
              </span>
              <p className="text-2xl font-bold text-gray-900 font-mono mt-0.5">
                {fmt(fcrVal)}
              </p>
              <span className="text-[11px] text-gray-500 block mt-0.5 font-medium">
                DOC: <strong className="text-gray-800">{harvestDoc ? `${harvestDoc}d` : '—'}</strong>
              </span>
            </div>
            <div className="text-right space-y-1">
              <div>
                <span className="text-[10px] text-gray-500 block uppercase">Biomass</span>
                <span className="text-base font-bold text-gray-900 font-mono">
                  {biomassVal ? `${Math.round(parseFloat(biomassVal)).toLocaleString()} kg` : '—'}
                </span>
              </div>
              <div className="text-[11px] text-gray-500">
                ABW: <strong className="text-gray-800">{abwVal ? `${abwVal}g` : '—'}</strong>
              </div>
            </div>
          </div>

          {/* Minimal Key Details Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg border border-gray-100 bg-white">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">Harvest Date</span>
              <p className="text-xs font-semibold text-gray-800 mt-0.5">
                {harvestDate ? String(harvestDate).slice(0, 10) : '—'}
              </p>
            </div>
            <div className="p-2.5 rounded-lg border border-gray-100 bg-white">
              <span className="text-[10px] uppercase font-semibold text-gray-400 block">Survival Rate</span>
              <p className="text-xs font-semibold text-emerald-700 mt-0.5">
                {survivalVal ? (String(survivalVal).includes('%') ? survivalVal : `${survivalVal}%`) : '—'}
              </p>
            </div>
          </div>

          {/* Farmer Contact Info */}
          <div className="p-3 rounded-lg border border-gray-100 bg-white space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 block">Farmer Information</span>
            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="font-semibold text-gray-900">{fmt(tank.company_name)}</span>
              {tank.farmer_phone ? (
                <a
                  href={`tel:${tank.farmer_phone}`}
                  className="font-mono text-blue-600 hover:text-blue-800 font-medium"
                >
                  {tank.farmer_phone}
                </a>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </div>
          </div>

          {fh.remarks && (
            <div className="p-2.5 rounded-lg bg-gray-50 text-xs text-gray-600 border border-gray-100">
              <span className="font-semibold text-gray-700">Remarks: </span>
              {fh.remarks}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <Link
            to={`/clients/${tank.client_id}`}
            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
          >
            Go to Farmer Page →
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
}
