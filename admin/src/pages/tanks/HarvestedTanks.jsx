import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
  CheckCircleIcon,
  ClockIcon,
  ChartBarIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline';

export default function HarvestedTanks() {
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
        const biomass = parseFloat(finalH.total_biomass || 0);
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
      totalAcres: totalAcres.toFixed(2),
      totalBiomass: totalBiomass > 0 ? `${totalBiomass.toLocaleString()} kg` : '-',
      avgDoc: docCount > 0 ? `${Math.round(docSum / docCount)} Days` : '-',
    };
  }, [tanks]);

  // Distinct districts and culture types for filtering
  const districts = useMemo(() => {
    return Array.from(new Set(tanks.map((t) => t.district).filter(Boolean))).sort();
  }, [tanks]);

  const cultureTypes = useMemo(() => {
    return Array.from(new Set(tanks.map((t) => t.culture_type).filter(Boolean))).sort();
  }, [tanks]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <ArchiveBoxArrowDownIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Harvested Tanks</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Complete harvest records, yield performance, water quality tests, and specifications of harvested ponds
              </p>
            </div>
          </div>
        </div>

        <Link
          to="/dashboard"
          className="btn-secondary btn-sm self-start sm:self-auto flex items-center gap-1.5 text-xs"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Metric Cards Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-amber-50 to-white border-amber-200">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">
            <ArchiveBoxArrowDownIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-amber-800">Harvested Tanks</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalTanks}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
            <ChartBarIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-blue-800">Total Harvest Area</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalAcres} <span className="text-xs font-normal text-gray-500">Acres</span></p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
            <ScaleIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-emerald-800">Total Biomass</p>
            <p className="text-xl font-bold text-gray-900">{summary.totalBiomass}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-indigo-50 to-white border-indigo-200">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
            <ClockIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-indigo-800">Avg. Culture Period</p>
            <p className="text-xl font-bold text-gray-900">{summary.avgDoc}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by tank number, farmer name, phone, village, district..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 text-sm py-2 w-full"
            />
          </div>

          {/* District filter */}
          {districts.length > 0 && (
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="input text-sm py-2 sm:w-44"
            >
              <option value="">All Districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          {/* Culture Type filter */}
          {cultureTypes.length > 0 && (
            <select
              value={cultureFilter}
              onChange={(e) => setCultureFilter(e.target.value)}
              className="input text-sm py-2 sm:w-48"
            >
              <option value="">All Culture Types</option>
              {cultureTypes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <div className="py-16 text-center">
          <PageSpinner />
          <p className="text-sm text-gray-500 mt-3">Loading harvested tanks...</p>
        </div>
      ) : error ? (
        <div className="card p-8 text-center text-red-600 bg-red-50 border-red-200">
          <p className="font-semibold">Failed to load harvested tanks</p>
          <p className="text-xs mt-1 text-gray-600">{error.message}</p>
          <button onClick={() => refetch()} className="btn-secondary btn-sm mt-3">
            Retry
          </button>
        </div>
      ) : tanks.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 mx-auto flex items-center justify-center mb-4">
            <ArchiveBoxArrowDownIcon className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-gray-900">No Harvested Tanks Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 mb-6">
            Tanks are automatically marked as harvested when a harvest test is logged during a field visit, or when set to "Harvested" in the farmer's pond details.
          </p>
          <Link to="/clients" className="btn-primary btn-sm inline-flex items-center gap-1.5">
            <BuildingOfficeIcon className="w-4 h-4" />
            <span>View Farmers & Tanks</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tanks.map((tank) => (
            <TankCard
              key={tank.id}
              tank={tank}
              onViewDetails={() => setSelectedTank(tank)}
            />
          ))}
        </div>
      )}

      {/* Tank Full Details Modal */}
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
// TANK CARD
// ----------------------------------------------------
function TankCard({ tank, onViewDetails }) {
  const finalH = tank.harvest_info?.final_harvest || null;
  const partials = Array.isArray(tank.harvest_info?.partial_harvests)
    ? tank.harvest_info.partial_harvests
    : [];

  return (
    <div className="card hover:shadow-md transition-all duration-200 border-gray-200 flex flex-col justify-between overflow-hidden">
      {/* Top Banner */}
      <div className="p-4 border-b border-gray-100 bg-gray-50/60 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">
              {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
            </span>
            <span className="badge badge-yellow text-[10px] font-semibold uppercase tracking-wider">
              Harvested
            </span>
          </div>
          <p className="text-xs font-semibold text-primary-700 mt-0.5">
            {tank.company_name || 'Unknown Farmer'}
          </p>
        </div>

        <div className="text-right">
          <span className="text-sm font-bold text-gray-900 font-mono">
            {Number(tank.area_acres || tank.area || 0).toFixed(2)}
          </span>
          <span className="text-[10px] text-gray-500 block -mt-0.5">Acres</span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 space-y-3 text-xs flex-1">
        {/* Farmer & Location details */}
        <div className="space-y-1 text-gray-600">
          {tank.farmer_phone && (
            <div className="flex items-center gap-2">
              <PhoneIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <a href={`tel:${tank.farmer_phone}`} className="hover:underline text-gray-800 font-mono">
                {tank.farmer_phone}
              </a>
            </div>
          )}
          {(tank.village || tank.mandal || tank.district) && (
            <div className="flex items-center gap-2">
              <MapPinIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span className="truncate">
                {[tank.village, tank.mandal, tank.district].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Culture / Seed Stocking Specs */}
        <div className="bg-gray-50 rounded-lg p-2.5 space-y-1.5 border border-gray-100">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Culture Type:</span>
            <span className="font-semibold text-gray-900 truncate max-w-[170px]">
              {tank.culture_type || 'Shrimp / Vannamei'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Seed Date:</span>
            <span className="font-medium text-gray-800">
              {tank.seed_date ? String(tank.seed_date).substring(0, 10) : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-gray-500">Seed Quantity:</span>
            <span className="font-medium text-gray-800">
              {tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} Lakhs` : '-'}
            </span>
          </div>
        </div>

        {/* Harvest Performance Highlights */}
        <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-2.5 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
            Harvest Performance
          </p>
          <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
            <div className="bg-white rounded p-1 shadow-2xs border border-amber-100">
              <span className="text-[10px] text-gray-500 block">DOC</span>
              <span className="font-bold text-gray-900 text-xs">
                {finalH?.doc || (partials[0]?.doc) || tank.doc || '-'}
              </span>
            </div>
            <div className="bg-white rounded p-1 shadow-2xs border border-amber-100">
              <span className="text-[10px] text-gray-500 block">ABW</span>
              <span className="font-bold text-gray-900 text-xs">
                {finalH?.abw ? `${finalH.abw}g` : (partials[0]?.abw ? `${partials[0].abw}g` : '-')}
              </span>
            </div>
            <div className="bg-white rounded p-1 shadow-2xs border border-amber-100">
              <span className="text-[10px] text-gray-500 block">Biomass</span>
              <span className="font-bold text-gray-900 text-xs truncate block">
                {finalH?.total_biomass ? `${finalH.total_biomass}kg` : '-'}
              </span>
            </div>
          </div>
          {finalH?.date && (
            <p className="text-[10px] text-amber-800 text-center pt-0.5">
              Harvested on: <strong className="font-semibold">{finalH.date}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
        <Link
          to={`/clients/${tank.client_id}`}
          className="text-xs text-primary-600 hover:text-primary-800 font-medium hover:underline"
        >
          View Farmer Profile
        </Link>

        <button
          onClick={onViewDetails}
          className="btn-primary btn-sm py-1 px-3 text-xs flex items-center gap-1 shadow-2xs"
        >
          <span>View Full Details</span>
          <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// FULL TANK DETAIL MODAL
// ----------------------------------------------------
function TankDetailModal({ tank, onClose }) {
  const finalH = tank.harvest_info?.final_harvest || null;
  const partials = Array.isArray(tank.harvest_info?.partial_harvests)
    ? tank.harvest_info.partial_harvests
    : [];
  const visits = Array.isArray(tank.visits_history) ? tank.visits_history : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-3 sm:p-5 fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-amber-50/70 via-white to-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
              <ArchiveBoxArrowDownIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">
                  {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                </h2>
                <span className="badge badge-yellow text-xs font-semibold">🌾 Harvested Tank</span>
              </div>
              <p className="text-xs text-gray-600">
                Farmer: <strong className="text-gray-900">{tank.company_name}</strong>
                {tank.district && ` • ${tank.district}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* SECTION 1: FARMER & CONTACT DETAILS */}
          <div className="card p-4 border-gray-200">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100 text-gray-900 font-semibold text-xs uppercase tracking-wider">
              <BuildingOfficeIcon className="w-4 h-4 text-primary-600" />
              <span>Farmer & Farm Details</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Farmer / Company</span>
                <span className="font-semibold text-gray-900 text-sm">{tank.company_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Contact Person</span>
                <span className="font-medium text-gray-900">{tank.contact_person || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Mobile Phone</span>
                <span className="font-medium text-gray-900 font-mono">{tank.farmer_phone || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Assigned Technical Exec</span>
                <span className="font-medium text-gray-900">{tank.salesperson_name || 'Unassigned'}</span>
              </div>

              <div className="sm:col-span-4 pt-2 border-t border-gray-50 text-gray-600 flex items-start gap-1.5">
                <MapPinIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span>
                  {[tank.farmer_address, tank.village, tank.mandal, tank.city, tank.district, tank.state, tank.pincode]
                    .filter(Boolean)
                    .join(', ') || 'No address details provided'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 2: TANK & CULTURE SPECIFICATIONS */}
          <div className="card p-4 border-gray-200">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100 text-gray-900 font-semibold text-xs uppercase tracking-wider">
              <BeakerIcon className="w-4 h-4 text-indigo-600" />
              <span>Tank & Culture Specifications</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block">Water Area / Size</span>
                <span className="font-bold text-gray-900 text-sm">
                  {Number(tank.area_acres || tank.area || 0).toFixed(2)} Acres
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Culture Species</span>
                <span className="font-medium text-gray-900">{tank.culture_type || 'Shrimp (Vannamei)'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Water Type</span>
                <span className="font-medium text-gray-900">{tank.water_type || tank.water_source || 'Brackish Water'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Soil Type</span>
                <span className="font-medium text-gray-900 capitalize">{tank.soil_type || 'Loam'}</span>
              </div>

              <div>
                <span className="text-gray-500 block">Hatchery Name</span>
                <span className="font-medium text-gray-900">{tank.hatchery_name || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Brooder</span>
                <span className="font-medium text-gray-900">{tank.brooder || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Seed Stocking Date</span>
                <span className="font-medium text-gray-900">
                  {tank.seed_date ? String(tank.seed_date).substring(0, 10) : '-'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Seed Stock Quantity</span>
                <span className="font-medium text-gray-900 font-mono">
                  {tank.stocking_quantity_lakhs ? `${tank.stocking_quantity_lakhs} Lakhs` : '-'}
                </span>
              </div>

              <div>
                <span className="text-gray-500 block">Feed Brand / Type</span>
                <span className="font-medium text-gray-900">{tank.feed_type || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500 block">Salinity (Stocking)</span>
                <span className="font-medium text-gray-900">{tank.salinity ? `${tank.salinity} ppt` : '-'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500 block">GPS Coordinates</span>
                {tank.latitude && tank.longitude ? (
                  <a
                    href={`https://www.google.com/maps?q=${tank.latitude},${tank.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline flex items-center gap-1 font-mono text-xs"
                  >
                    <span>{Number(tank.latitude).toFixed(6)}, {Number(tank.longitude).toFixed(6)}</span>
                    <ArrowTopRightOnSquareIcon className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: COMPLETE HARVEST PERFORMANCE & YIELD */}
          <div className="card p-5 border-amber-300 bg-gradient-to-br from-amber-50/40 via-white to-amber-50/20">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <ScaleIcon className="w-5 h-5 text-amber-700" />
                <h3 className="text-sm font-bold text-amber-950 uppercase tracking-wide">
                  Harvest Yield & Performance Details
                </h3>
              </div>
              {finalH?.date && (
                <span className="badge badge-yellow font-semibold text-xs">
                  Harvest Date: {finalH.date}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Final DOC</span>
                <span className="text-lg font-bold text-gray-900">
                  {finalH?.doc || tank.doc || '-'} <span className="text-xs font-normal text-gray-500">days</span>
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Average Body Weight (ABW)</span>
                <span className="text-lg font-bold text-gray-900">
                  {finalH?.abw ? `${finalH.abw} g` : (tank.abw ? `${tank.abw} g` : '-')}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Total Biomass Harvested</span>
                <span className="text-lg font-bold text-amber-800">
                  {finalH?.total_biomass ? `${finalH.total_biomass} kg` : '-'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Count (per kg)</span>
                <span className="text-lg font-bold text-gray-900">
                  {finalH?.count || '-'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Feed Conversion Ratio (FCR)</span>
                <span className="text-lg font-bold text-gray-900">
                  {finalH?.fcr || tank.fcr || '-'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Survival Rate</span>
                <span className="text-lg font-bold text-emerald-700">
                  {finalH?.survival_rate ? `${finalH.survival_rate}%` : '-'}
                </span>
              </div>
              <div className="sm:col-span-2 bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                <span className="text-gray-500 block text-[11px]">Harvest Remarks & Observations</span>
                <span className="text-gray-800 text-xs mt-0.5 block">
                  {finalH?.remarks || tank.remarks || 'No remarks recorded for this harvest.'}
                </span>
              </div>
            </div>

            {/* Partial Harvests Table (if present) */}
            {partials.length > 0 && (
              <div className="mt-5 pt-4 border-t border-amber-200">
                <h4 className="text-xs font-bold text-gray-800 mb-2">Partial Harvests Logged</h4>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50 font-semibold text-gray-700">
                      <tr>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">DOC</th>
                        <th className="px-3 py-2 text-left">ABW</th>
                        <th className="px-3 py-2 text-left">Count</th>
                        <th className="px-3 py-2 text-left">Biomass (kg)</th>
                        <th className="px-3 py-2 text-left">Survival %</th>
                        <th className="px-3 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {partials.map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-900">{p.date || '-'}</td>
                          <td className="px-3 py-2">{p.doc || '-'}</td>
                          <td className="px-3 py-2 font-mono">{p.abw ? `${p.abw}g` : '-'}</td>
                          <td className="px-3 py-2 font-mono">{p.count || '-'}</td>
                          <td className="px-3 py-2 font-bold text-gray-900">{p.harvested_biomass || '-'}</td>
                          <td className="px-3 py-2">{p.survival_rate ? `${p.survival_rate}%` : '-'}</td>
                          <td className="px-3 py-2 text-gray-500">{p.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: FIELD VISIT & WATER TEST HISTORY FOR THIS TANK */}
          <div className="card p-4 border-gray-200">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-gray-100 text-gray-900 font-semibold text-xs uppercase tracking-wider">
              <CalendarDaysIcon className="w-4 h-4 text-emerald-600" />
              <span>Technical Field Visits & Water Quality Tests ({visits.length})</span>
            </div>

            {visits.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                No individual visit records attached to this tank.
              </p>
            ) : (
              <div className="space-y-3">
                {visits.map((v) => {
                  const wq = v.water_quality || {};
                  const hasWq = Object.keys(wq).some((k) => wq[k]);
                  return (
                    <div key={v.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">
                            Visit on {v.visit_date}
                          </span>
                          <span className="text-gray-500">• Met by {v.salesperson_name || 'Technical Executive'}</span>
                        </div>
                        <Link
                          to={`/visits/${v.id}`}
                          className="text-primary-600 hover:underline text-[11px] font-medium"
                        >
                          View Visit →
                        </Link>
                      </div>

                      {v.meeting_highlights && (
                        <p className="text-gray-700 italic text-[11px]">
                          "{v.meeting_highlights}"
                        </p>
                      )}

                      {/* Water quality preview if present */}
                      {hasWq && (
                        <div className="bg-white rounded-lg p-2 border border-gray-200 grid grid-cols-3 sm:grid-cols-6 gap-2 text-[11px]">
                          {wq.ph && <div><span className="text-gray-400 block text-[9px]">pH</span><strong>{wq.ph}</strong></div>}
                          {wq.salinity && <div><span className="text-gray-400 block text-[9px]">Salinity</span><strong>{wq.salinity} ppt</strong></div>}
                          {wq.dissolved_oxygen && <div><span className="text-gray-400 block text-[9px]">DO</span><strong>{wq.dissolved_oxygen} ppm</strong></div>}
                          {wq.alkalinity && <div><span className="text-gray-400 block text-[9px]">Alkalinity</span><strong>{wq.alkalinity} ppm</strong></div>}
                          {wq.ammonia && <div><span className="text-gray-400 block text-[9px]">Ammonia</span><strong>{wq.ammonia} ppm</strong></div>}
                          {wq.nitrite && <div><span className="text-gray-400 block text-[9px]">Nitrite</span><strong>{wq.nitrite} ppm</strong></div>}
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
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <Link
            to={`/clients/${tank.client_id}`}
            className="btn-secondary btn-sm text-xs flex items-center gap-1.5"
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>Open Farmer Profile</span>
          </Link>

          <button onClick={onClose} className="btn-primary btn-sm px-5 text-xs">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
