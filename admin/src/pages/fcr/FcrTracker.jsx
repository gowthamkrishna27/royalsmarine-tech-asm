import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  TableCellsIcon,
  Squares2X2Icon,
  ScaleIcon,
} from '@heroicons/react/24/outline';

const fmt = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v);

export default function FcrTracker() {
  const [docInput, setDocInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table');
  const [selectedTank, setSelectedTank] = useState(null);

  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['fcr-tanks', search],
    queryFn: () =>
      clientService
        .getFcrTanks({ search: search || undefined })
        .then((r) => r.data.data || []),
  });

  const availableDocs = useMemo(() => {
    const docs = new Set();
    tanks.forEach((t) => {
      if (t.current_doc !== undefined && t.current_doc !== null) docs.add(parseInt(t.current_doc, 10));
    });
    return Array.from(docs).sort((a, b) => a - b);
  }, [tanks]);

  const filteredTanks = useMemo(() => {
    if (!docInput.trim()) return tanks;
    const target = parseInt(docInput, 10);
    if (Number.isNaN(target)) return tanks;
    return tanks.filter((t) => {
      const c = parseInt(t.current_doc, 10);
      const p = parseInt(t.doc, 10);
      const v = t.recorded_docs || [];
      return c === target || p === target || v.includes(target);
    });
  }, [tanks, docInput]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">FCR</h1>
          <p className="text-sm text-gray-500">Track feed conversion by tank and DOC.</p>
        </div>
        <div className="inline-flex self-start rounded-lg border border-sky-100 bg-sky-50/50 p-0.5">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              viewMode === 'table' ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-700/70 hover:text-sky-800 hover:bg-sky-100/60'
            }`}
            aria-pressed={viewMode === 'table'}
          >
            <TableCellsIcon className="h-4 w-4" /> <span className="hidden sm:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              viewMode === 'grid' ? 'bg-sky-600 text-white shadow-sm' : 'text-sky-700/70 hover:text-sky-800 hover:bg-sky-100/60'
            }`}
            aria-pressed={viewMode === 'grid'}
          >
            <Squares2X2Icon className="h-4 w-4" /> <span className="hidden sm:inline">Cards</span>
          </button>
        </div>
      </div>

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
                  className={`rounded-md border px-2 py-1 text-xs font-medium transition ${
                    !docInput ? 'border-sky-600 bg-sky-600 text-white' : 'border-sky-100 bg-sky-50/50 text-sky-700 hover:border-sky-200 hover:bg-sky-50'
                  }`}
                >
                  All
                </button>
                {availableDocs.slice(0, 8).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDocInput(String(d))}
                    className={`rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition ${
                      docInput === String(d)
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

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-sm text-gray-500">Loading tanks</p>
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
            title="No tanks found"
            description={docInput ? `No tanks match DOC ${docInput}. Clear the filter to see all tanks.` : 'No tank data is available yet.'}
            action={docInput ? <button type="button" onClick={() => setDocInput('')} className="btn-secondary btn-sm">Clear filter</button> : null}
          />
        </div>
      ) : viewMode === 'table' ? (
        <div className="overflow-hidden rounded-lg border border-sky-100 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-sky-100 bg-sky-50/60 text-xs font-medium uppercase tracking-wide text-sky-800/70">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Tank</th>
                  <th className="px-4 py-2.5 font-medium">Farmer</th>
                  <th className="px-4 py-2.5 font-medium">DOC</th>
                  <th className="px-4 py-2.5 font-medium">FCR</th>
                  <th className="px-4 py-2.5 font-medium">ABW</th>
                  <th className="px-4 py-2.5 font-medium">Stocking</th>
                  <th className="px-4 py-2.5 font-medium">Feed</th>
                  <th className="px-4 py-2.5 font-medium">Area</th>
                  <th className="px-4 py-2.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTanks.map((tank) => {
                  const currentDoc = tank.current_doc;
                  const fcrVal = tank.latest_feeding?.fcr || tank.fcr;
                  const abwVal = tank.latest_feeding?.abw || tank.abw;
                  return (
                    <tr key={tank.id} className="hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}</div>
                        <div className="text-xs text-gray-400">ID {tank.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Link to={`/clients/${tank.client_id}`} className="font-medium text-gray-900 hover:underline">
                          {fmt(tank.company_name)}
                        </Link>
                        <div className="text-xs text-gray-500">{fmt(tank.farmer_phone || tank.village)}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{currentDoc ?? '—'}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium text-gray-900">{fmt(fcrVal)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{abwVal ? `${abwVal} g` : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="tabular-nums text-gray-900">{tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} L` : '—'}</div>
                        <div className="text-xs text-gray-400">{tank.seed_date ? String(tank.seed_date).slice(0, 10) : '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmt(tank.feed_type)}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-700">{Number(tank.area_acres || tank.area || 0).toFixed(2)} ac</td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => setSelectedTank(tank)} className="text-sm font-medium text-sky-700 hover:text-sky-900">
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
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredTanks.map((tank) => {
            const currentDoc = tank.current_doc;
            const fcrVal = tank.latest_feeding?.fcr || tank.fcr;
            const abwVal = tank.latest_feeding?.abw || tank.abw;
            return (
              <article key={tank.id} className="rounded-lg border border-sky-100 bg-white p-4 transition hover:border-sky-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-medium text-gray-900">{fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}</h3>
                    <Link to={`/clients/${tank.client_id}`} className="block truncate text-sm text-gray-600 hover:text-sky-700">
                      {fmt(tank.company_name)}
                    </Link>
                  </div>
                  <span className="shrink-0 rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium tabular-nums text-sky-700">
                    DOC {currentDoc ?? '—'}
                  </span>
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-gray-100 pt-3 text-center">
                  <div><dt className="text-[11px] uppercase tracking-wide text-gray-500">FCR</dt><dd className="mt-0.5 font-medium tabular-nums text-gray-900">{fmt(fcrVal)}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-gray-500">ABW</dt><dd className="mt-0.5 font-medium tabular-nums text-gray-900">{abwVal ? `${abwVal}g` : '—'}</dd></div>
                  <div><dt className="text-[11px] uppercase tracking-wide text-gray-500">Area</dt><dd className="mt-0.5 font-medium tabular-nums text-gray-900">{Number(tank.area_acres || tank.area || 0).toFixed(2)}</dd></div>
                </dl>
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate">{fmt(tank.feed_type, 'Feed —')}</span>
                  <button type="button" onClick={() => setSelectedTank(tank)} className="shrink-0 font-medium text-sky-700 hover:text-sky-900">Details</button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedTank && <TankModal tank={selectedTank} onClose={() => setSelectedTank(null)} />}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value}</dd>
    </div>
  );
}

