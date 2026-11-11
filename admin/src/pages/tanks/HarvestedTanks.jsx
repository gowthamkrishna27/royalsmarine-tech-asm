import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { PageSpinner } from '../../components/common/Spinner';
import {
  ArchiveBoxArrowDownIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  CalendarDaysIcon,
  BeakerIcon,
  ScaleIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';

export default function HarvestedTanks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const [harvestTypeFilter, setHarvestTypeFilter] = useState(
    initialType === 'partial' || initialType === 'final' ? initialType : 'all'
  );
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [cultureFilter, setCultureFilter] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);

  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['harvested-tanks', search, districtFilter, cultureFilter],
    queryFn: () =>
      clientService
        .getHarvestedTanks({
          search: search || undefined,
          district: districtFilter || undefined,
          culture_type: cultureFilter || undefined,
        })
        .then((r) => r.data.data || []),
  });

  // Calculate high-level summary metrics
  const summary = useMemo(() => {
    const totalTanks = tanks.length;
    let totalAcres = 0;
    let totalBiomass = 0;
    let docSum = 0;
    let docCount = 0;

    tanks.forEach((t) => {
      const acres = parseFloat(t.area_acres || t.area || 0);
      if (!isNaN(acres)) totalAcres += acres;

      const finalH = t.harvest_info?.final_harvest;
      if (finalH) {
        const biomass = parseFloat(finalH.total_biomass || finalH.harvested_biomass || 0);
        if (!isNaN(biomass)) totalBiomass += biomass;
        const doc = parseInt(finalH.doc, 10);
        if (!isNaN(doc) && doc > 0) {
          docSum += doc;
          docCount += 1;
        }
      }
    });

    return {
      totalTanks,
      totalAcres: totalAcres.toFixed(1),
      totalBiomass: totalBiomass > 0 ? `${totalBiomass.toLocaleString()} kg` : '-',
      avgDoc: docCount > 0 ? `${Math.round(docSum / docCount)}d` : '-',
    };
  }, [tanks]);

  // Distinct districts and culture types for filtering
  const districts = useMemo(() => {
    return Array.from(new Set(tanks.map((t) => t.district).filter(Boolean))).sort();
  }, [tanks]);

  const cultureTypes = useMemo(() => {
    return Array.from(new Set(tanks.map((t) => t.culture_type).filter(Boolean))).sort();
  }, [tanks]);

  const partialCount = useMemo(() => {
    return tanks.filter(
      (t) =>
        t.has_partial_harvest ||
        (Array.isArray(t.harvest_info?.partial_harvests) && t.harvest_info.partial_harvests.length > 0)
    ).length;
  }, [tanks]);

  const finalCount = useMemo(() => {
    return tanks.filter(
      (t) =>
        t.has_final_harvest ||
        (t.harvest_info?.final_harvest &&
          Object.values(t.harvest_info.final_harvest).some(Boolean)) ||
        t.status === 'harvested'
    ).length;
  }, [tanks]);

  const displayedTanks = useMemo(() => {
    if (harvestTypeFilter === 'partial') {
      return tanks.filter(
        (t) =>
          t.has_partial_harvest ||
          (Array.isArray(t.harvest_info?.partial_harvests) && t.harvest_info.partial_harvests.length > 0)
      );
    }
    if (harvestTypeFilter === 'final') {
      return tanks.filter(
        (t) =>
          t.has_final_harvest ||
          (t.harvest_info?.final_harvest &&
            Object.values(t.harvest_info.final_harvest).some(Boolean)) ||
          t.status === 'harvested'
      );
    }
    return tanks;
  }, [tanks, harvestTypeFilter]);

  const handleTypeChange = (type) => {
    setHarvestTypeFilter(type);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (type === 'all') {
        next.delete('type');
      } else {
        next.set('type', type);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4 w-full fade-in">
      {/* 1. Header: Minimal & Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200/80">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-9 h-9 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-800 transition shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Harvested Tanks
              </h1>
            </div>
            <p className="text-xs text-gray-500 mt-0.5"></p>
          </div>
        </div>

        <Link
          to="/clients"
          className="btn-secondary btn-sm text-xs self-start sm:self-auto inline-flex items-center gap-1.5"
        >
          <BuildingOfficeIcon className="w-4 h-4 text-gray-500" />
          <span>Farmers & Tanks</span>
        </Link>
      </div>

      {/* 2. Sleek Summary Strip (Minimal 4 metrics in one clean card) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200/80 rounded-2xl divide-y sm:divide-y-0 sm:divide-x divide-gray-100 shadow-2xs overflow-hidden">
        <div className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Total Harvested
          </p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
            {summary.totalTanks} <span className="text-xs font-normal text-gray-500">tanks</span>
          </p>
        </div>

        <div className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Harvest Types
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80">
              {partialCount} Partial
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80">
              {finalCount} Final
            </span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Total Biomass
          </p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
            {summary.totalBiomass}
          </p>
        </div>

        <div className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Harvest Area & DOC
          </p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1">
            {summary.totalAcres} <span className="text-xs font-normal text-gray-500">Ac</span>
            {summary.avgDoc !== '-' && (
              <span className="text-xs font-medium text-gray-400 ml-1.5">
                • {summary.avgDoc} avg
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 3. Minimal Filter Bar: Segmented Tabs + Search + Dropdowns */}
      <div className="bg-white border border-gray-200/80 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Filter Pills */}
          <div className="inline-flex items-center p-1 bg-gray-100 rounded-xl gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleTypeChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${harvestTypeFilter === 'all'
                ? 'bg-white text-gray-900 shadow-2xs'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              <span>All</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${harvestTypeFilter === 'all' ? 'bg-gray-100 text-gray-700' : 'text-gray-400'
                }`}>
                {tanks.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('partial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                harvestTypeFilter === 'partial'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>Partial</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                harvestTypeFilter === 'partial' ? 'bg-gray-100 text-gray-700' : 'text-gray-400'
              }`}>
                {partialCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTypeChange('final')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                harvestTypeFilter === 'final'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>Final</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                harvestTypeFilter === 'final' ? 'bg-gray-100 text-gray-700' : 'text-gray-400'
              }`}>
                {finalCount}
              </span>
            </button>
          </div>
        </div>

        {/* Search & Compact Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tank, farmer, phone, village..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            )}
          </div>

          {districts.length > 0 && (
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-gray-700 sm:w-40"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {cultureTypes.length > 0 && (
            <select
              value={cultureFilter}
              onChange={(e) => setCultureFilter(e.target.value)}
              className="text-xs sm:text-sm py-2 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 text-gray-700 sm:w-44"
            >
              <option value="">All Species</option>
              {cultureTypes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 4. Content Area: Minimal & Responsive Grid */}
      {isLoading ? (
        <div className="py-20 text-center">
          <PageSpinner />
          <p className="text-xs text-gray-400 mt-2">Loading harvested tanks...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50/80 border border-red-200 rounded-2xl">
          <p className="font-semibold text-sm">Failed to load harvested tanks</p>
          <p className="text-xs mt-1 text-gray-500">{error.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="btn-secondary btn-sm mt-3"
          >
            Retry
          </button>
        </div>
      ) : displayedTanks.length === 0 ? (
        <div className="p-12 text-center bg-white border border-gray-200/80 rounded-2xl">
          <ArchiveBoxArrowDownIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-gray-800">
            {harvestTypeFilter === 'partial'
              ? 'No Partial Harvested Tanks Found'
              : harvestTypeFilter === 'final'
                ? 'No Final Harvested Tanks Found'
                : 'No Harvested Tanks Found'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            {search || districtFilter || cultureFilter
              ? 'No results matched your active filters. Try clearing search or filter options.'
              : 'Harvest records are automatically captured when harvest tests are logged during technical field visits.'}
          </p>
          {(search || districtFilter || cultureFilter) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setDistrictFilter('');
                setCultureFilter('');
              }}
              className="btn-secondary btn-sm text-xs"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedTanks.map((tank) => (
            <TankCard
              key={tank.id}
              tank={tank}
              harvestType={harvestTypeFilter}
              onViewDetails={() => setSelectedTank(tank)}
            />
          ))}
        </div>
      )}

      {/* 5. Minimal Full Details Modal */}
      {selectedTank && (
        <TankDetailModal
          tank={selectedTank}
          onClose={() => setSelectedTank(null)}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// TANK CARD: MINIMAL & RESPONSIVE
// ----------------------------------------------------
function TankCard({ tank, onViewDetails, harvestType = 'all' }) {
  const finalH = tank.harvest_info?.final_harvest || null;
  const partials = Array.isArray(tank.harvest_info?.partial_harvests)
    ? tank.harvest_info.partial_harvests
    : [];

  const hasPartial = partials.length > 0 || tank.has_partial_harvest;
  const hasFinal = Boolean(finalH && Object.values(finalH).some(Boolean)) || tank.status === 'harvested';

  const isPartialView = harvestType === 'partial' || (!hasFinal && hasPartial);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 hover:border-gray-300 hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-2xs">
      {/* Top Header: Tank, Status & Acreage */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-gray-900 text-sm sm:text-base truncate">
                {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
              </span>
              {isPartialView ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  Partial Harvest
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  Final Harvest
                </span>
              )}
            </div>

            <Link
              to={`/clients/${tank.client_id}`}
              className="text-xs font-semibold text-primary-700 hover:text-primary-800 hover:underline mt-0.5 truncate block"
              title={tank.company_name}
            >
              {tank.company_name || 'Unknown Farmer'}
            </Link>
          </div>

          <div className="shrink-0 text-right">
            <span className="text-xs font-bold font-mono text-gray-700 bg-gray-100 px-2.5 py-1 rounded-lg block">
              {Number(tank.area_acres || tank.area || 0).toFixed(2)} Ac
            </span>
          </div>
        </div>

        {/* Minimal Location & Contact Strip */}
        <div className="mt-2.5 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
          {(tank.village || tank.district) && (
            <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
              <MapPinIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              {[tank.village, tank.district].filter(Boolean).join(', ')}
            </span>
          )}
          {tank.farmer_phone && (
            <a
              href={`tel:${tank.farmer_phone}`}
              className="inline-flex items-center gap-1 font-mono text-gray-600 hover:text-gray-900 hover:underline shrink-0"
            >
              <PhoneIcon className="w-3 h-3 text-gray-400 shrink-0" />
              {tank.farmer_phone}
            </a>
          )}
        </div>
      </div>

      {/* Metric Highlight Area */}
      {isPartialView ? (
        /* PARTIAL HARVEST CARD VIEW */
        <div className="bg-gray-50/80 border border-gray-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-800">
            <span>Partial Sessions ({partials.length})</span>
            {partials.length > 0 && (
              <span className="text-gray-600 font-mono text-[11px]">
                {partials
                  .reduce(
                    (sum, p) => sum + (parseFloat(p.harvested_biomass || p.biomass || 0) || 0),
                    0
                  )
                  .toLocaleString()}{' '}
                kg total
              </span>
            )}
          </div>

          {partials.length === 0 ? (
            <p className="text-[11px] text-gray-500 italic py-1 text-center">
              Partial harvest marked without itemized session details
            </p>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
              {partials.slice(0, 3).map((p, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-lg p-2 border border-gray-100 text-[11px] space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between font-medium text-gray-800">
                    <span>
                      #{idx + 1} {p.date ? `• ${p.date}` : ''}
                    </span>
                    <span className="font-bold text-gray-900 font-mono">
                      {p.harvested_biomass || p.biomass
                        ? `${p.harvested_biomass || p.biomass} kg`
                        : '-'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px] text-gray-500">
                    <div>
                      DOC: <strong className="text-gray-800 font-mono">{p.doc || '-'}</strong>
                    </div>
                    <div>
                      ABW: <strong className="text-gray-800 font-mono">{p.abw ? `${p.abw}g` : '-'}</strong>
                    </div>
                    <div>
                      Count: <strong className="text-gray-800 font-mono">{p.count || '-'}</strong>
                    </div>
                  </div>
                </div>
              ))}
              {partials.length > 3 && (
                <p className="text-[10px] text-center text-gray-500 font-medium pt-0.5">
                  +{partials.length - 3} more session{partials.length - 3 > 1 ? 's' : ''} recorded
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* FINAL HARVEST CARD VIEW */
        <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span className="font-semibold text-gray-800">Final Harvest Specs</span>
            {finalH?.date && (
              <span className="text-[10px] font-mono text-gray-500">{finalH.date}</span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
              <span className="text-[10px] text-gray-400 block font-medium">DOC</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 font-mono">
                {finalH?.doc || tank.doc || '-'}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
              <span className="text-[10px] text-gray-400 block font-medium">ABW</span>
              <span className="text-xs sm:text-sm font-bold text-gray-900 font-mono">
                {finalH?.abw ? `${finalH.abw}g` : tank.abw ? `${tank.abw}g` : '-'}
              </span>
            </div>
            <div className="bg-white p-2 rounded-lg border border-gray-100 shadow-2xs">
              <span className="text-[10px] text-gray-400 block font-medium">Biomass</span>
              <span className="text-xs sm:text-sm font-bold text-emerald-700 font-mono truncate block">
                {finalH?.total_biomass || finalH?.harvested_biomass
                  ? `${finalH.total_biomass || finalH.harvested_biomass} kg`
                  : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Card Action Footer */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 text-xs">
        <Link
          to={`/clients/${tank.client_id}`}
          className="text-gray-500 hover:text-gray-800 font-medium hover:underline inline-flex items-center gap-1"
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>Profile</span>
        </Link>

        <button
          type="button"
          onClick={onViewDetails}
          className="btn-secondary btn-sm py-1 px-3 text-xs inline-flex items-center gap-1 active:scale-95 transition"
        >
          <span>View Details</span>
          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// FULL TANK DETAIL MODAL: CLEAN & MINIMAL
// ----------------------------------------------------
export function TankDetailModal({ tank, onClose }) {
  const finalH = tank.harvest_info?.final_harvest || null;
  const partials = Array.isArray(tank.harvest_info?.partial_harvests)
    ? tank.harvest_info.partial_harvests
    : [];
  const visits = Array.isArray(tank.visits_history) ? tank.visits_history : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center bg-gray-50/80 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-bold text-gray-900 truncate">
                {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                Harvested
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {tank.company_name} {tank.district ? `• ${tank.district}` : ''}
            </p>
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

        {/* Modal Body (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-gray-600 flex-1">
          {/* Section 1: Farmer & Specs Summary */}
          <div className="bg-gray-50/70 border border-gray-100 rounded-xl p-3.5 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                  Farmer
                </span>
                <span className="text-gray-900 font-semibold truncate block">
                  {tank.company_name || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                  Phone
                </span>
                <span className="text-gray-800 font-mono font-medium truncate block">
                  {tank.farmer_phone || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                  Area / Size
                </span>
                <span className="text-gray-900 font-semibold font-mono block">
                  {Number(tank.area_acres || tank.area || 0).toFixed(2)} Acres
                </span>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold uppercase block">
                  Tech Exec
                </span>
                <span className="text-gray-800 font-medium truncate block">
                  {tank.salesperson_name || 'Unassigned'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-gray-200/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
              <div>
                <span className="text-gray-400">Species:</span>{' '}
                <strong className="text-gray-800 font-medium">
                  {tank.culture_type || 'Shrimp (Vannamei)'}
                </strong>
              </div>
              <div>
                <span className="text-gray-400">Water Type:</span>{' '}
                <strong className="text-gray-800 font-medium capitalize">
                  {tank.water_type || tank.water_source || 'Brackish'}
                </strong>
              </div>
              <div>
                <span className="text-gray-400">Seed Date:</span>{' '}
                <strong className="text-gray-800 font-medium">
                  {tank.seed_date ? String(tank.seed_date).substring(0, 10) : '-'}
                </strong>
              </div>
              <div>
                <span className="text-gray-400">Stock Qty:</span>{' '}
                <strong className="text-gray-800 font-mono font-medium">
                  {tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} L` : '-'}
                </strong>
              </div>
            </div>
          </div>

          {/* Section 2: Final Harvest Performance */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <span className="font-bold text-gray-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ScaleIcon className="w-4 h-4 text-emerald-600" />
                Final Harvest Metrics
              </span>
              {finalH?.date && (
                <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {finalH.date}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">DOC</span>
                <span className="text-sm font-bold text-gray-900 font-mono">
                  {finalH?.doc || tank.doc || '-'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">ABW</span>
                <span className="text-sm font-bold text-gray-900 font-mono">
                  {finalH?.abw ? `${finalH.abw}g` : tank.abw ? `${tank.abw}g` : '-'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">Biomass</span>
                <span className="text-sm font-bold text-emerald-700 font-mono truncate block">
                  {finalH?.total_biomass || finalH?.harvested_biomass
                    ? `${finalH.total_biomass || finalH.harvested_biomass}kg`
                    : '-'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">Count</span>
                <span className="text-sm font-bold text-gray-900 font-mono">
                  {finalH?.count || '-'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">FCR</span>
                <span className="text-sm font-bold text-gray-900 font-mono">
                  {finalH?.fcr || tank.fcr || '-'}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                <span className="text-[10px] text-gray-400 block font-medium">Survival</span>
                <span className="text-sm font-bold text-emerald-700 font-mono">
                  {finalH?.survival_rate ? `${finalH.survival_rate}%` : '-'}
                </span>
              </div>
            </div>

            {(finalH?.remarks || tank.remarks) && (
              <p className="text-[11px] text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                <strong className="text-gray-800">Remarks: </strong>
                {finalH?.remarks || tank.remarks}
              </p>
            )}
          </div>

          {/* Section 3: Partial Harvest Logs (if any) */}
          {partials.length > 0 && (
            <div className="border border-amber-200/80 rounded-xl p-4 space-y-3 bg-amber-50/20">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                <span className="font-bold text-amber-950 text-xs uppercase tracking-wider">
                  Partial Harvest Logs ({partials.length})
                </span>
                <span className="text-[11px] font-mono text-amber-800">
                  {partials
                    .reduce(
                      (sum, p) => sum + (parseFloat(p.harvested_biomass || p.biomass || 0) || 0),
                      0
                    )
                    .toLocaleString()}{' '}
                  kg total
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-amber-100 bg-white">
                <table className="min-w-full divide-y divide-gray-100 text-[11px]">
                  <thead className="bg-gray-50/80 text-gray-600 font-semibold">
                    <tr>
                      <th className="px-3 py-1.5 text-left">Date</th>
                      <th className="px-3 py-1.5 text-left">DOC</th>
                      <th className="px-3 py-1.5 text-left">ABW</th>
                      <th className="px-3 py-1.5 text-left">Biomass</th>
                      <th className="px-3 py-1.5 text-left">Count</th>
                      <th className="px-3 py-1.5 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {partials.map((p, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-1.5 font-medium text-gray-900">{p.date || '-'}</td>
                        <td className="px-3 py-1.5 font-mono">{p.doc || '-'}</td>
                        <td className="px-3 py-1.5 font-mono">{p.abw ? `${p.abw}g` : '-'}</td>
                        <td className="px-3 py-1.5 font-bold font-mono text-amber-800">
                          {p.harvested_biomass || p.biomass ? `${p.harvested_biomass || p.biomass}kg` : '-'}
                        </td>
                        <td className="px-3 py-1.5 font-mono">{p.count || '-'}</td>
                        <td className="px-3 py-1.5 text-gray-500 truncate max-w-[150px]">
                          {p.reason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 4: Water Quality & Visit History */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
            <span className="font-bold text-gray-900 text-xs uppercase tracking-wider block">
              Field Visits & Water Tests ({visits.length})
            </span>

            {visits.length === 0 ? (
              <p className="text-gray-400 text-center py-2 text-xs">
                No individual visit records attached to this pond.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
                {visits.slice(0, 5).map((v) => {
                  const wq = v.water_quality || {};
                  const hasWq = Object.keys(wq).some((k) => wq[k]);
                  return (
                    <div
                      key={v.id}
                      className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          Visit on {v.visit_date}
                        </span>
                        <Link
                          to={`/visits/${v.id}`}
                          className="text-primary-600 hover:underline text-[11px] font-medium"
                        >
                          View Report →
                        </Link>
                      </div>

                      {hasWq && (
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 text-[10px] text-gray-600 bg-white p-1.5 rounded border border-gray-100 font-mono">
                          {wq.ph && <div>pH: <strong>{wq.ph}</strong></div>}
                          {wq.salinity && <div>Sal: <strong>{wq.salinity} ppt</strong></div>}
                          {wq.dissolved_oxygen && <div>DO: <strong>{wq.dissolved_oxygen} ppm</strong></div>}
                          {wq.alkalinity && <div>Alk: <strong>{wq.alkalinity}</strong></div>}
                          {wq.ammonia && <div>NH3: <strong>{wq.ammonia}</strong></div>}
                          {wq.nitrite && <div>NO2: <strong>{wq.nitrite}</strong></div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
          <Link
            to={`/clients/${tank.client_id}`}
            className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Farmer Profile</span>
          </Link>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary btn-sm px-5 text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
