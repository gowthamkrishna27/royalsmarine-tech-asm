import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { clientService } from '../../services/clientService';
import { downloadBlob } from '../../hooks/useApi';
import { PageSpinner } from '../../components/common/Spinner';
import {
  ArchiveBoxArrowDownIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
  XMarkIcon,
  ArrowTopRightOnSquareIcon,
  BuildingOfficeIcon,
  ArrowLeftIcon,
  ArrowDownTrayIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';

export default function HarvestedTanks() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialType = searchParams.get('type');
  const [harvestTypeFilter, setHarvestTypeFilter] = useState(
    initialType === 'partial' || initialType === 'final' ? initialType : 'all'
  );
  const [search, setSearch] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [asmFilter, setAsmFilter] = useState('');
  const [techFilter, setTechFilter] = useState('');
  const [farmerFilter, setFarmerFilter] = useState('');
  const [selectedTank, setSelectedTank] = useState(null);

  // 1. Fetch harvested tanks
  const { data: tanks = [], isLoading, error, refetch } = useQuery({
    queryKey: ['harvested-tanks'],
    queryFn: () =>
      clientService
        .getHarvestedTanks()
        .then((r) => r.data.data || []),
  });

  // 2. Fetch filter metadata (regions, ASMs, techs, farmers)
  const { data: filterMeta } = useQuery({
    queryKey: ['visit-filters'],
    queryFn: () => clientService.getFilters().then((r) => r.data.data),
    staleTime: 60000,
  });

  // Region dropdown options
  const regionOptions = useMemo(() => {
    const metaRegions = filterMeta?.regions || [];
    const tankRegions = tanks.map((t) => t.region || t.district).filter(Boolean);
    const set = new Set([...metaRegions, ...tankRegions].map((r) => r.trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [filterMeta?.regions, tanks]);

  // ASM dropdown options (filtered by selected Region)
  const asmOptions = useMemo(() => {
    let list = (filterMeta?.asms || []).filter((a) => (a.status ? a.status === 'active' : true));
    if (regionFilter) {
      list = list.filter((a) => (a.region || '').toLowerCase() === regionFilter.toLowerCase());
    }
    return list.map((a) => ({
      value: String(a.id),
      label: a.name + (!regionFilter && a.region ? ` (${a.region})` : ''),
    }));
  }, [filterMeta?.asms, regionFilter]);

  // Technician dropdown options (filtered by selected ASM, or selected Region)
  const techOptions = useMemo(() => {
    let list = (filterMeta?.techs || []).filter((t) => (t.status ? t.status === 'active' : true));
    if (asmFilter) {
      list = list.filter((t) => String(t.manager_id) === String(asmFilter));
    } else if (regionFilter) {
      list = list.filter((t) => (t.region || '').toLowerCase() === regionFilter.toLowerCase());
    }
    return list.map((t) => ({
      value: String(t.id),
      label: t.name,
    }));
  }, [filterMeta?.techs, asmFilter, regionFilter]);

  // Farmer dropdown options (filtered by Tech, ASM, or Region)
  const farmerOptions = useMemo(() => {
    let list = filterMeta?.farmers || [];
    if (techFilter) {
      list = list.filter((f) => String(f.assigned_salesperson_id) === String(techFilter));
    } else if (asmFilter) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(asmFilter))
          .map((t) => String(t.id))
      );
      list = list.filter(
        (f) =>
          String(f.assigned_manager_id) === String(asmFilter) ||
          techIdsUnderAsm.has(String(f.assigned_salesperson_id))
      );
    } else if (regionFilter) {
      list = list.filter((f) => (f.region || '').toLowerCase() === regionFilter.toLowerCase());
    }
    return list.map((f) => ({
      value: String(f.id),
      label: f.name,
    }));
  }, [filterMeta?.farmers, filterMeta?.techs, techFilter, asmFilter, regionFilter]);

  // Cascading Filter Handlers
  const handleRegionChange = (newRegion) => {
    setRegionFilter(newRegion);
    if (asmFilter && newRegion) {
      const curAsm = (filterMeta?.asms || []).find((a) => String(a.id) === String(asmFilter));
      if (curAsm && (curAsm.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setAsmFilter('');
        setTechFilter('');
        setFarmerFilter('');
        return;
      }
    }
    if (techFilter && newRegion) {
      const curTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techFilter));
      if (curTech && (curTech.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setTechFilter('');
        setFarmerFilter('');
        return;
      }
    }
    if (farmerFilter && newRegion) {
      const curFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerFilter));
      if (curFarmer && (curFarmer.region || '').toLowerCase() !== newRegion.toLowerCase()) {
        setFarmerFilter('');
      }
    }
  };

  const handleAsmChange = (newAsmId) => {
    setAsmFilter(newAsmId);
    if (techFilter && newAsmId) {
      const curTech = (filterMeta?.techs || []).find((t) => String(t.id) === String(techFilter));
      if (curTech && String(curTech.manager_id) !== String(newAsmId)) {
        setTechFilter('');
        setFarmerFilter('');
        return;
      }
    }
    if (farmerFilter && newAsmId) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(newAsmId))
          .map((t) => String(t.id))
      );
      const curFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerFilter));
      if (
        curFarmer &&
        String(curFarmer.assigned_manager_id) !== String(newAsmId) &&
        !techIdsUnderAsm.has(String(curFarmer.assigned_salesperson_id))
      ) {
        setFarmerFilter('');
      }
    }
  };

  const handleTechChange = (newTechId) => {
    setTechFilter(newTechId);
    if (farmerFilter && newTechId) {
      const curFarmer = (filterMeta?.farmers || []).find((f) => String(f.id) === String(farmerFilter));
      if (curFarmer && String(curFarmer.assigned_salesperson_id) !== String(newTechId)) {
        setFarmerFilter('');
      }
    }
  };

  const handleResetFilters = () => {
    setSearch('');
    setRegionFilter('');
    setAsmFilter('');
    setTechFilter('');
    setFarmerFilter('');
    handleTypeChange('all');
  };

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

  // High-level summary metrics
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
        const biomass = parseFloat(finalH.total_biomass || finalH.harvested_biomass || finalH.harvested_quantity || 0);
        if (!isNaN(biomass)) totalBiomass += biomass;
        const doc = parseInt(finalH.doc, 10);
        if (!isNaN(doc) && doc > 0) {
          docSum += doc;
          docCount += 1;
        }
      }

      const partials = Array.isArray(t.harvest_info?.partial_harvests)
        ? t.harvest_info.partial_harvests
        : [];
      partials.forEach((p) => {
        const biomass = parseFloat(p.harvested_biomass || p.harvested_quantity || p.biomass || 0);
        if (!isNaN(biomass)) totalBiomass += biomass;
        const doc = parseInt(p.doc, 10);
        if (!isNaN(doc) && doc > 0) {
          docSum += doc;
          docCount += 1;
        }
      });
    });

    return {
      totalTanks,
      totalAcres: totalAcres.toFixed(1),
      totalBiomass: totalBiomass > 0 ? `${totalBiomass.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg` : '—',
      avgDoc: docCount > 0 ? `${Math.round(docSum / docCount)}d` : '—',
    };
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

  // Main Filtered Dataset
  const displayedTanks = useMemo(() => {
    let list = tanks;

    // Harvest Type Filter
    if (harvestTypeFilter === 'partial') {
      list = list.filter(
        (t) =>
          t.has_partial_harvest ||
          (Array.isArray(t.harvest_info?.partial_harvests) && t.harvest_info.partial_harvests.length > 0)
      );
    } else if (harvestTypeFilter === 'final') {
      list = list.filter(
        (t) =>
          t.has_final_harvest ||
          (t.harvest_info?.final_harvest &&
            Object.values(t.harvest_info.final_harvest).some(Boolean)) ||
          t.status === 'harvested'
      );
    }

    // Region Filter
    if (regionFilter) {
      const rLower = regionFilter.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.region || '').toLowerCase() === rLower ||
          (t.salesperson_region || '').toLowerCase() === rLower ||
          (t.manager_region || '').toLowerCase() === rLower ||
          (t.district || '').toLowerCase() === rLower
      );
    }

    // ASM Filter
    if (asmFilter) {
      const techIdsUnderAsm = new Set(
        (filterMeta?.techs || [])
          .filter((t) => String(t.manager_id) === String(asmFilter))
          .map((t) => String(t.id))
      );
      list = list.filter(
        (t) =>
          String(t.manager_id) === String(asmFilter) ||
          String(t.assigned_manager_id) === String(asmFilter) ||
          techIdsUnderAsm.has(String(t.salesperson_id)) ||
          techIdsUnderAsm.has(String(t.assigned_salesperson_id))
      );
    }

    // Tech Filter
    if (techFilter) {
      list = list.filter(
        (t) =>
          String(t.salesperson_id) === String(techFilter) ||
          String(t.assigned_salesperson_id) === String(techFilter) ||
          String(t.created_by) === String(techFilter)
      );
    }

    // Farmer Filter
    if (farmerFilter) {
      list = list.filter(
        (t) =>
          String(t.client_id) === String(farmerFilter) ||
          String(t.farmer_id) === String(farmerFilter)
      );
    }

    // Free Search Filter
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          (t.pond_name || '').toLowerCase().includes(q) ||
          (t.tank_number || '').toLowerCase().includes(q) ||
          (t.company_name || '').toLowerCase().includes(q) ||
          (t.contact_person || '').toLowerCase().includes(q) ||
          (t.farmer_phone || '').toLowerCase().includes(q) ||
          (t.village || '').toLowerCase().includes(q) ||
          (t.district || '').toLowerCase().includes(q) ||
          (t.salesperson_name || '').toLowerCase().includes(q) ||
          (t.manager_name || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    tanks,
    harvestTypeFilter,
    regionFilter,
    asmFilter,
    techFilter,
    farmerFilter,
    search,
    filterMeta?.techs,
  ]);

  // Export Table Data to CSV in exact Harvesting Data Sheet format
  const handleExportCsv = () => {
    if (!displayedTanks.length) return;
    const row1 = ',,,,,,,,,,,,Harvesting Data Sheet,,,,,,,,,,,,,,,,,,';
    const row2 = ',,,,,,,,,,,,,,Partial Harvest,,,,,Final Harvest,,,,,Total Material,,,,,,';
    const headers = [
      'S. No',
      'ASM/RM',
      'Farmer Name and Details',
      'Mobile No',
      'District',
      'Village',
      'Brand Name',
      'Water Source',
      'Salinity',
      'Pond No. ',
      'Pond Area (Acres)',
      'Date of Stocking ',
      'No. of Seed Stocked (Laksh)',
      'Stocking density (Pcs/sqm)',
      'Date of Partial Harvest',
      'DOC at Partial Harvest',
      'Count of Partial Harvest',
      'Quantity  of Partial Harvest (Kgs)',
      'Partial Harvestd Seed',
      'Date of Final Harvest ',
      'DOC at Final Harvest',
      'Count Final  Harvest',
      'Quantity at Final Harvest (Kgs)',
      'Final Harvestd Seed',
      'Total Quantity Harvested (Kgs)',
      'Cumulative Feed Consumption (Kgs)',
      ' FCR',
      'Total No. Harvested',
      'Survival (%)',
      'Soil Type',
      'Remarks'
    ];

    const rows = displayedTanks.map((t, idx) => {
      const finalH = t.harvest_info?.final_harvest || null;
      const partials = Array.isArray(t.harvest_info?.partial_harvests) ? t.harvest_info.partial_harvests : [];
      const partial = partials[0] || null;

      const areaAcres = parseFloat(t.area_acres || t.area || 0) || 0;
      let seedStocked = 0;
      if (t.stocking_quantity_lakhs) {
        const raw = parseFloat(t.stocking_quantity_lakhs);
        seedStocked = raw < 1000 ? Math.round(raw * 100000) : Math.round(raw);
      }
      let density = '';
      if (seedStocked > 0 && areaAcres > 0) {
        density = Math.round(seedStocked / (areaAcres * 4000));
      }

      // Partial and partial seed count
      const partialDate = partial?.date || '';
      const partialDoc = partial?.doc || '';
      const partialCount = parseFloat(partial?.count) || '';
      const partialQty = parseFloat(partial?.harvested_quantity || partial?.harvested_biomass || partial?.biomass || 0) || 0;
      const partialSeed = (partialQty > 0 && partialCount > 0) ? Math.round(partialQty * partialCount) : 0;

      // Final
      const finalDate = finalH?.date || '';
      const finalDoc = finalH?.doc || '';
      const finalCount = parseFloat(finalH?.count) || '';
      const finalQty = parseFloat(finalH?.harvested_quantity || finalH?.total_biomass || finalH?.harvested_biomass || 0) || 0;
      const finalSeed = (finalQty > 0 && finalCount > 0) ? Math.round(finalQty * finalCount) : 0;

      // Total Material
      const totalQty = (partialQty + finalQty) || (finalQty || partialQty || 0);
      const cumFeed = parseFloat(finalH?.total_feed || (t.fcr && totalQty ? totalQty * parseFloat(t.fcr) : 0)) || 0;
      let fcr = '';
      if (cumFeed > 0 && totalQty > 0) {
        fcr = (cumFeed / totalQty).toFixed(2);
      } else if (t.fcr) {
        fcr = parseFloat(t.fcr) || '';
      }
      const totalNoHarvested = partialSeed + finalSeed;
      let survival = '';
      if (totalNoHarvested > 0 && seedStocked > 0) {
        survival = Math.round((totalNoHarvested / seedStocked) * 100);
      }

      const soilType = t.soil_type || 'Black';
      const remarks = finalH?.remarks || partial?.remarks || t.remarks || '';

      return [
        idx + 1,
        `"${(t.manager_name || t.salesperson_name || '').replace(/"/g, '""')}"`,
        `"${(t.company_name || t.contact_person || '').replace(/"/g, '""')}"`,
        `"${(t.farmer_phone || '').replace(/"/g, '""')}"`,
        `"${(t.district || '').replace(/"/g, '""')}"`,
        `"${(t.village || '').replace(/"/g, '""')}"`,
        `"${(t.feed_type || t.dealer_name || 'Premium').replace(/"/g, '""')}"`,
        `"${(t.water_source || t.water_type || 'Creak+Canel').replace(/"/g, '""')}"`,
        `"${(t.salinity || '').replace(/"/g, '""')}"`,
        `"${(t.tank_number || t.pond_name || `Tank #${t.id}`).replace(/"/g, '""')}"`,
        areaAcres || '',
        `"${(t.seed_date ? String(t.seed_date).slice(0, 10) : '').replace(/"/g, '""')}"`,
        seedStocked || '',
        density || '',
        partialDate,
        partialDoc,
        partialCount || '',
        partialQty || '',
        partialSeed,
        finalDate,
        finalDoc,
        finalCount || '',
        finalQty || '',
        finalSeed,
        totalQty || '',
        cumFeed || '',
        fcr || '',
        totalNoHarvested || '',
        survival || '',
        `"${soilType.replace(/"/g, '""')}"`,
        `"${remarks.replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = [row1, row2, headers.join(','), ...rows].join('\n');
    downloadBlob(
      new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
      `Harvesting_Data_Sheet_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  const hasActiveFilters = Boolean(
    search || regionFilter || asmFilter || techFilter || farmerFilter || harvestTypeFilter !== 'all'
  );

  return (
    <div className="space-y-4 w-full fade-in pb-10">
      {/* 1. Header: Minimal & Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="w-8 h-8 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-gray-500 hover:text-gray-900 transition shrink-0"
            title="Back to Dashboard"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">
              Harvested Tanks
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={!displayedTanks.length}
            className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 transition disabled:opacity-40"
            title="Export Table to CSV"
          >
            <ArrowDownTrayIcon className="w-3.5 h-3.5 text-gray-400" />
            <span>Export Harvest Data</span>
          </button>
          <Link
            to="/clients"
            className="btn-secondary btn-sm text-xs inline-flex items-center gap-1.5 transition"
          >
            <BuildingOfficeIcon className="w-3.5 h-3.5 text-gray-400" />
            <span>Farmers & Tanks</span>
          </Link>
        </div>
      </div>

      {/* 2. Minimal Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 bg-white border border-gray-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-gray-100 shadow-2xs overflow-hidden">
        <div className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Total Harvested
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
            {summary.totalTanks} <span className="text-xs font-normal text-gray-400">tanks</span>
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Harvest Types
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-gray-900 font-semibold">{partialCount} <span className="text-gray-500 font-normal">Partial</span></span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-900 font-semibold">{finalCount} <span className="text-gray-500 font-normal">Final</span></span>
          </div>
        </div>

        <div className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Total Biomass
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
            {summary.totalBiomass}
          </p>
        </div>

        <div className="p-3 sm:p-4">
          <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">
            Harvest Area
          </p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-0.5">
            {summary.totalAcres} <span className="text-xs font-normal text-gray-400">Ac</span>
            {summary.avgDoc !== '—' && (
              <span className="text-xs font-normal text-gray-500 ml-1.5">
                ({summary.avgDoc} avg)
              </span>
            )}
          </p>
        </div>
      </div>

      {/* 3. Filter Bar: Neutral, Compact & Responsive */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-3.5 space-y-2.5 shadow-2xs">
        {/* Top Row: Type Pills & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Neutral Segmented Switch */}
          <div className="inline-flex items-center p-0.5 bg-gray-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => handleTypeChange('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${harvestTypeFilter === 'all'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('partial')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${harvestTypeFilter === 'partial'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Partial
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('final')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${harvestTypeFilter === 'final'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-900'
                }`}
            >
              Final
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <MagnifyingGlassIcon className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search farmer, tank, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 transition placeholder:text-gray-400"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XMarkIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns Row: Region, ASM, Technician, Farmer */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100">
          <select
            value={regionFilter}
            onChange={(e) => handleRegionChange(e.target.value)}
            className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
          >
            <option value="">All Regions</option>
            {regionOptions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select
            value={asmFilter}
            onChange={(e) => handleAsmChange(e.target.value)}
            className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
          >
            <option value="">All ASMs</option>
            {asmOptions.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>

          <select
            value={techFilter}
            onChange={(e) => handleTechChange(e.target.value)}
            className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
          >
            <option value="">All Technicians</option>
            {techOptions.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          <select
            value={farmerFilter}
            onChange={(e) => setFarmerFilter(e.target.value)}
            className="text-xs py-1.5 px-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:outline-none focus:border-gray-400 text-gray-700 w-full"
          >
            <option value="">All Farmers</option>
            {farmerOptions.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-[11px] text-gray-500 hover:text-gray-900 transition font-medium"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* 4. Minimal Table Format */}
      {isLoading ? (
        <div className="py-20 text-center bg-white border border-gray-200 rounded-xl">
          <PageSpinner />
          <p className="text-xs text-gray-500 mt-2">Loading harvested tanks...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-600 bg-red-50 border border-red-200 rounded-xl">
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
        <div className="p-12 text-center bg-white border border-gray-200 rounded-xl">
          <ArchiveBoxArrowDownIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-gray-800">
            {harvestTypeFilter === 'partial'
              ? 'No Partial Harvested Tanks Found'
              : harvestTypeFilter === 'final'
                ? 'No Final Harvested Tanks Found'
                : 'No Harvested Tanks Found'}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            {hasActiveFilters
              ? 'No results matched your active filters.'
              : 'Harvest records are automatically captured during technical field visits.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn-secondary btn-sm text-xs"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-2xs overflow-hidden">
          {/* Desktop & Tablet Table */}
          <div className="hidden sm:block w-full overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/75 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Farmer</th>
                  <th className="py-2.5 px-3 w-28">Tank Details</th>
                  <th className="py-2.5 px-3 w-32">Region / Area</th>
                  <th className="py-2.5 px-3 w-28">ASM</th>
                  <th className="py-2.5 px-3 w-28">Technician</th>
                  <th className="py-2.5 px-3 w-32">Harvest Type</th>
                  <th className="py-2.5 px-3 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedTanks.map((tank, idx) => {
                  const finalH = tank.harvest_info?.final_harvest || null;
                  const partials = Array.isArray(tank.harvest_info?.partial_harvests)
                    ? tank.harvest_info.partial_harvests
                    : [];
                  const isPartial = tank.has_partial_harvest || (!finalH && partials.length > 0);
                  const harvestDate =
                    finalH?.date ||
                    partials[0]?.date ||
                    (tank.updated_at ? String(tank.updated_at).slice(0, 10) : '—');
                  const harvestBiomass =
                    finalH?.total_biomass ||
                    finalH?.harvested_biomass ||
                    finalH?.harvested_quantity ||
                    partials[0]?.harvested_biomass ||
                    partials[0]?.harvested_quantity ||
                    partials[0]?.biomass ||
                    null;

                  return (
                    <tr
                      key={tank.id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      {/* # */}
                      <td className="py-2.5 px-3 text-center text-gray-400 font-mono text-xs">
                        {idx + 1}
                      </td>

                      {/* Farmer */}
                      <td className="py-2.5 px-3">
                        <Link
                          to={`/clients/${tank.client_id}`}
                          className="font-medium text-gray-900 hover:text-blue-600 transition block truncate max-w-[200px]"
                          title={tank.company_name}
                        >
                          {tank.company_name || 'Unknown Farmer'}
                        </Link>
                        {tank.farmer_phone && (
                          <span className="text-[11px] text-gray-400 font-mono block mt-0.5">
                            {tank.farmer_phone}
                          </span>
                        )}
                      </td>

                      {/* Tank Details */}
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-gray-900 block truncate">
                          {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400 block mt-0.5">
                          {Number(tank.area_acres || tank.area || 0).toFixed(2)} Ac
                        </span>
                      </td>

                      {/* Region / Area */}
                      <td className="py-2.5 px-3">
                        <span className="text-gray-800 font-medium capitalize block truncate max-w-[120px]">
                          {tank.region || tank.district || '—'}
                        </span>
                        <span className="text-[11px] text-gray-400 block mt-0.5 truncate max-w-[120px]">
                          {tank.village || tank.district || ''}
                        </span>
                      </td>

                      {/* ASM */}
                      <td className="py-2.5 px-3 text-gray-700 truncate max-w-[110px]">
                        {tank.manager_name || '—'}
                      </td>

                      {/* Technician */}
                      <td className="py-2.5 px-3 text-gray-700 truncate max-w-[110px]">
                        {tank.salesperson_name || '—'}
                      </td>

                      {/* Harvest Type & Date */}
                      <td className="py-2.5 px-3">
                        {isPartial ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                            Partial Harvest
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Final Harvest
                          </span>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-mono mt-0.5">
                          <span>{harvestDate}</span>
                          {harvestBiomass && (
                            <>
                              <span>•</span>
                              <span className="text-gray-600 font-medium">{Number(harvestBiomass).toLocaleString()} kg</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTank(tank)}
                          className="text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 px-2.5 py-1 rounded transition inline-flex items-center gap-1"
                        >
                          <span>View</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="sm:hidden divide-y divide-gray-100 p-2.5 space-y-2.5">
            {displayedTanks.map((tank, idx) => {
              const finalH = tank.harvest_info?.final_harvest || null;
              const partials = Array.isArray(tank.harvest_info?.partial_harvests)
                ? tank.harvest_info.partial_harvests
                : [];
              const isPartial = tank.has_partial_harvest || (!finalH && partials.length > 0);
              const harvestDate =
                finalH?.date ||
                partials[0]?.date ||
                (tank.updated_at ? String(tank.updated_at).slice(0, 10) : '—');
              const harvestBiomass =
                finalH?.total_biomass ||
                finalH?.harvested_biomass ||
                finalH?.harvested_quantity ||
                partials[0]?.harvested_biomass ||
                partials[0]?.harvested_quantity ||
                partials[0]?.biomass ||
                null;

              return (
                <div key={tank.id} className="pt-2 first:pt-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-gray-400 mr-1.5">{idx + 1}.</span>
                      <Link
                        to={`/clients/${tank.client_id}`}
                        className="font-medium text-gray-900 text-xs hover:text-blue-600"
                      >
                        {tank.company_name || 'Unknown Farmer'}
                      </Link>
                      {tank.farmer_phone && (
                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                          {tank.farmer_phone}
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 capitalize shrink-0 font-medium">
                      {tank.region || '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <div>
                      <span className="font-medium text-gray-900 block">
                        {tank.tank_number || tank.pond_name || `Tank #${tank.id}`}
                      </span>
                      <span className="text-[11px] text-gray-400 font-mono">
                        {Number(tank.area_acres || tank.area || 0).toFixed(2)} Ac
                      </span>
                    </div>

                    <div className="text-right">
                      {isPartial ? (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200/60">
                          Partial
                        </span>
                      ) : (
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Final
                        </span>
                      )}
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                        {harvestDate} {harvestBiomass ? `• ${Number(harvestBiomass).toLocaleString()} kg` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                    <span>Tech: <strong className="text-gray-700 font-normal">{tank.salesperson_name || '—'}</strong></span>
                    <button
                      type="button"
                      onClick={() => setSelectedTank(tank)}
                      className="text-xs font-medium text-gray-600 hover:text-gray-900 px-2 py-0.5 rounded hover:bg-gray-100 inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table Footer: Result Count */}
          <div className="px-4 py-2.5 bg-gray-50/60 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing <strong>{displayedTanks.length}</strong> of <strong>{tanks.length}</strong> harvested tanks
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-gray-500 hover:text-gray-900 font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
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