function TankModal({ tank, onClose }) {
  const currentDoc = tank.current_doc;
  const lf = tank.latest_feeding || {};
  const visits = Array.isArray(tank.visits) ? tank.visits : [];
  const fcrVal = lf.fcr || tank.fcr;
  const abwVal = lf.abw || tank.abw;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose} role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-xl bg-white sm:max-w-2xl sm:rounded-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-sky-100 bg-sky-50/40 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-gray-900">{fmt(tank.tank_number || tank.pond_name, `Tank #${tank.id}`)}</h2>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-sky-700">DOC {currentDoc ?? '—'}</span> · {fmt(tank.company_name)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Close">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-4 sm:px-5">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            <Detail label="Farmer" value={fmt(tank.company_name)} />
            <Detail label="Mobile" value={fmt(tank.farmer_phone)} />
            <Detail label="Location" value={fmt([tank.village, tank.district].filter(Boolean).join(', '))} />
            <Detail label="Area" value={`${Number(tank.area_acres || tank.area || 0).toFixed(2)} ac`} />
            <Detail label="Seed date" value={tank.seed_date ? String(tank.seed_date).slice(0, 10) : '—'} />
            <Detail label="Stocking" value={tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} L` : '—'} />
          </dl>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Feeding</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 rounded-lg border border-sky-100 bg-sky-50/30 p-3 sm:grid-cols-4">
              <Detail label="FCR" value={fmt(fcrVal)} />
              <Detail label="ABW" value={abwVal ? `${abwVal} g` : '—'} />
              <Detail label="Daily feed" value={lf.daily_feed_quantity ? `${lf.daily_feed_quantity} kg` : '—'} />
              <Detail label="Feed" value={fmt(tank.feed_type)} />
            </dl>
          </div>

          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-gray-500">Visits ({visits.length})</h3>
            {visits.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No visits logged.</p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {visits.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900">{v.visit_date}</span>
                      <span className="text-gray-500"> · {fmt(v.salesperson_name, 'Technical Exec')}</span>
                      {v.feeding_details?.fcr && <span className="text-gray-600 tabular-nums"> · FCR {v.feeding_details.fcr}</span>}
                    </div>
                    <Link to={`/visits/${v.id}`} className="shrink-0 font-medium text-sky-700 hover:text-sky-900">View</Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <Link to={`/clients/${tank.client_id}`} className="text-sm font-medium text-sky-700 hover:text-sky-900">Open farmer profile</Link>
          <button type="button" onClick={onClose} className="btn-secondary btn-sm w-full sm:w-auto">Close</button>
        </div>
      </div>
    </div>
  );
}
