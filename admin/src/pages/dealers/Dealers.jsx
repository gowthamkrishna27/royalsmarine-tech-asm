import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import EmptyState from '../../components/common/EmptyState';
import {
  BuildingStorefrontIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
  UserGroupIcon,
  CircleStackIcon,
  ArrowTopRightOnSquareIcon,
  PhoneIcon,
} from '@heroicons/react/24/outline';

const fmt = (v, fallback = '—') => (v === null || v === undefined || v === '' ? fallback : v);

export default function Dealers() {
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sortBy, setSortBy] = useState('tanks_desc');
  const [selectedDealer, setSelectedDealer] = useState(null);

  const { data: dealers = [], isLoading, error, refetch } = useQuery({
    queryKey: ['dealers-list'],
    queryFn: () => clientService.getDealers().then((r) => r.data.data || []),
  });

  // Extract all distinct regions across dealers
  const regions = useMemo(() => {
    const set = new Set();
    dealers.forEach((d) => {
      (d.regions || []).forEach((r) => r && set.add(r));
      (d.districts || []).forEach((dist) => dist && set.add(dist));
    });
    return Array.from(set).sort();
  }, [dealers]);

  // Extract distinct areas across dealers (scoped to region if selected)
  const areas = useMemo(() => {
    const set = new Set();
    dealers.forEach((d) => {
      const matchRegion = !regionFilter ||
        d.regions?.some((r) => r.toLowerCase() === regionFilter.toLowerCase()) ||
        d.districts?.some((dist) => dist.toLowerCase() === regionFilter.toLowerCase());

      if (matchRegion) {
        (d.areas || []).forEach((a) => a && set.add(a));
        (d.villages || []).forEach((v) => v && set.add(v));
      }
    });
    return Array.from(set).sort();
  }, [dealers, regionFilter]);

  // High-level KPI summary
  const summary = useMemo(() => {
    const totalDealers = dealers.length;
    let totalFarmers = 0;
    let totalTanks = 0;
    let totalAcres = 0;

    dealers.forEach((d) => {
      totalFarmers += Number(d.farmer_count || 0);
      totalTanks += Number(d.tank_count || 0);
      totalAcres += Number(d.total_acres || 0);
    });

    return {
      totalDealers,
      totalFarmers,
      totalTanks,
      totalAcres: totalAcres.toFixed(1),
    };
  }, [dealers]);

  // Handle region change (resets area filter if it no longer applies)
  const handleRegionChange = (newRegion) => {
    setRegionFilter(newRegion);
    setAreaFilter('');
  };

  // Filter and sort dealers
  const filteredDealers = useMemo(() => {
    let result = dealers;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (d) =>
          d.dealer_name?.toLowerCase().includes(q) ||
          d.regions?.some((r) => r?.toLowerCase().includes(q)) ||
          d.areas?.some((a) => a?.toLowerCase().includes(q)) ||
          d.districts?.some((dist) => dist?.toLowerCase().includes(q)) ||
          d.villages?.some((v) => v?.toLowerCase().includes(q)) ||
          d.farmers?.some(
            (f) =>
              f.company_name?.toLowerCase().includes(q) ||
              f.contact_person?.toLowerCase().includes(q) ||
              f.mobile?.includes(q) ||
              f.village?.toLowerCase().includes(q) ||
              f.area?.toLowerCase().includes(q) ||
              f.region?.toLowerCase().includes(q)
          )
      );
    }

    if (regionFilter) {
      const rLower = regionFilter.toLowerCase();
      result = result.filter(
        (d) =>
          d.regions?.some((r) => r.toLowerCase() === rLower) ||
          d.districts?.some((dist) => dist.toLowerCase() === rLower)
      );
    }

    if (areaFilter) {
      const aLower = areaFilter.toLowerCase();
      result = result.filter(
        (d) =>
          d.areas?.some((a) => a.toLowerCase() === aLower) ||
          d.villages?.some((v) => v.toLowerCase() === aLower)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'tanks_desc') return b.tank_count - a.tank_count;
      if (sortBy === 'farmers_desc') return b.farmer_count - a.farmer_count;
      if (sortBy === 'acres_desc') return b.total_acres - a.total_acres;
      if (sortBy === 'name_asc') return a.dealer_name.localeCompare(b.dealer_name);
      return 0;
    });

    return result;
  }, [dealers, search, regionFilter, areaFilter, sortBy]);

  const hasActiveFilters = Boolean(search || regionFilter || areaFilter);

  return (
    <div className="space-y-5 fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-gray-200/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shadow-2xs">
            <BuildingStorefrontIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dealers</h1>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="btn-secondary btn-sm inline-flex items-center gap-1 self-start sm:self-auto text-xs"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Total Dealers</span>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{summary.totalDealers}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-blue-800">Connected Farmers</span>
          <p className="mt-1 text-2xl font-bold text-blue-900 tabular-nums">{summary.totalFarmers}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-indigo-800">Cultured Tanks</span>
          <p className="mt-1 text-2xl font-bold text-indigo-900 tabular-nums">{summary.totalTanks}</p>
        </div>
        <div className="rounded-xl border border-gray-200/80 bg-white p-3.5 shadow-2xs">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Total Area</span>
          <p className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{summary.totalAcres} ac</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-gray-200/80 bg-white p-3 sm:p-4 shadow-2xs space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search dealer, farmer, village, or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full py-2 pl-9 pr-8 text-xs sm:text-sm bg-gray-50/60 focus:bg-white"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters & Sorting */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Region Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={regionFilter}
                onChange={(e) => handleRegionChange(e.target.value)}
                className="input py-1.5 text-xs sm:text-sm bg-gray-50/60 focus:bg-white min-w-[130px]"
                aria-label="Filter by Region"
              >
                <option value="">All Regions</option>
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Area Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={areaFilter}
                onChange={(e) => setAreaFilter(e.target.value)}
                className="input py-1.5 text-xs sm:text-sm bg-gray-50/60 focus:bg-white min-w-[130px]"
                aria-label="Filter by Area"
              >
                <option value="">All Areas</option>
                {areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="input py-1.5 text-xs sm:text-sm bg-gray-50/60 focus:bg-white"
                aria-label="Sort dealers"
              >
                <option value="tanks_desc">Most Tanks</option>
                <option value="farmers_desc">Most Farmers</option>
                <option value="acres_desc">Largest Area</option>
                <option value="name_asc">Name (A-Z)</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setRegionFilter('');
                  setAreaFilter('');
                }}
                className="btn-secondary btn-sm text-xs py-1.5 px-2.5 text-gray-500 hover:text-gray-800"
              >
                Clear Filters
              </button>
            )}

            <span className="text-xs text-gray-500 tabular-nums ml-1">
              <strong>{filteredDealers.length}</strong> shown
            </span>
          </div>
        </div>
      </div>

      {/* Main Content: Table Format */}
      {isLoading ? (
        <div className="rounded-xl border border-gray-200 bg-white py-14 text-center">
          <PageSpinner />
          <p className="mt-2 text-sm text-gray-500">Loading dealers directory</p>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
          <p className="text-sm font-semibold text-gray-900">Could not load dealers</p>
          <p className="mt-1 text-xs text-gray-500">{error.message}</p>
          <button type="button" onClick={() => refetch()} className="btn-secondary btn-sm mt-3">
            Retry
          </button>
        </div>
      ) : filteredDealers.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8">
          <EmptyState
            icon={BuildingStorefrontIcon}
            title="No dealers found"
            description={
              hasActiveFilters
                ? 'No dealers match your selected region, area, or search filters. Try clearing the filters.'
                : 'No dealers recorded yet. When ASM or field technicians add dealer names in farmer tanks, they will appear here.'
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setRegionFilter('');
                    setAreaFilter('');
                  }}
                  className="btn-secondary btn-sm"
                >
                  Clear Filters
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-gray-200/80 bg-gray-50/80 text-xs font-semibold uppercase tracking-wider text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Dealer</th>
                  <th className="px-4 py-3 font-semibold">Region</th>
                  <th className="px-4 py-3 font-semibold">Area</th>
                  <th className="px-4 py-3 font-semibold text-center">Farmers</th>
                  <th className="px-4 py-3 font-semibold text-center">Tanks</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Area</th>
                  <th className="px-4 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDealers.map((dealer, idx) => {
                  const regionList = dealer.regions?.length ? dealer.regions : dealer.districts;
                  const regionText = (regionList || []).filter(Boolean).join(', ');
                  const areaList = dealer.areas?.length ? dealer.areas : dealer.villages;
                  const areaText = (areaList || []).filter(Boolean).slice(0, 3).join(', ');

                  return (
                    <tr key={idx} className="hover:bg-gray-50/70 transition">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-100">
                            <BuildingStorefrontIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-gray-900 text-sm truncate" title={dealer.dealer_name}>
                              {dealer.dealer_name}
                            </div>
                            {dealer.villages?.length > 0 && (
                              <div className="text-[11px] text-gray-400 truncate max-w-xs" title={dealer.villages.join(', ')}>
                                {dealer.villages.slice(0, 3).join(', ')}{dealer.villages.length > 3 ? ` +${dealer.villages.length - 3}` : ''}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {regionText ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                            {regionText}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {areaText ? (
                          <span className="text-xs text-gray-700 font-medium" title={areaList.join(', ')}>
                            {areaText}{areaList.length > 3 ? ` (+${areaList.length - 3})` : ''}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums">
                        <span className="font-semibold text-gray-900 font-mono">
                          {dealer.farmer_count}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center tabular-nums">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                          {dealer.tank_count}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums">
                        <span className="font-mono text-gray-800 font-medium">
                          {dealer.total_acres} ac
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedDealer(dealer)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition border border-blue-200"
                        >
                          <span>Farmers &amp; Tanks</span>
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
      )}

      {/* Dealer Details Modal */}
      {selectedDealer && (
        <DealerDetailsModal
          dealer={selectedDealer}
          onClose={() => setSelectedDealer(null)}
        />
      )}
    </div>
  );
}

function DealerDetailsModal({ dealer, onClose }) {
  const farmers = dealer.farmers || [];
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFarmers = useMemo(() => {
    if (!searchTerm.trim()) return farmers;
    const q = searchTerm.toLowerCase().trim();
    return farmers.filter(
      (f) =>
        f.company_name?.toLowerCase().includes(q) ||
        f.contact_person?.toLowerCase().includes(q) ||
        f.mobile?.includes(q) ||
        f.village?.toLowerCase().includes(q) ||
        f.area?.toLowerCase().includes(q) ||
        f.region?.toLowerCase().includes(q) ||
        f.district?.toLowerCase().includes(q)
    );
  }, [farmers, searchTerm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[88vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3 bg-gradient-to-r from-blue-50/70 via-white to-gray-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0 border border-blue-200">
              <BuildingStorefrontIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate" title={dealer.dealer_name}>
                  {dealer.dealer_name}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  {dealer.farmer_count} {dealer.farmer_count === 1 ? 'Farmer' : 'Farmers'} · {dealer.tank_count} {dealer.tank_count === 1 ? 'Tank' : 'Tanks'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Total Area: <strong>{dealer.total_acres} acres</strong>
                {dealer.regions?.length > 0 && ` · Region: ${dealer.regions.join(', ')}`}
                {dealer.areas?.length > 0 && ` · Area: ${dealer.areas.join(', ')}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Search Farmers */}
        <div className="p-3 sm:p-4 border-b border-gray-100 bg-white shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search farmers under this dealer..."
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              autoFocus
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Farmers & Tanks List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {filteredFarmers.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <UserGroupIcon className="w-9 h-9 mx-auto mb-2 text-gray-300" />
              <p className="font-semibold text-gray-600">No farmers found</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchTerm ? 'No farmer matches your search under this dealer.' : 'No farmers associated.'}
              </p>
            </div>
          ) : (
            filteredFarmers.map((farmer, fIdx) => (
              <div
                key={farmer.client_id || fIdx}
                className="p-4 rounded-xl border border-gray-200/90 bg-white hover:border-blue-200 hover:shadow-xs transition space-y-2.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <Link
                      to={`/clients/${farmer.client_id}`}
                      className="font-bold text-gray-900 text-sm hover:text-blue-600 hover:underline inline-flex items-center gap-1.5"
                    >
                      <span>{fmt(farmer.company_name)}</span>
                      <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5 text-blue-600" />
                    </Link>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {farmer.contact_person && (
                        <span className="mr-2">Contact: {farmer.contact_person}</span>
                      )}
                      {[farmer.village, farmer.area, farmer.district, farmer.region]
                        .filter(Boolean)
                        .filter((item, pos, self) => self.indexOf(item) === pos)
                        .join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    {farmer.mobile && (
                      <a
                        href={`tel:${farmer.mobile}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 hover:bg-gray-100 transition"
                      >
                        <PhoneIcon className="w-3 h-3 text-gray-500" />
                        <span>{farmer.mobile}</span>
                      </a>
                    )}
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-gray-100 text-gray-800">
                      {farmer.tanks?.length || 0} Tanks ({Number(farmer.total_acres || 0).toFixed(2)} ac)
                    </span>
                  </div>
                </div>

                {/* Tanks Pills */}
                {Array.isArray(farmer.tanks) && farmer.tanks.length > 0 && (
                  <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mr-1">
                      Tanks:
                    </span>
                    {farmer.tanks.map((t, tIdx) => (
                      <span
                        key={t.id || tIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50/70 text-blue-700 border border-blue-100"
                      >
                        <CircleStackIcon className="w-3 h-3 text-blue-500" />
                        <span>{t.name}</span>
                        {t.area_acres > 0 && (
                          <span className="text-[10px] text-blue-500 font-mono">({t.area_acres} ac)</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Showing <strong>{filteredFarmers.length}</strong> of <strong>{farmers.length}</strong> farmers</span>
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
