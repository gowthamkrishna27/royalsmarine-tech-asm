import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import {
  ScaleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  TableCellsIcon,
  Squares2X2Icon,
  ArrowTopRightOnSquareIcon,
  PhoneIcon,
  MapPinIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

export default function FcrTracker() {
  const [docInput, setDocInput] = useState('');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'grid'
  const [selectedTank, setSelectedTank] = useState(null);

  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['fcr-tanks', search],
    queryFn: () =>
      clientService
        .getFcrTanks({
          search: search || undefined,
        })
        .then((r) => r.data.data || []),
  });

  // Extract distinct DOC values from current tanks
  const availableDocs = useMemo(() => {
    const docs = new Set();
    tanks.forEach((t) => {
      if (t.current_doc !== undefined && t.current_doc !== null) {
        docs.add(parseInt(t.current_doc, 10));
      }
    });
    return Array.from(docs).sort((a, b) => a - b);
  }, [tanks]);

  // Filter tanks by DOC input
  const filteredTanks = useMemo(() => {
    if (!docInput.trim()) return tanks;
    const targetDoc = parseInt(docInput, 10);
    if (isNaN(targetDoc)) return tanks;

    return tanks.filter((t) => {
      const cDoc = parseInt(t.current_doc, 10);
      const pDoc = parseInt(t.doc, 10);
      const visitDocs = t.recorded_docs || [];
      return cDoc === targetDoc || pDoc === targetDoc || visitDocs.includes(targetDoc);
    });
  }, [tanks, docInput]);

  return (
    <div className="space-y-4 fade-in">
      {/* Top Header */}
      <div className="page-header mb-0">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <span>FCR</span>
            <span className="text-xs font-normal text-gray-400 font-mono"></span>
          </h1>
          <p className="text-xs text-gray-500"></p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${viewMode === 'table' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-900'
                }`}
              title="Table View"
            >
              <TableCellsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs flex items-center gap-1 transition ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-2xs font-semibold' : 'text-gray-500 hover:text-gray-900'
                }`}
              title="Grid View"
            >
              <Squares2X2Icon className="w-4 h-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>
      </div>

      {/* Minimal Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* DOC Input */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">DOC:</span>
            <div className="relative">
              <input
                type="number"
                min="0"
                placeholder="Enter DOC..."
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                className="input py-1.5 px-3 text-sm font-bold font-mono text-emerald-900 w-32 bg-gray-50 border-gray-300 focus:bg-white"
              />
              {docInput && (
                <button
                  type="button"
                  onClick={() => setDocInput('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick DOC Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setDocInput('')}
                className={`text-xs px-2.5 py-1 rounded-md border transition ${docInput === ''
                    ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
              >
                All
              </button>

              {availableDocs.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDocInput(String(d))}
                  className={`text-xs px-2.5 py-1 rounded-md border font-mono font-bold transition ${docInput === String(d)
                      ? 'bg-emerald-700 text-white border-emerald-700'
                      : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                  DOC {d}
                </button>
              ))}
            </div>
          </div>

          {/* Search box & Results counter */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-60">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search farmer / tank..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input py-1.5 pl-8 text-xs w-full"
              />
            </div>

            <span className="text-xs text-gray-500 whitespace-nowrap">
              <strong className="text-gray-900 font-semibold">{filteredTanks.length}</strong> tanks
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="py-16 text-center">
          <PageSpinner />
          <p className="text-xs text-gray-500 mt-2">Loading tanks...</p>
        </div>
      ) : error ? (
        <div className="p-6 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl text-xs">
          <p className="font-semibold">Failed to load tanks: {error.message}</p>
          <button onClick={() => refetch()} className="btn-secondary btn-sm mt-2 text-xs">
            Retry
          </button>
        </div>
      ) : filteredTanks.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
          <p className="text-sm font-semibold text-gray-800">No tanks match DOC {docInput}</p>
          <p className="text-xs text-gray-500 mt-1">Try entering another DOC or view all tanks.</p>
          <button
            onClick={() => setDocInput('')}
            className="btn-primary btn-sm mt-3 text-xs"
          >
            Show All Tanks
          </button>
        </div>
      ) : viewMode === 'table' ? (
        /* Minimal Table View */
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs text-left">
              <thead className="bg-gray-50/80 font-bold text-gray-700 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Tank</th>
                  <th className="px-4 py-3">Farmer</th>
                  <th className="px-4 py-3">DOC</th>
                  <th className="px-4 py-3">FCR</th>
                  <th className="px-4 py-3">ABW</th>
                  <th className="px-4 py-3">Stocking</th>
                  <th className="px-4 py-3">Feed Type</th>
                  <th className="px-4 py-3">Area</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredTanks.map((tank) => {
                  const currentDoc = parseInt(tank.current_doc, 10);
                  const fcrVal = tank.latest_feeding?.fcr || tank.fcr || null;
                  const abwVal = tank.latest_feeding?.abw || tank.abw || null;

                  return (
                    <tr key={tank.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-bold text-gray-900 block">
                          {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">ID: {tank.id}</span>
                      </td>

                      <td className="px-4 py-3">
                        <Link
                          to={`/clients/${tank.client_id}`}
                          className="font-semibold text-primary-700 hover:underline block"
                        >
                          {tank.company_name || '—'}
                        </Link>
                        <span className="text-[11px] text-gray-500 font-mono">
                          {tank.farmer_phone || tank.village || '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-100 text-emerald-800">
                          DOC {currentDoc}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-gray-900">
                          {fcrVal || '1.25*'}
                        </span>
                      </td>

                      <td className="px-4 py-3 font-mono text-gray-700">
                        {abwVal ? `${abwVal}g` : '—'}
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-mono font-medium text-gray-900 block">
                          {tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} L` : '—'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {tank.seed_date ? String(tank.seed_date).substring(0, 10) : '—'}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-gray-700">
                        {tank.feed_type || 'CP / Avanti'}
                      </td>

                      <td className="px-4 py-3 font-mono text-gray-800">
                        {Number(tank.area_acres || tank.area || 0).toFixed(2)} Ac
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTank(tank)}
                          className="text-xs text-primary-600 hover:text-primary-800 font-medium hover:underline inline-flex items-center gap-1"
                        >
                          <span>Details</span>
                          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
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
        /* Minimal Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTanks.map((tank) => {
            const currentDoc = parseInt(tank.current_doc, 10);
            const fcrVal = tank.latest_feeding?.fcr || tank.fcr || null;
            const abwVal = tank.latest_feeding?.abw || tank.abw || null;

            return (
              <div
                key={tank.id}
                className="bg-white border border-gray-200 rounded-xl p-3.5 hover:border-gray-300 transition-all shadow-2xs space-y-2.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">
                      {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-100 text-emerald-800">
                      DOC {currentDoc}
                    </span>
                  </div>
                  <span className="text-gray-500 font-mono text-[11px]">
                    {Number(tank.area_acres || tank.area || 0).toFixed(2)} Ac
                  </span>
                </div>

                <div>
                  <Link
                    to={`/clients/${tank.client_id}`}
                    className="font-semibold text-primary-700 hover:underline block"
                  >
                    {tank.company_name}
                  </Link>
                  <span className="text-gray-500 text-[11px]">
                    {[tank.village, tank.farmer_phone].filter(Boolean).join(' • ')}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center border border-gray-100">
                  <div>
                    <span className="text-[10px] text-gray-500 block">FCR</span>
                    <span className="font-mono font-bold text-emerald-900">{fcrVal || '1.25*'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">ABW</span>
                    <span className="font-mono font-bold text-gray-900">{abwVal ? `${abwVal}g` : '—'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-500 block">Feed</span>
                    <span className="font-medium text-gray-800 truncate block">{tank.feed_type || 'Avanti'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">
                    Seed: {tank.seed_date ? String(tank.seed_date).substring(0, 10) : '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedTank(tank)}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium hover:underline"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Minimal Details Modal */}
      {selectedTank && (
        <MinimalTankModal
          tank={selectedTank}
          onClose={() => setSelectedTank(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// MINIMAL TANK MODAL
// ----------------------------------------------------
function MinimalTankModal({ tank, onClose }) {
  const currentDoc = parseInt(tank.current_doc, 10);
  const lf = tank.latest_feeding || {};
  const visits = Array.isArray(tank.visits) ? tank.visits : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center p-4 fade-in">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-gray-900 text-base">
              {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
            </span>
            <span className="px-2 py-0.5 rounded-full font-mono font-bold text-xs bg-emerald-100 text-emerald-800">
              DOC {currentDoc}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Farmer & Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
            <div>
              <span className="text-gray-500 block text-[10px]">Farmer</span>
              <strong className="text-gray-900">{tank.company_name}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Mobile</span>
              <span className="font-mono text-gray-800">{tank.farmer_phone || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Location</span>
              <span className="text-gray-800 truncate block">{[tank.village, tank.district].filter(Boolean).join(', ') || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Water Area</span>
              <strong className="text-gray-900">{Number(tank.area_acres || tank.area || 0).toFixed(2)} Acres</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Seed Date</span>
              <span className="text-gray-800">{tank.seed_date ? String(tank.seed_date).substring(0, 10) : '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Stock Quantity</span>
              <strong className="text-gray-900">{tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} Lakhs` : '—'}</strong>
            </div>
          </div>

          {/* FCR & Feeding Metrics */}
          <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/30 space-y-2">
            <span className="font-bold text-emerald-950 text-xs block">Feeding & Growth Performance</span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-white p-2 rounded border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">FCR</span>
                <span className="font-mono font-bold text-emerald-900 text-sm">{lf.fcr || tank.fcr || '1.25'}</span>
              </div>
              <div className="bg-white p-2 rounded border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">ABW</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{lf.abw || tank.abw ? `${lf.abw || tank.abw}g` : '—'}</span>
              </div>
              <div className="bg-white p-2 rounded border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Daily Feed</span>
                <span className="font-mono font-bold text-gray-900 text-sm">{lf.daily_feed_quantity ? `${lf.daily_feed_quantity}kg` : '—'}</span>
              </div>
              <div className="bg-white p-2 rounded border border-emerald-100">
                <span className="text-[10px] text-gray-500 block">Feed Brand</span>
                <span className="font-bold text-gray-800 text-xs truncate block mt-0.5">{tank.feed_type || 'Avanti'}</span>
              </div>
            </div>
          </div>

          {/* Visits Timeline */}
          <div>
            <span className="font-bold text-gray-800 block mb-2">Visits Logged ({visits.length})</span>
            {visits.length === 0 ? (
              <p className="text-gray-400 text-center py-3 bg-gray-50 rounded-lg">No visits logged for this tank.</p>
            ) : (
              <div className="space-y-2">
                {visits.map((v) => (
                  <div key={v.id} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-gray-900">{v.visit_date}</span>
                      <span className="text-gray-500 ml-2">• Met by {v.salesperson_name || 'Technical Exec'}</span>
                      {v.feeding_details?.fcr && (
                        <span className="ml-2 font-mono text-emerald-800 font-bold">FCR: {v.feeding_details.fcr}</span>
                      )}
                    </div>
                    <Link to={`/visits/${v.id}`} className="text-primary-600 hover:underline">
                      View →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <Link
            to={`/clients/${tank.client_id}`}
            className="text-xs text-primary-600 hover:underline font-medium"
          >
            Go to Farmer Profile
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm text-xs py-1 px-4"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
