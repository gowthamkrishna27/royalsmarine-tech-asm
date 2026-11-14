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
  ScaleIcon,
  CheckBadgeIcon,
  ChartBarIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const fmt = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v);

export default function FcrTracker() {
  const [docInput, setDocInput] = useState('');
  const [search, setSearch] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['fcr-tanks', search],
    queryFn: () =>
      clientService
        .getFcrTanks({ search: search || undefined })
        .then((r) => r.data.data || []),
  });

  // Calculate high-level summary metrics across harvested tanks
  const summary = useMemo(() => {
    const totalTanks = tanks.length;
    let totalBiomass = 0;
    let fcrSum = 0;
    let fcrCount = 0;
    let docSum = 0;
    let docCount = 0;

    tanks.forEach((t) => {
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
  }, [tanks]);

  const availableDocs = useMemo(() => {
    const docs = new Set();
    tanks.forEach((t) => {
      const d = t.harvest_doc || t.final_harvest?.doc || t.current_doc;
      if (d !== undefined && d !== null && !isNaN(d)) docs.add(parseInt(d, 10));
    });
    return Array.from(docs).sort((a, b) => a - b);
  }, [tanks]);

  const filteredTanks = useMemo(() => {
    if (!docInput.trim()) return tanks;
    const target = parseInt(docInput, 10);
    if (Number.isNaN(target)) return tanks;
    return tanks.filter((t) => {
      const h = parseInt(t.harvest_doc || t.final_harvest?.doc, 10);
      const c = parseInt(t.current_doc, 10);
      const p = parseInt(t.doc, 10);
      const v = t.recorded_docs || [];
      return h === target || c === target || p === target || v.includes(target);
    });
  }, [tanks, docInput]);

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
      } catch (e) {
        toast.error('Failed to export FCR report');
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-gray-900">FCR Tracker</h1>
          </div>
        </div>

        {/* Action button: Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || filteredTanks.length === 0}
            className="btn-secondary btn-sm inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
            title="Export FCR data to Excel"
          >
            <ArrowDownTrayIcon className="h-4 w-4 text-gray-600" />
            <span>{exporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Harvested Tanks</span>
          <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{summary.totalTanks}</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50/40 p-3.5 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-sky-800/80">Average FCR</span>
          <p className="mt-1 text-xl font-bold text-sky-900 tabular-nums">{summary.avgFcr}</p>
        </div>
        <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Total Biomass</span>
          <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{summary.totalBiomass}</p>
        </div>
        <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Avg Harvest DOC</span>
          <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{summary.avgDoc}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-lg border border-sky-100 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-xs font-medium uppercase tracking-wide text-sky-700/70">DOC</label>
            <div className="relative w-full sm:w-28">
              <input
                type="number"
                min="0"
                inputMode="numeric"
                placeholder="Any"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                className="input py-1.5 pr-8 text-sm"
                aria-label="Filter by DOC"
              />
              {docInput && (
                <button
                  type="button"
                  onClick={() => setDocInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label="Clear DOC"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            {availableDocs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDocInput('')}
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition ${!docInput ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-100 bg-sky-50/50 text-sky-700 hover:border-sky-200 hover:bg-sky-50'
                    }`}
                >
                  All
                </button>
                {availableDocs.slice(0, 8).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDocInput(String(d))}
                    className={`rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition ${docInput === String(d)
                        ? 'border-sky-600 bg-sky-600 text-white'
                        : 'border-sky-100 bg-sky-50/50 text-sky-700 hover:border-sky-200 hover:bg-sky-50'
                      }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-64">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search farmer or tank"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input w-full py-1.5 pl-8 text-sm"
                aria-label="Search"
              />
            </div>
            <span className="shrink-0 text-xs text-gray-500 tabular-nums">{filteredTanks.length} shown</span>
          </div>
        </div>
      </div>

      {/* Table Content Area */}
      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-sm text-gray-500">Loading harvested tanks</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-medium text-gray-900">Could not load FCR data</p>
          <p className="mt-1 text-xs text-gray-500">{error.message}</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm mt-3">Retry</button>
        </div>
      ) : filteredTanks.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white">
          <EmptyState
            icon={ScaleIcon}
            title="No harvested tanks found"
            description={
              docInput
                ? `No tanks with completed final harvest match DOC ${docInput}. Clear the filter to see all.`
                : 'Tanks and farmer details will appear here once the tank completes final harvest.'
            }
            action={docInput ? <button type="button" onClick={() => setDocInput('')} className="btn-secondary btn-sm">Clear filter</button> : null}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-sky-100 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-sky-100 bg-sky-50/60 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tank</th>
                  <th className="px-4 py-2.5 font-medium">Farmer</th>
                  <th className="px-4 py-2.5 font-medium">Harvest DOC</th>
                  <th className="px-4 py-2.5 font-medium">Final FCR</th>
                  <th className="px-4 py-2.5 font-medium">ABW</th>
                  <th className="px-4 py-2.5 font-medium">Biomass</th>
                  <th className="px-4 py-2.5 font-medium">Survival</th>
                  <th className="px-4 py-2.5 font-medium">Harvest Date</th>
                  <th className="px-4 py-2.5 font-medium">Area</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
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
                    <tr key={tank.id} className="hover:bg-gray-50/60 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}</div>
                        <div className="text-xs text-gray-400">ID {tank.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/clients/${tank.client_id}`} className="font-medium text-sky-800 hover:underline">
                          {fmt(tank.company_name)}
                        </Link>
                        <div className="text-xs text-gray-500">{fmt(tank.farmer_phone || tank.village)}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                          {harvestDoc ? `DOC ${harvestDoc}` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-bold text-gray-900">
                        {fcrVal ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                            {fcrVal}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{abwVal ? `${abwVal} g` : '—'}</td>
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
                          className="rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100 hover:text-sky-900 transition"
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

function Detail({ label, value, highlight = false }) {
  return (
    <div className={highlight ? 'rounded-lg bg-sky-50/70 p-2.5 border border-sky-100' : ''}>
      <dt className={`text-[11px] uppercase tracking-wide ${highlight ? 'font-semibold text-sky-800' : 'text-gray-500'}`}>
        {label}
      </dt>
      <dd className={`mt-0.5 text-sm font-medium ${highlight ? 'text-sky-950 font-bold' : 'text-gray-900'}`}>
        {value}
      </dd>
    </div>
  );
}

function TankModal({ tank, onClose }) {
  const fh = tank.final_harvest || tank.harvest_info?.final_harvest || {};
  const lf = tank.latest_feeding || {};
  const visits = Array.isArray(tank.visits) ? tank.visits : [];
  const harvestDoc = tank.harvest_doc || fh.doc || tank.current_doc;
  const fcrVal = fh.fcr || tank.fcr || lf.fcr;
  const abwVal = fh.abw || tank.abw || lf.abw;
  const biomassVal = fh.total_biomass || fh.harvested_biomass || tank.total_biomass;
  const survivalVal = fh.survival_rate || tank.survival_rate;
  const harvestDate = fh.date || tank.harvest_date;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4 backdrop-blur-xs" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white sm:max-w-2xl sm:rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-sky-100 bg-sky-50/50 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="truncate text-base font-bold text-gray-900">{fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <CheckBadgeIcon className="h-3.5 w-3.5" /> Final Harvest Completed
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5">
              <span className="font-semibold text-sky-800">Harvest DOC {harvestDoc ?? '—'}</span> • {fmt(tank.company_name)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-5">
          {/* Final Harvest & FCR Performance Block */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700 flex items-center gap-1.5">
              <ChartBarIcon className="h-4 w-4 text-sky-600" /> Final Harvest &amp; FCR Details
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Detail label="Final FCR" value={fmt(fcrVal)} highlight />
              <Detail label="Harvest DOC" value={harvestDoc ? `${harvestDoc} Days` : '—'} highlight />
              <Detail label="Final ABW" value={abwVal ? `${abwVal} g` : '—'} highlight />
              <Detail
                label="Total Biomass"
                value={biomassVal ? `${Math.round(parseFloat(biomassVal)).toLocaleString()} kg` : '—'}
                highlight
              />
              <Detail label="Harvest Date" value={harvestDate ? String(harvestDate).slice(0, 10) : '—'} />
              <Detail
                label="Survival Rate"
                value={survivalVal ? (String(survivalVal).includes('%') ? survivalVal : `${survivalVal}%`) : '—'}
              />
              <Detail label="Harvest Qty" value={fh.harvested_quantity ? Number(fh.harvested_quantity).toLocaleString() : (fh.count ? String(fh.count) : '—')} />
              <Detail label="Feed Type" value={fmt(tank.feed_type)} />
            </dl>
            {fh.remarks && (
              <div className="mt-2.5 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-600 border border-gray-100">
                <span className="font-semibold text-gray-700">Harvest Remarks: </span>
                {fh.remarks}
              </div>
            )}
          </div>

          {/* Farmer & Tank Overview */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Farmer &amp; Tank Info</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg border border-gray-100 bg-gray-50/50 p-3 sm:grid-cols-3 text-sm">
              <Detail label="Farmer" value={fmt(tank.company_name)} />
              <Detail label="Mobile" value={fmt(tank.farmer_phone)} />
              <Detail label="Location" value={fmt([tank.village, tank.district].filter(Boolean).join(', '))} />
              <Detail label="Area" value={`${Number(tank.area_acres || tank.area || 0).toFixed(2)} ac`} />
              <Detail label="Seed Date" value={tank.seed_date ? String(tank.seed_date).slice(0, 10) : '—'} />
              <Detail label="Stocking" value={tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} Lakhs` : '—'} />
            </dl>
          </div>

          {/* Visits History */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-700">Visits Logged ({visits.length})</h3>
            {visits.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No visits logged.</p>
            ) : (
              <ul className="mt-2 max-h-48 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200">
                {visits.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-gray-50">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">{v.visit_date}</span>
                      <span className="text-gray-500"> • {fmt(v.salesperson_name, 'Technical Exec')}</span>
                      {v.feeding_details?.fcr && <span className="text-gray-600 tabular-nums"> • FCR {v.feeding_details.fcr}</span>}
                    </div>
                    <Link to={`/visits/${v.id}`} className="shrink-0 font-medium text-sky-700 hover:text-sky-900">View</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 bg-gray-50/40">
          <Link to={`/clients/${tank.client_id}`} className="text-sm font-semibold text-sky-700 hover:text-sky-900">
            Open farmer profile →
          </Link>
          <button type="button" onClick={onClose} className="btn-secondary btn-sm w-full sm:w-auto">Close</button>
        </div>
      </div>
    </div>
  );
}
